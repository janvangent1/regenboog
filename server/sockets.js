const dammenGame = require('./dammen-game');
const schakenGame = require('./schaken-game');
const vieropeenrijGame = require('./vieropeenrij-game');
const zeeslagGame = require('./zeeslag-game');
const rekenDuelGame = require('./reken-duel-game');

const GRACE_PERIOD_MS = 10 * 1000;       // 10 seconds before opponent is kicked
const INVITE_TIMEOUT_MS = 30 * 1000;      // invites expire after 30 seconds
const INVITE_CLEANUP_INTERVAL_MS = 60 * 1000; // clean stale invites every 60 seconds

// Per-socket move rate limiting: minimum ms between accepted moves
const MIN_MOVE_INTERVAL_MS = 50;          // max 20 moves/sec

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
  const disconnectTimers = new Map();   // socketId -> setTimeout handle
  const lastMoveTime = new Map();       // socketId -> timestamp (rate limiting)

  function getLobbyList() {
    return Array.from(users.entries()).map(([id, u]) => ({ id, name: u.name }));
  }

  function broadcastLobby() {
    io.emit('lobby', getLobbyList());
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

  // Stale invite cleanup
  setInterval(() => {
    const now = Date.now();
    for (const [targetId, invite] of pendingInvites.entries()) {
      if (now - invite.timestamp > INVITE_TIMEOUT_MS) {
        pendingInvites.delete(targetId);
      }
    }
  }, INVITE_CLEANUP_INTERVAL_MS);

  io.on('connection', (socket) => {
    // If this socket had a pending disconnect timer (reconnect scenario), cancel it
    const existingTimer = disconnectTimers.get(socket.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      disconnectTimers.delete(socket.id);
    }

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
      pendingInvites.set(targetId, {
        inviterId: socket.id,
        inviterName: me.name,
        timestamp: Date.now(),
      });
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
      // Per-socket rate limiting
      const now = Date.now();
      if (now - (lastMoveTime.get(socket.id) || 0) < MIN_MOVE_INTERVAL_MS) return;
      lastMoveTime.set(socket.id, now);

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
      // Cancel any pending grace period
      const timer = disconnectTimers.get(socket.id);
      if (timer) { clearTimeout(timer); disconnectTimers.delete(socket.id); }
      leaveRoom(socket.id);
    });

    socket.on('disconnect', () => {
      pendingInvites.delete(socket.id);
      lastMoveTime.delete(socket.id);

      if (socketToRoom.has(socket.id)) {
        // Start grace period before kicking the opponent
        const timer = setTimeout(() => {
          disconnectTimers.delete(socket.id);
          leaveRoom(socket.id);
          users.delete(socket.id);
          broadcastLobby();
        }, GRACE_PERIOD_MS);
        disconnectTimers.set(socket.id, timer);
        // Remove from lobby immediately but keep in room
        users.delete(socket.id);
        broadcastLobby();
      } else {
        users.delete(socket.id);
        broadcastLobby();
      }
    });
  });
}

function attachZeeslagNamespace(ioOrNamespace) {
  const io = ioOrNamespace;
  const {
    initBoard,
    getLegalMoves,
    applyMove,
    moveMatches,
    getRequiredShips,
    P1,
    P2,
  } = zeeslagGame;

  function serializeBoard(board) {
    return {
      ships: board.ships,
      shots: Array.from(board.shots),
      hits: Array.from(board.hits),
    };
  }

  const users = new Map();
  const pendingInvites = new Map();
  const rooms = new Map();
  const socketToRoom = new Map();
  const disconnectTimers = new Map();
  const lastMoveTime = new Map();

  function getLobbyList() {
    return Array.from(users.entries()).map(([id, u]) => ({ id, name: u.name }));
  }

  function broadcastLobby() {
    io.emit('lobby', getLobbyList());
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

  setInterval(() => {
    const now = Date.now();
    for (const [targetId, invite] of pendingInvites.entries()) {
      if (now - invite.timestamp > INVITE_TIMEOUT_MS) {
        pendingInvites.delete(targetId);
      }
    }
  }, INVITE_CLEANUP_INTERVAL_MS);

  io.on('connection', (socket) => {
    const existingTimer = disconnectTimers.get(socket.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      disconnectTimers.delete(socket.id);
    }

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
      pendingInvites.set(targetId, {
        inviterId: socket.id,
        inviterName: me.name,
        timestamp: Date.now(),
      });
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
      const player1Board = initBoard();
      const player2Board = initBoard();
      const room = {
        id: roomId,
        player1: { id: fromId, name: inviter.name },
        player2: { id: socket.id, name: users.get(socket.id).name },
        player1Board,
        player2Board,
        player1Ready: false,
        player2Ready: false,
        currentPlayer: P1,
        winner: null,
        chat: [],
      };
      rooms.set(roomId, room);
      socketToRoom.set(fromId, roomId);
      socketToRoom.set(socket.id, roomId);
      socket.join(roomId);
      const inviterSocket = io.sockets?.sockets?.get(fromId) ?? io.sockets?.get(fromId);
      if (inviterSocket) inviterSocket.join(roomId);

      io.to(fromId).emit('gameStart', {
        roomId,
        myBoard: serializeBoard(player1Board),
        youAre: P1,
        opponentName: room.player2.name,
        chat: [],
      });
      io.to(socket.id).emit('gameStart', {
        roomId,
        myBoard: serializeBoard(player2Board),
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
      // Per-socket rate limiting
      const now = Date.now();
      if (now - (lastMoveTime.get(socket.id) || 0) < MIN_MOVE_INTERVAL_MS) return;
      lastMoveTime.set(socket.id, now);

      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || room.winner != null) return;
      const youAre = room.player1.id === socket.id ? P1 : P2;
      const myBoard = youAre === P1 ? room.player1Board : room.player2Board;
      const opponentBoard = youAre === P1 ? room.player2Board : room.player1Board;

      // Placement fase
      if (!room.player1Ready || !room.player2Ready) {
        if (move.type === 'placeDone') {
          // Validate ship count and sizes match expected configuration
          const required = getRequiredShips(); // [5, 4, 3, 3, 2]
          if (!Array.isArray(move.ships) || move.ships.length !== required.length) return;
          const sortedLengths = move.ships.map(s => (Array.isArray(s) ? s.length : 0)).sort((a, b) => b - a);
          for (let i = 0; i < required.length; i++) {
            if (sortedLengths[i] !== required[i]) return;
          }

          if (youAre === P1) {
            room.player1Ready = true;
            room.player1Board = initBoard();
            room.player1Board.ships = move.ships.map((s) => s.map((c) => [c[0], c[1]]));
          } else {
            room.player2Ready = true;
            room.player2Board = initBoard();
            room.player2Board.ships = move.ships.map((s) => s.map((c) => [c[0], c[1]]));
          }
          io.to(room.player1.id).emit('gameState', {
            myBoard: serializeBoard(room.player1Board),
            opponentBoard: serializeBoard(room.player2Board),
            placementPhase: !room.player1Ready || !room.player2Ready,
            currentPlayer: room.currentPlayer,
            winner: room.winner,
          });
          io.to(room.player2.id).emit('gameState', {
            myBoard: serializeBoard(room.player2Board),
            opponentBoard: serializeBoard(room.player1Board),
            placementPhase: !room.player1Ready || !room.player2Ready,
            currentPlayer: room.currentPlayer,
            winner: room.winner,
          });
          return;
        }
        if (move.type === 'place') {
          const legal = getLegalMoves(myBoard, youAre, true);
          const valid = legal.find((m) => moveMatches(m, move));
          if (!valid) return;
          const updatedBoard = applyMove(myBoard, valid, youAre);
          if (youAre === P1) {
            room.player1Board = updatedBoard;
          } else {
            room.player2Board = updatedBoard;
          }
          io.to(room.player1.id).emit('gameState', {
            myBoard: serializeBoard(room.player1Board),
            opponentBoard: serializeBoard(room.player2Board),
            placementPhase: !room.player1Ready || !room.player2Ready,
            currentPlayer: room.currentPlayer,
            winner: room.winner,
          });
          io.to(room.player2.id).emit('gameState', {
            myBoard: serializeBoard(room.player2Board),
            opponentBoard: serializeBoard(room.player1Board),
            placementPhase: !room.player1Ready || !room.player2Ready,
            currentPlayer: room.currentPlayer,
            winner: room.winner,
          });
          return;
        }
        return;
      }

      // Shooting fase
      if (room.currentPlayer !== youAre) return;
      if (move.type !== 'shoot') return;

      const legal = getLegalMoves(opponentBoard, youAre, false);
      const valid = legal.find((m) => moveMatches(m, move));
      if (!valid) return;

      const updatedOpponentBoard = applyMove(opponentBoard, valid, youAre);
      if (youAre === P1) {
        room.player2Board = updatedOpponentBoard;
      } else {
        room.player1Board = updatedOpponentBoard;
      }

      const key = move.r + ',' + move.c;
      const isHit = updatedOpponentBoard.hits.has(key);

      const totalShipCells = updatedOpponentBoard.ships.reduce((sum, ship) => sum + ship.length, 0);
      if (updatedOpponentBoard.hits.size >= totalShipCells) {
        room.winner = youAre;
        room.currentPlayer = null;
      } else {
        room.currentPlayer = room.currentPlayer === P1 ? P2 : P1;
      }

      io.to(room.player1.id).emit('gameState', {
        myBoard: serializeBoard(room.player1Board),
        opponentBoard: serializeBoard(room.player2Board),
        placementPhase: false,
        currentPlayer: room.currentPlayer,
        winner: room.winner,
        lastShot: youAre === P1 ? { hit: isHit } : null,
      });
      io.to(room.player2.id).emit('gameState', {
        myBoard: serializeBoard(room.player2Board),
        opponentBoard: serializeBoard(room.player1Board),
        placementPhase: false,
        currentPlayer: room.currentPlayer,
        winner: room.winner,
        lastShot: youAre === P2 ? { hit: isHit } : null,
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
      const timer = disconnectTimers.get(socket.id);
      if (timer) { clearTimeout(timer); disconnectTimers.delete(socket.id); }
      leaveRoom(socket.id);
    });

    socket.on('disconnect', () => {
      pendingInvites.delete(socket.id);
      lastMoveTime.delete(socket.id);

      if (socketToRoom.has(socket.id)) {
        const timer = setTimeout(() => {
          disconnectTimers.delete(socket.id);
          leaveRoom(socket.id);
          users.delete(socket.id);
          broadcastLobby();
        }, GRACE_PERIOD_MS);
        disconnectTimers.set(socket.id, timer);
        users.delete(socket.id);
        broadcastLobby();
      } else {
        users.delete(socket.id);
        broadcastLobby();
      }
    });
  });
}

function attachRekenDuelNamespace(ioOrNamespace) {
  const io = ioOrNamespace;
  const {
    generateQuestion,
    P1,
    P2,
    POINTS_TO_WIN,
  } = rekenDuelGame;

  const users = new Map();
  const pendingInvites = new Map();
  const rooms = new Map();
  const socketToRoom = new Map();
  const disconnectTimers = new Map();

  function getLobbyList() {
    return Array.from(users.entries()).map(([id, u]) => ({ id, name: u.name }));
  }

  function broadcastLobby() {
    io.emit('lobby', getLobbyList());
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

  setInterval(() => {
    const now = Date.now();
    for (const [targetId, invite] of pendingInvites.entries()) {
      if (now - invite.timestamp > INVITE_TIMEOUT_MS) {
        pendingInvites.delete(targetId);
      }
    }
  }, INVITE_CLEANUP_INTERVAL_MS);

  io.on('connection', (socket) => {
    const existingTimer = disconnectTimers.get(socket.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      disconnectTimers.delete(socket.id);
    }

    socket.on('setName', (name) => {
      const safeName = String(name || '').trim().slice(0, 30) || 'Speler';
      users.set(socket.id, { name: safeName });
      socket.emit('setNameOk', { name: safeName });
      broadcastLobby();
    });

    socket.on('getLobby', () => {
      socket.emit('lobby', getLobbyList());
    });

    socket.on('invite', (data) => {
      const targetId = typeof data === 'object' && data.targetId ? data.targetId : data;
      const difficulty = typeof data === 'object' && data.difficulty ? data.difficulty : 'normal';
      const me = users.get(socket.id);
      if (!me || !targetId || targetId === socket.id) return;
      const target = users.get(targetId);
      if (!target) return;
      pendingInvites.set(targetId, {
        inviterId: socket.id,
        inviterName: me.name,
        difficulty: difficulty,
        timestamp: Date.now(),
      });
      io.to(targetId).emit('invite', { fromId: socket.id, fromName: me.name, difficulty: difficulty });
    });

    socket.on('acceptInvite', (data) => {
      const fromId = typeof data === 'object' && data.fromId ? data.fromId : data;
      const pending = pendingInvites.get(socket.id);
      if (!pending || pending.inviterId !== fromId) return;
      const difficulty = typeof data === 'object' && data.difficulty ? data.difficulty : (pending.difficulty || 'normal');
      pendingInvites.delete(socket.id);
      const inviter = users.get(fromId);
      if (!inviter) {
        socket.emit('inviteFailed', { reason: 'Speler niet meer online' });
        return;
      }
      const roomId = 'room-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      const room = {
        id: roomId,
        player1: { id: fromId, name: inviter.name },
        player2: { id: socket.id, name: users.get(socket.id).name },
        player1Score: 0,
        player2Score: 0,
        currentQuestion: null,
        currentAnswer: null,
        questionStartTime: null,
        difficulty: difficulty,
        winner: null,
        chat: [],
        waitingForAnswers: new Set(),
      };
      rooms.set(roomId, room);
      socketToRoom.set(fromId, roomId);
      socketToRoom.set(socket.id, roomId);
      socket.join(roomId);
      const inviterSocket = io.sockets?.sockets?.get(fromId) ?? io.sockets?.get(fromId);
      if (inviterSocket) inviterSocket.join(roomId);

      io.to(fromId).emit('gameStart', {
        roomId,
        youAre: P1,
        opponentName: room.player2.name,
        difficulty: room.difficulty,
        chat: [],
      });
      io.to(socket.id).emit('gameStart', {
        roomId,
        youAre: P2,
        opponentName: room.player1.name,
        difficulty: room.difficulty,
        chat: [],
      });
      const question = generateQuestion(room.difficulty);
      room.currentQuestion = question.question;
      room.currentAnswer = question.answer;
      room.questionStartTime = Date.now();
      room.waitingForAnswers = new Set([fromId, socket.id]);
      io.to(roomId).emit('gameState', {
        player1Score: 0,
        player2Score: 0,
        newQuestion: { question: question.question, answer: question.answer },
      });
    });

    socket.on('declineInvite', (fromId) => {
      pendingInvites.delete(socket.id);
      io.to(fromId).emit('inviteDeclined', { byId: socket.id });
    });

    socket.on('newQuestion', () => {
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || room.winner != null) return;
      const youAre = room.player1.id === socket.id ? P1 : P2;
      if (youAre !== P1) return;
      const question = generateQuestion(room.difficulty);
      room.currentQuestion = question.question;
      room.currentAnswer = question.answer;
      room.questionStartTime = Date.now();
      room.waitingForAnswers = new Set([room.player1.id, room.player2.id]);
      io.to(roomId).emit('gameState', {
        newQuestion: { question: question.question, answer: question.answer },
      });
    });

    socket.on('nextQuestion', () => {
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || room.winner != null) return;
      const question = generateQuestion(room.difficulty);
      room.currentQuestion = question.question;
      room.currentAnswer = question.answer;
      room.questionStartTime = Date.now();
      room.waitingForAnswers = new Set([room.player1.id, room.player2.id]);
      io.to(roomId).emit('gameState', {
        newQuestion: { question: question.question, answer: question.answer },
      });
    });

    socket.on('answer', (data) => {
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || room.winner != null) return;
      if (!room.waitingForAnswers.has(socket.id)) return;
      const youAre = room.player1.id === socket.id ? P1 : P2;
      const answer = parseInt(data.answer, 10);
      const correct = answer === room.currentAnswer;
      room.waitingForAnswers.delete(socket.id);
      if (correct) {
        if (youAre === P1) {
          room.player1Score++;
        } else {
          room.player2Score++;
        }
        if (room.player1Score >= POINTS_TO_WIN) {
          room.winner = P1;
        } else if (room.player2Score >= POINTS_TO_WIN) {
          room.winner = P2;
        }
        io.to(roomId).emit('gameState', {
          player1Score: room.player1Score,
          player2Score: room.player2Score,
          answerResult: { correct: true, scored: true, player: youAre },
          winner: room.winner,
        });
      } else {
        io.to(socket.id).emit('gameState', {
          answerResult: { correct: false, scored: false },
        });
      }
      if (room.waitingForAnswers.size === 0 || correct) {
        if (!room.winner) {
          setTimeout(() => {
            const currentRoom = rooms.get(roomId);
            if (currentRoom && !currentRoom.winner) {
              const nextQuestion = generateQuestion(currentRoom.difficulty);
              currentRoom.currentQuestion = nextQuestion.question;
              currentRoom.currentAnswer = nextQuestion.answer;
              currentRoom.questionStartTime = Date.now();
              currentRoom.waitingForAnswers = new Set([currentRoom.player1.id, currentRoom.player2.id]);
              io.to(roomId).emit('gameState', {
                newQuestion: { question: nextQuestion.question, answer: nextQuestion.answer },
              });
            }
          }, 1500);
        }
      }
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
      const timer = disconnectTimers.get(socket.id);
      if (timer) { clearTimeout(timer); disconnectTimers.delete(socket.id); }
      leaveRoom(socket.id);
    });

    socket.on('disconnect', () => {
      pendingInvites.delete(socket.id);

      if (socketToRoom.has(socket.id)) {
        const timer = setTimeout(() => {
          disconnectTimers.delete(socket.id);
          leaveRoom(socket.id);
          users.delete(socket.id);
          broadcastLobby();
        }, GRACE_PERIOD_MS);
        disconnectTimers.set(socket.id, timer);
        users.delete(socket.id);
        broadcastLobby();
      } else {
        users.delete(socket.id);
        broadcastLobby();
      }
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
  attachZeeslagNamespace(io.of('/zeeslag'));
  attachRekenDuelNamespace(io.of('/reken-duel'));

  return io;
}

module.exports = { attachSockets };
