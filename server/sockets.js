const dammenGame = require('./dammen-game');
const schakenGame = require('./schaken-game');
const vieropeenrijGame = require('./vieropeenrij-game');

function attachGameNamespace(ioOrNamespace, game) {
  const io = ioOrNamespace;
  const {
    initBoard,
    getLegalMoves,
    applyMove,
    checkWinner,
    moveMatches,
    P1,
    P2,
  } = game;

  const users = new Map();
  const pendingInvites = new Map();
  const rooms = new Map();
  const socketToRoom = new Map();

  function getLobbyList() {
    return Array.from(users.entries()).map(([id, u]) => ({ id, name: u.name }));
  }

  function broadcastLobby() {
    const list = getLobbyList();
    io.emit('lobby', list);
  }

  function leaveRoom(socketId) {
    const roomId = socketToRoom.get(socketId);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    const other = room.player1.id === socketId ? room.player2 : room.player1;
    socketToRoom.delete(socketId);
    socketToRoom.delete(other.id);
    rooms.delete(roomId);
    io.to(other.id).emit('opponentLeft');
    io.to(socketId).emit('youLeftRoom');
  }

  io.on('connection', (socket) => {
    socket.on('setName', (name) => {
      const safeName = String(name || '').trim().slice(0, 30) || 'Speler';
      users.set(socket.id, { name: safeName });
      socket.emit('setNameOk', { name: safeName });
      broadcastLobby();
    });

    socket.on('getLobby', () => {
      socket.emit('lobby', getLobbyList());
    });

    socket.on('invite', (targetId) => {
      const me = users.get(socket.id);
      if (!me || !targetId || targetId === socket.id) return;
      const target = users.get(targetId);
      if (!target) return;
      pendingInvites.set(targetId, { inviterId: socket.id, inviterName: me.name });
      io.to(targetId).emit('invite', { fromId: socket.id, fromName: me.name });
    });

    socket.on('acceptInvite', (fromId) => {
      const pending = pendingInvites.get(socket.id);
      if (!pending || pending.inviterId !== fromId) return;
      pendingInvites.delete(socket.id);
      const inviter = users.get(fromId);
      if (!inviter) {
        socket.emit('inviteFailed', { reason: 'Speler niet meer online' });
        return;
      }
      const roomId = 'room-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      const board = initBoard();
      const room = {
        id: roomId,
        player1: { id: fromId, name: inviter.name },
        player2: { id: socket.id, name: users.get(socket.id).name },
        board,
        currentPlayer: P1,
        winner: null,
        chat: [],
      };
      rooms.set(roomId, room);
      socketToRoom.set(fromId, roomId);
      socketToRoom.set(socket.id, roomId);
      socket.join(roomId);
      // Default namespace (dammen): io.sockets.sockets; custom namespace (schaken, vieropeenrij): io.sockets
      const inviterSocket = io.sockets?.sockets?.get(fromId) ?? io.sockets?.get(fromId);
      if (inviterSocket) inviterSocket.join(roomId);

      io.to(fromId).emit('gameStart', {
        roomId,
        board,
        youAre: P1,
        opponentName: room.player2.name,
        chat: [],
      });
      io.to(socket.id).emit('gameStart', {
        roomId,
        board,
        youAre: P2,
        opponentName: room.player1.name,
        chat: [],
      });
    });

    socket.on('declineInvite', (fromId) => {
      pendingInvites.delete(socket.id);
      io.to(fromId).emit('inviteDeclined', { byId: socket.id });
    });

    socket.on('move', (move) => {
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || room.winner != null) return;
      const youAre = room.player1.id === socket.id ? P1 : P2;
      if (room.currentPlayer !== youAre) return;

      const legal = getLegalMoves(room.board, youAre);
      const valid = legal.find((m) => moveMatches(m, move));
      if (!valid) return;

      room.board = applyMove(room.board, valid, room.currentPlayer);
      room.winner = checkWinner.length >= 2 ? checkWinner(room.board, room.currentPlayer) : checkWinner(room.board);
      room.currentPlayer = room.currentPlayer === P1 ? P2 : P1;
      io.to(roomId).emit('gameState', {
        board: room.board,
        currentPlayer: room.currentPlayer,
        winner: room.winner,
      });
    });

    const MAX_CHAT = 100;
    socket.on('chat', (text) => {
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      const name = room.player1.id === socket.id ? room.player1.name : room.player2.name;
      const msg = { name: String(name).slice(0, 30), text: String(text || '').trim().slice(0, 500) };
      if (!msg.text) return;
      room.chat.push(msg);
      if (room.chat.length > MAX_CHAT) room.chat.shift();
      io.to(roomId).emit('chat', msg);
    });

    socket.on('leaveRoom', () => {
      leaveRoom(socket.id);
    });

    socket.on('disconnect', () => {
      pendingInvites.delete(socket.id);
      leaveRoom(socket.id);
      users.delete(socket.id);
      broadcastLobby();
    });
  });
}

function attachSockets(server) {
  const io = require('socket.io')(server, {
    cors: { origin: '*' },
    path: '/socket.io',
  });

  attachGameNamespace(io, dammenGame);
  attachGameNamespace(io.of('/schaken'), schakenGame);
  attachGameNamespace(io.of('/vieropeenrij'), vieropeenrijGame);

  return io;
}

module.exports = { attachSockets };
