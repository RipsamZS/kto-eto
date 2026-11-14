
let onlineSocket = io();

let onlineMode = false;
let onlineRoomCode = null;
let onlinePack = null;
let onlineMyTurn = false;
let onlineWaiting = false;

function addOnlineStyles() {
    const style = document.createElement("style");

    style.textContent = `
        #onlineLobby {
            max-width: 650px;
            margin: 30px auto;
            padding: 25px;
            background: #ffffff12;
            border-radius: 20px;
        }

        #onlineLobby input,
        #onlineLobby select {
            width: 100%;
            padding: 13px;
            margin: 8px 0 15px;
            border-radius: 10px;
            background: #211e42;
            color: white;
            border: 1px solid #777;
        }

        #onlineGamePanel {
            max-width: 900px;
            margin: 15px auto;
            padding: 20px;
            background: #ffffff15;
            border-radius: 18px;
        }

        #onlineLog {
            max-height: 180px;
            overflow-y: auto;
            margin-top: 15px;
        }

        .online-hidden {
            display: none !important;
        }
    `;

    document.head.appendChild(style);
}

function createOnlineInterface() {
    addOnlineStyles();

    const menu = document.querySelector(".menu-buttons");

    const onlineButton = document.createElement("button");
    onlineButton.textContent = "🌐 Играть по сети";
    onlineButton.onclick = openOnlineLobby;

    menu.appendChild(onlineButton);

    const lobby = document.createElement("section");

    lobby.id = "onlineLobby";
    lobby.className = "screen";

    lobby.innerHTML = `
        <div class="topbar">
            <button class="secondary" id="onlineBack">← Назад</button>
            <h2>🌐 Онлайн-игра</h2>
        </div>

        <p class="subtitle">
            Играй с другом через интернет!
        </p>

        <label>Выбери пак персонажей</label>
        <select id="onlinePackSelect"></select>

        <button id="onlineCreate" style="width:100%">
            Создать комнату
        </button>

        <hr>

        <label>Код комнаты</label>
        <input
            id="onlineCode"
            type="text"
            maxlength="6"
            inputmode="numeric"
            placeholder="Введи код друга"
        >

        <button id="onlineJoin" style="width:100%">
            Войти в комнату
        </button>

        <div id="onlineStatus" class="info-pill center"
             style="margin-top:20px">
            Подключаемся к серверу...
        </div>

        <div id="onlineRoomInfo" class="center"
             style="margin-top:15px"></div>
    `;

    document.body.appendChild(lobby);

    document.getElementById("onlineBack").onclick = () => {
        showScreen("home");
    };

    document.getElementById("onlineCreate").onclick =
        createOnlineRoom;

    document.getElementById("onlineJoin").onclick =
        joinOnlineRoom;

    const game = document.getElementById("game");

    const panel = document.createElement("div");

    panel.id = "onlineGamePanel";
    panel.className = "online-hidden";

    panel.innerHTML = `
        <h3>🌐 Онлайн-матч</h3>

        <div class="game-info">
            <div class="info-pill" id="onlineTurn">
                Ожидание...
            </div>

            <div class="info-pill" id="onlineOpponent">
                Ожидаем соперника
            </div>
        </div>

        <div id="onlineIncoming"></div>

        <hr>

        <input
            id="onlineQuestion"
            type="text"
            placeholder="Задай вопрос сопернику"
            style="width:100%;padding:12px;border-radius:10px"
        >

        <button id="onlineAsk" style="width:100%;margin-top:8px">
            Задать вопрос
        </button>

        <input
            id="onlineGuess"
            type="text"
            placeholder="Попробуй угадать персонажа"
            style="width:100%;padding:12px;border-radius:10px;margin-top:12px"
        >

        <button id="onlineGuessButton"
                class="secondary"
                style="width:100%;margin-top:8px">
            Угадать
        </button>

        <div id="onlineLog"></div>

        <button id="onlineLeave"
                class="danger"
                style="width:100%;margin-top:15px">
            Покинуть комнату
        </button>
    `;

    game.insertBefore(panel, game.querySelector(".game-info"));

    document.getElementById("onlineAsk").onclick =
        sendOnlineQuestion;

    document.getElementById("onlineGuessButton").onclick =
        sendOnlineGuess;

    document.getElementById("onlineLeave").onclick =
        leaveOnlineGame;
}

function setOnlineStatus(message) {
    document.getElementById("onlineStatus").textContent = message;
}

function openOnlineLobby() {
    const select = document.getElementById("onlinePackSelect");

    select.innerHTML = "";

    const packs = [
        {
            id: "__minecraft",
            name: "Minecraft",
            characters: defaultCharacters
        },
        ...myPacks
    ];

    packs.forEach(pack => {
        const option = document.createElement("option");

        option.value = pack.id;
        option.textContent =
            pack.name + " (" + pack.characters.length + ")";

        select.appendChild(option);
    });

    document.getElementById("onlineRoomInfo").textContent = "";

    showScreen("onlineLobby");

    if (onlineSocket.connected) {
        setOnlineStatus("Подключено к серверу!");
    } else {
        setOnlineStatus("Подключаемся к серверу...");
    }
}

function getOnlinePack() {
    const id = document.getElementById("onlinePackSelect").value;

    const pack = id === "__minecraft"
        ? {
            name: "Minecraft",
            characters: defaultCharacters
        }
        : myPacks.find(p => p.id === id);

    if (!pack) return null;

    return {
        name: pack.name,
        characters: pack.characters.map(c => ({
            id: c.id,
            name: c.name,
            emoji: c.emoji || null,
            image: c.image || null
        }))
    };
}

function createOnlineRoom() {
    const pack = getOnlinePack();

    if (!pack || pack.characters.length < 2) {
        alert("В паке должно быть хотя бы два персонажа.");
        return;
    }

    if (!onlineSocket.connected) {
        setOnlineStatus("Нет подключения к серверу.");
        return;
    }

    onlineSocket.emit("create-room", pack, result => {
        if (!result || !result.ok) {
            setOnlineStatus(result?.message || "Ошибка создания комнаты.");
            return;
        }

        onlinePack = pack;
        onlineRoomCode = result.code;
        onlineMode = true;

        document.getElementById("onlineCode").value = result.code;

        document.getElementById("onlineRoomInfo").innerHTML =
            "<h2>Код комнаты: " + result.code + "</h2>" +
            "<p>Отправь этот код другу. Ждём подключения...</p>";

        setOnlineStatus("Комната создана!");
    });
}

function joinOnlineRoom() {
    const code = document.getElementById("onlineCode").value.trim();

    if (!/^\d{6}$/.test(code)) {
        alert("Введи шестизначный код.");
        return;
    }

    onlineSocket.emit("join-room", code, result => {
        if (!result || !result.ok) {
            setOnlineStatus(result?.message || "Не удалось войти.");
            return;
        }

        onlineRoomCode = code;
        onlinePack = result.pack;
        onlineMode = true;

        setOnlineStatus("Ты подключился к комнате!");

        startOnlineGame(onlinePack);
    });
}

function startOnlineGame(pack) {
    if (!pack || !pack.characters || !pack.characters.length) {
        setOnlineStatus("Не удалось загрузить пак.");
        return;
    }

    onlinePack = pack;

    document.getElementById("onlineGamePanel")
        .classList.remove("online-hidden");

    document.getElementById("onlineOpponent").textContent =
        "Соперник подключён";

    document.getElementById("onlineLog").innerHTML = "";

    startGameFromCharacters(
        pack.characters,
        pack.name + " — онлайн"
    );
}

function onlineLog(message) {
    const box = document.getElementById("onlineLog");

    const line = document.createElement("p");
    line.textContent = message;

    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
}

function updateOnlineTurn(myTurn) {
    onlineMyTurn = myTurn;

    document.getElementById("onlineTurn").textContent =
        myTurn ? "Твой ход" : "Ход соперника";

    document.getElementById("onlineQuestion").disabled =
        !myTurn;

    document.getElementById("onlineAsk").disabled =
        !myTurn;

    document.getElementById("onlineGuess").disabled =
        !myTurn;

    document.getElementById("onlineGuessButton").disabled =
        !myTurn;
}

function sendOnlineQuestion() {
    const input = document.getElementById("onlineQuestion");
    const question = input.value.trim();

    if (!question || !onlineMyTurn || onlineWaiting) return;

    onlineSocket.emit("ask-question", question, result => {
        if (!result || !result.ok) {
            onlineLog(result?.message || "Ошибка отправки вопроса.");
            return;
        }

        onlineWaiting = true;
        input.value = "";
        onlineLog("Ты спросил: " + question);
    });
}

function sendOnlineGuess() {
    const input = document.getElementById("onlineGuess");
    const guess = input.value.trim();

    if (!guess || !onlineMyTurn || onlineWaiting) return;

    onlineSocket.emit("make-guess", guess, result => {
        if (!result || !result.ok) {
            onlineLog(result?.message || "Ошибка отправки догадки.");
            return;
        }

        onlineWaiting = true;
        input.value = "";
        onlineLog("Твоя догадка: " + guess);
    });
}

function showOnlineAnswerButtons(type, text) {
    const box = document.getElementById("onlineIncoming");

    box.innerHTML = "";

    const title = document.createElement("p");
    title.textContent = text;

    const yes = document.createElement("button");
    yes.textContent = type === "guess" ? "Да, угадал!" : "Да";

    const no = document.createElement("button");
    no.textContent = "Нет";
    no.className = "secondary";

    yes.onclick = () => {
        if (type === "guess") {
            onlineSocket.emit("answer-guess", true);
        } else {
            onlineSocket.emit("answer-question", true);
        }

        box.innerHTML = "";
    };

    no.onclick = () => {
        if (type === "guess") {
            onlineSocket.emit("answer-guess", false);
        } else {
            onlineSocket.emit("answer-question", false);
        }

        box.innerHTML = "";
    };

    box.append(title, yes, no);
}

function leaveOnlineGame() {
    if (onlineSocket.connected) {
        onlineSocket.emit("leave-room");
    }

    onlineMode = false;
    onlineRoomCode = null;
    onlinePack = null;
    onlineWaiting = false;

    document.getElementById("onlineGamePanel")
        .classList.add("online-hidden");

    showScreen("home");
}

// СОБЫТИЯ СЕРВЕРА

onlineSocket.on("connect", () => {
    const status = document.getElementById("onlineStatus");

    if (status) {
        status.textContent = "Подключено к серверу!";
    }
});

onlineSocket.on("connect_error", () => {
    const status = document.getElementById("onlineStatus");

    if (status) {
        status.textContent = "Не удалось подключиться к серверу.";
    }
});

onlineSocket.on("player-joined", () => {
    document.getElementById("onlineOpponent").textContent =
        "Друг подключился!";

    onlineLog("Друг подключился к комнате.");

    if (onlinePack) {
        startOnlineGame(onlinePack);
    }
});

onlineSocket.on("player-ready", () => {
    document.getElementById("onlineOpponent").textContent =
        "Соперник выбрал персонажа.";

    onlineLog("Соперник готов к игре.");
});

onlineSocket.on("online-start", () => {
    onlineLog("Игра началась!");

    updateOnlineTurn(
        onlineSocket.id === onlineCurrentTurn
    );
});

let onlineCurrentTurn = null;

onlineSocket.on("online-turn", data => {
    onlineCurrentTurn = data.currentTurn;

    updateOnlineTurn(
        onlineSocket.id === onlineCurrentTurn
    );

    onlineWaiting = false;
});

onlineSocket.on("online-question", data => {
    onlineLog("Вопрос соперника: " + data.question);

    showOnlineAnswerButtons(
        "question",
        "Соперник спрашивает: " + data.question
    );
});

onlineSocket.on("online-answer", data => {
    onlineWaiting = false;

    onlineLog(
        "Ответ соперника: " + (data.answer ? "Да" : "Нет")
    );
});

onlineSocket.on("online-guess", data => {
    showOnlineAnswerButtons(
        "guess",
        "Соперник пытается угадать: " + data.guess
    );
});

onlineSocket.on("online-guess-result", data => {
    onlineWaiting = false;

    onlineLog(
        data.correct
            ? "Соперник угадал!"
            : "Соперник не угадал."
    );
});

onlineSocket.on("online-ended", data => {
    onlineLog(data.message);
    alert(data.message);
});

onlineSocket.on("player-left", () => {
    document.getElementById("onlineOpponent").textContent =
        "Соперник отключился";

    onlineLog("Соперник покинул комнату.");
});

// Подключаем подтверждение выбора персонажа к онлайн-режиму.
const oldConfirmCharacter = confirmCharacter;

confirmCharacter = function() {
    oldConfirmCharacter();

    if (!onlineMode || !secretCharacter) return;

    onlineSocket.emit("player-ready", result => {
        if (!result || !result.ok) {
            onlineLog(result?.message || "Не удалось начать игру.");
        }
    });
};

createOnlineInterface();
