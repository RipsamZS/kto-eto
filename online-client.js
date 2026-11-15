(function () {
  "use strict";
  const ENDPOINT = "wss://kazo.casual-online.workers.dev";
  const s = { socket:null, playerId:null, roomCode:null, pack:null, currentTurn:null, opponentConnected:false, readySent:false, seq:0, pending:new Map(), closing:false };
  function emit(name, detail) { const data=detail||{}; window.dispatchEvent(new CustomEvent(name,{detail:data})); document.dispatchEvent(new CustomEvent(name,{detail:data})); }
  function status(message) { const el=document.getElementById("onlineStatus"); if(el) el.textContent=message; }
  function onMessage(message) {
    if(!message||typeof message!=="object") return;
    if(message.ackId) { const item=s.pending.get(String(message.ackId)); if(item){clearTimeout(item.timer);s.pending.delete(String(message.ackId));item.resolve(message.result||{ok:false,message:"Пустой ответ сервера."});} return; }
    const d=message.data||{};
    switch(message.event) {
      case "connected": s.playerId=d.playerId||null; break;
      case "player-joined": s.opponentConnected=true; emit("online-opponent-connected",d); status("Соперник подключился. Выберите персонажей."); break;
      case "player-ready": emit("online-opponent-ready",d); status("Соперник выбрал персонажа."); break;
      case "online-start": emit("online-start",d); status("Оба игрока готовы. Игра началась!"); break;
      case "online-turn": s.currentTurn=d.currentTurn||null; emit("online-turn",{currentTurn:s.currentTurn,isMyTurn:s.currentTurn===s.playerId,deadline:d.deadline||null,timerSeconds:d.timerSeconds||0}); break;
      case "online-question": emit("online-question",d); status("Соперник задал вопрос. Ответь на него."); break;
      case "online-answer": emit("online-answer",d); status(d.answer?"Соперник ответил: Да.":"Соперник ответил: Нет."); break;
      case "online-guess-result": emit("online-guess-result",d); break;
      case "online-guess-made": emit("online-guess-made",d); break;
      case "online-ended": s.currentTurn=null; emit("online-ended",d); status(d.message||"Матч завершён."); break;
      case "player-left": s.opponentConnected=false; s.currentTurn=null; emit("online-opponent-left",d); status("Соперник отключился."); break;
      default: emit("online-server-event",{event:message.event,data:d});
    }
  }
  function connect(code) {
    if(s.socket){s.closing=true;try{s.socket.close();}catch(e){}}
    s.playerId=null;s.currentTurn=null;s.opponentConnected=false;s.readySent=false;s.roomCode=code;s.closing=false;
    return new Promise((resolve,reject)=>{
      let settled=false,socket;
      const timeout=setTimeout(()=>{if(!settled){settled=true;reject(new Error("Время подключения истекло."));try{socket.close();}catch(e){}}},12000);
      try{socket=new WebSocket(ENDPOINT+"/room?id="+encodeURIComponent(code)+"&game=who-is-it");}
      catch(e){clearTimeout(timeout);reject(e);return;}
      s.socket=socket;
      socket.addEventListener("message",event=>{let message;try{message=JSON.parse(event.data);}catch(e){return;}onMessage(message);if(message.event==="connected"&&message.data&&message.data.playerId&&!settled){settled=true;clearTimeout(timeout);resolve(message.data);}});
      socket.addEventListener("error",()=>{if(!settled){settled=true;clearTimeout(timeout);reject(new Error("Не удалось подключиться к серверу."));}});
      socket.addEventListener("close",()=>{if(!settled){settled=true;clearTimeout(timeout);reject(new Error("Соединение было закрыто."));}if(!s.closing&&s.socket===socket){s.currentTurn=null;s.opponentConnected=false;emit("online-disconnected",{});status("Соединение с комнатой потеряно.");}});
    });
  }
  function send(event,data) {
    if(!s.socket||s.socket.readyState!==WebSocket.OPEN)return Promise.resolve({ok:false,message:"Нет соединения с комнатой."});
    const id=String(++s.seq);
    return new Promise(resolve=>{const timer=setTimeout(()=>{s.pending.delete(id);resolve({ok:false,message:"Сервер не ответил вовремя."});},12000);s.pending.set(id,{resolve,timer});try{s.socket.send(JSON.stringify({event,data:data||{},requestId:id}));}catch(e){clearTimeout(timer);s.pending.delete(id);resolve({ok:false,message:"Не удалось отправить запрос."});}});
  }
  async function createRoom(pack,settings) {
    settings=settings||{};
    if(!pack||!Array.isArray(pack.characters)||pack.characters.length<20)return{ok:false,message:"Для онлайн-игры нужно не менее 20 персонажей."};
    const count=Number(settings.cardCount||pack.characters.length);
    if([20,30,40,50,60].indexOf(count)<0||pack.characters.length<count)return{ok:false,message:"Размер набора должен быть 20, 30, 40, 50 или 60 персонажей."};
    const code=String(Math.floor(100000+Math.random()*900000));
    try{await connect(code);}catch(e){return{ok:false,message:e.message};}
    const result=await send("create-room",{pack:{name:String(pack.name||"Пак").slice(0,60),characters:pack.characters},settings:{roomName:String(settings.roomName||"Кто это?").slice(0,50),roomCode:code,maxPlayers:2,cardCount:count,timerSeconds:Number(settings.timerSeconds||0),access:"private",nickname:"Игрок"}});
    if(!result.ok){leaveRoom();return result;}
    s.pack=pack;window.onlineRoomActive=true;emit("online-room-created",{code,settings:result.settings||{}});
    return{ok:true,code,pack,settings:result.settings||{}};
  }
  async function joinRoom(code) {
    code=String(code||"").trim().toUpperCase();
    if(!/^[A-Z0-9_-]{3,16}$/.test(code))return{ok:false,message:"Неверный код комнаты."};
    try{await connect(code);}catch(e){return{ok:false,message:e.message};}
    const result=await send("join-room",{profile:{nickname:"Игрок",avatar:"🙂"}});
    if(!result.ok){leaveRoom();return result;}
    s.pack=result.pack||null;s.opponentConnected=true;window.onlineRoomActive=true;emit("online-room-joined",{code,settings:result.settings||{}});
    return{ok:true,code,pack:result.pack,settings:result.settings||{}};
  }
  function playerReady(id) {
    if(!s.opponentConnected)return Promise.resolve({ok:false,message:"Подожди подключения соперника."});
    return send("player-ready",{secretCharacterId:String(id)}).then(result=>{if(result.ok)s.readySent=true;return result;});
  }
  function leaveRoom() {
    const socket=s.socket;s.closing=true;
    if(socket&&socket.readyState===WebSocket.OPEN){try{socket.send(JSON.stringify({event:"leave-room",data:{}}));}catch(e){}}
    if(socket){try{socket.close();}catch(e){}}
    s.socket=null;s.playerId=null;s.roomCode=null;s.pack=null;s.currentTurn=null;s.opponentConnected=false;s.readySent=false;
    for(const item of s.pending.values()){clearTimeout(item.timer);item.resolve({ok:false,message:"Комната закрыта."});}
    s.pending.clear();window.onlineRoomActive=false;emit("online-room-left",{});
  }
  window.onlineGame={
    createRoom,joinRoom,playerReady,leaveRoom,
    canChooseCharacter:()=>Boolean(s.socket&&s.socket.readyState===WebSocket.OPEN&&s.opponentConnected&&!s.readySent),
    isMyTurn:()=>Boolean(s.playerId&&s.currentTurn===s.playerId),
    askQuestion:question=>send("ask-question",{question:String(question||"").trim()}),
    answerQuestion:answer=>send("answer-question",{answer:Boolean(answer)}),
    makeGuess:guessId=>send("make-guess",{guessId:String(guessId||"")}),
    getRoomCode:()=>s.roomCode,getPack:()=>s.pack
  };
})();