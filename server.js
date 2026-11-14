
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" },
    maxHttpBufferSize: 30e6
});

const PORT = process.env.PORT || 3000;
const rooms = new Map();

app.use(express.static(__dirname));

app.get("/health", (req, res) => {
    res.json({ ok: true });
});

function makeRoomCode() {
    let code;

    do {
        code = String(Math.floor(100000 + Math.random() * 900000));
    } while (rooms.has(code));

    return code;
}

function getRoom(socket) {
    const code = socket.data.roomCode;
    return code ? rooms.get(code) : null;
}

function sendTurn(room) {
    io.to(room.code).emit("online-turn", {
        currentTurn: room.currentTurn
    });
}

function removePlayer(socket) {
    const room = getRoom(socket);
    if (!room) return;

    room.players = room.players.filter(id => id !== socket.id);
    room.ready.delete(socket.id);

    socket.to(room.code).emit("player-left");

    socket.leave(room.code);
    socket.data.roomCode = null;

    if (room.players.length === 0) {
        rooms.delete(room.code);
    }
}

io.on("connection", socket => {
    console.log("Игрок подключился:", socket.id);

    // СОЗДАНИЕ КОМНАТЫ
    socket.on("create-room", (pack, callback) => {
        if (
            !pack ||
            !Array.isArray(pack.characters) ||
            pack.characters.length < 2 ||
            pack.characters.length > 100
        ) {
            return callback?.({
                ok: false,
                message: "В паке должно быть от 2 до 100 персонажей."
            });
        }

        const code = makeRoomCode();

        const room = {
            code,
            pack,
            players: [socket.id],
            ready: new Set(),
            currentTurn: null,
            pending: null,
            ended: false
        };

        rooms.set(code, room);

        socket.join(code);
        socket.data.roomCode = code;

        callback?.({
            ok: true,
            code
        });

        console.log("Создана комната:", code);
    });

    // ВХОД В КОМНАТУ
    socket.on("join-room", (code, callback) => {
        code = String(code || "").trim();

        const room = rooms.get(code);

        if (!room) {
            return callback?.({
                ok: false,
                message: "Комната не найдена."
            });
        }

        if (room.players.length >= 2) {
            return callback?.({
                ok: false,
                message: "В комнате уже два игрока."
            });
        }

        room.players.push(socket.id);

        socket.join(code);
        socket.data.roomCode = code;

        callback?.({
            ok: true,
            code,
            pack: room.pack
        });

        socket.to(code).emit("player-joined");

        console.log("Игрок вошёл в комнату:", code);
    });

    // ИГРОК ВЫБРАЛ ПЕРСОНАЖА
    socket.on("player-ready", (callback) => {
        const room = getRoom(socket);

        if (!room || room.players.length !== 2 || room.ended) {
            return callback?.({
                ok: false,
                message: "Ожидаем второго игрока."
            });
        }

        room.ready.add(socket.id);

        socket.to(room.code).emit("player-ready");

        if (room.ready.size === 2) {
            room.currentTurn =
                room.players[Math.floor(Math.random() * 2)];

            io.to(room.code).emit("online-start");

            sendTurn(room);
        }

        callback?.({ ok: true });
    });

    // ВОПРОС
    socket.on("ask-question", (question, callback) => {
        const room = getRoom(socket);

        question = String(question || "").trim().slice(0, 250);

        if (
            !room ||
            room.ended ||
            room.currentTurn !== socket.id ||
            room.pending ||
            !question
        ) {
            return callback?.({
                ok: false,
                message: "Сейчас нельзя задать вопрос."
            });
        }

        room.pending = {
            type: "question",
            from: socket.id
        };

        socket.to(room.code).emit("online-question", {
            question
        });

        callback?.({ ok: true });
    });

    // ОТВЕТ НА ВОПРОС
    socket.on("answer-question", (answer, callback) => {
        const room = getRoom(socket);

        if (
            !room ||
            !room.pending ||
            room.pending.type !== "question" ||
            room.pending.from === socket.id
        ) {
            return callback?.({
                ok: false,
                message: "Нет вопроса для ответа."
            });
        }

        const asker = room.pending.from;

        io.to(asker).emit("online-answer", {
            answer: !!answer
        });

        room.pending = null;
        room.currentTurn = socket.id;

        sendTurn(room);

        callback?.({ ok: true });
    });

    // ПОПЫТКА УГАДАТЬ
    socket.on("make-guess", (guess, callback) => {
        const room = getRoom(socket);

        guess = String(guess || "").trim().slice(0, 120);

        if (
            !room ||
            room.ended ||
            room.currentTurn !== socket.id ||
            room.pending ||
            !guess
        ) {
            return callback?.({
                ok: false,
                message: "Сейчас нельзя угадывать."
            });
        }

        room.pending = {
            type: "guess",
            from: socket.id
        };

        socket.to(room.code).emit("online-guess", {
            guess
        });

        callback?.({ ok: true });
    });

    // ОТВЕТ НА ПОПЫТКУ УГАДАТЬ
    socket.on("answer-guess", (correct, callback) => {
        const room = getRoom(socket);

        if (
            !room ||
            !room.pending ||
            room.pending.type !== "guess" ||
            room.pending.from === socket.id
        ) {
            return callback?.({
                ok: false,
                message: "Нет догадки для ответа."
            });
        }

        const guesser = room.pending.from;

        io.to(guesser).emit("online-guess-result", {
            correct: !!correct
        });

        room.pending = null;

        if (correct) {
            room.ended = true;

            io.to(room.code).emit("online-ended", {
                message: "Игра окончена! Персонаж угадан."
            });
        } else {
            room.currentTurn = socket.id;
            sendTurn(room);
        }

        callback?.({ ok: true });
    });

    // ВЫХОД ИЗ КОМНАТЫ
    socket.on("leave-room", () => {
        removePlayer(socket);
    });

    socket.on("disconnect", () => {
        console.log("Игрок отключился:", socket.id);
        removePlayer(socket);
    });
});

server.listen(PORT, () => {
    console.log("Сервер запущен на порту " + PORT);
});
