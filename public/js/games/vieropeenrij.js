/**
 * 4 op een rij – 1 vs 1, 1 vs computer, of multiplayer. Zelfde flow als dammen.
 */
(function () {
  const CLASS_ID = 'vieropeenrij';
  const area = document.getElementById('game-area');
  if (area) area.classList.add('vieropeenrij-game');
  const leaderboardEl = document.getElementById('leaderboard');
  const COLS = 7;
  const ROWS = 6;
  const P1 = 1;
  const P2 = 2;
  const AI_DEPTHS = { easy: 1, normal: 4, hard: 6 };

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  let board = [];
  let currentPlayer = P1;
  let mode = null;
  let step = null;
  let aiDepth = AI_DEPTHS.normal;
  let aiDifficulty = 'normal';
  let moveCount = 0;
  let gameOver = false;
  let winner = null;
  let thinking = false;
  let socket = null;
  let myName = '';
  let mySide = null;
  let opponentName = '';
  let roomId = null;
  let chatMessages = [];
  let lobbyList = [];
  let pendingInviteFrom = null;

  function setupSocketListeners() {
    if (!socket) return;
    socket.on('setNameOk', function () { socket.emit('getLobby'); render(); });
    socket.on('lobby', function (list) { lobbyList = list || []; render(); });
    socket.on('invite', function (data) {
      pendingInviteFrom = { fromId: data.fromId, fromName: data.fromName || 'Speler' };
      render();
    });
    socket.on('gameStart', function (data) {
      roomId = data.roomId;
      board = data.board || initBoard();
      mySide = data.youAre;
      opponentName = data.opponentName || 'Tegenstander';
      chatMessages = data.chat || [];
      currentPlayer = P1;
      winner = null;
      gameOver = false;
      step = 'play';
      render();
    });
    socket.on('gameState', function (data) {
      board = data.board || board;
      currentPlayer = data.currentPlayer;
      winner = data.winner != null ? data.winner : null;
      gameOver = winner !== null;
      render();
    });
    socket.on('chat', function (msg) { chatMessages.push(msg); render(); });
    socket.on('opponentLeft', function () {
      roomId = null; step = 'mp-lobby'; opponentName = ''; mySide = null; chatMessages = [];
      render();
    });
    socket.on('youLeftRoom', function () { roomId = null; step = 'mp-lobby'; render(); });
    socket.on('inviteFailed', function () { pendingInviteFrom = null; render(); });
    socket.on('inviteDeclined', function () { pendingInviteFrom = null; render(); });
  }

  function initBoard() {
    var b = [];
    for (var r = 0; r < ROWS; r++) {
      var row = [];
      for (var c = 0; c < COLS; c++) row.push(null);
      b.push(row);
    }
    return b;
  }

  function getLegalMoves(b) {
    var moves = [];
    for (var c = 0; c < COLS; c++) {
      if (b[0][c] === null) moves.push(c);
    }
    return moves;
  }

  function dropInColumn(b, col, player) {
    for (var r = ROWS - 1; r >= 0; r--) {
      if (b[r][col] === null) {
        var next = b.map(function (row, ri) {
          return row.map(function (cell, ci) {
            return ri === r && ci === col ? player : cell;
          });
        });
        return next;
      }
    }
    return null;
  }

  function countLine(b, r, c, dr, dc, player) {
    var n = 0;
    while (r >= 0 && r < ROWS && c >= 0 && c < COLS && b[r][c] === player) {
      n++;
      r += dr;
      c += dc;
    }
    return n;
  }

  function checkWinner(b) {
    var dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var p = b[r][c];
        if (!p) continue;
        for (var i = 0; i < dirs.length; i++) {
          var dr = dirs[i][0], dc = dirs[i][1];
          var n1 = countLine(b, r, c, dr, dc, p);
          var n2 = countLine(b, r - dr, c - dc, -dr, -dc, p);
          var n = n1 + (n2 > 0 ? n2 - 1 : 0);
          if (n >= 4) return p;
        }
      }
    }
    if (b[0].every(function (cell) { return cell != null; })) return 0;
    return null;
  }

  function applyMove(b, col, player) {
    if (col < 0 || col >= COLS || b[0][col] !== null) return null;
    return dropInColumn(b, col, player);
  }

  function evalBoard(b, forPlayer) {
    var score = 0;
    var dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        for (var d = 0; d < dirs.length; d++) {
          var na = countLine(b, r, c, dirs[d][0], dirs[d][1], forPlayer);
          var nb = countLine(b, r - dirs[d][0], c - dirs[d][1], -dirs[d][0], -dirs[d][1], forPlayer);
          var n = na + (nb > 0 ? nb - 1 : 0);
          if (n >= 4) return 1000;
          if (n === 3) score += 10;
          if (n === 2) score += 2;
        }
        for (var d2 = 0; d2 < dirs.length; d2++) {
          var other = forPlayer === P1 ? P2 : P1;
          var na2 = countLine(b, r, c, dirs[d2][0], dirs[d2][1], other);
          var nb2 = countLine(b, r - dirs[d2][0], c - dirs[d2][1], -dirs[d2][0], -dirs[d2][1], other);
          var n2 = na2 + (nb2 > 0 ? nb2 - 1 : 0);
          if (n2 >= 4) return -1000;
          if (n2 === 3) score -= 8;
        }
      }
    }
    return score;
  }

  function minimax(b, depth, player, alpha, beta, maximizing) {
    var w = checkWinner(b);
    if (w === P1) return maximizing ? -1000 : 1000;
    if (w === P2) return maximizing ? 1000 : -1000;
    if (w === 0) return 0;
    if (depth <= 0) return evalBoard(b, P2);
    var moves = getLegalMoves(b);
    if (moves.length === 0) return 0;
    if (maximizing) {
      var best = -Infinity;
      for (var i = 0; i < moves.length; i++) {
        var nb = applyMove(b, moves[i], P2);
        var val = minimax(nb, depth - 1, P1, alpha, beta, false);
        if (val > best) best = val;
        if (best > alpha) alpha = best;
        if (beta <= alpha) break;
      }
      return best;
    } else {
      var worst = Infinity;
      for (var j = 0; j < moves.length; j++) {
        var nb2 = applyMove(b, moves[j], P1);
        var val2 = minimax(nb2, depth - 1, P2, alpha, beta, true);
        if (val2 < worst) worst = val2;
        if (worst < beta) beta = worst;
        if (beta <= alpha) break;
      }
      return worst;
    }
  }

  function computeVieropeenrijScore() {
    var base = 10;
    var diffBonus = (aiDifficulty === 'easy' ? 5 : aiDifficulty === 'hard' ? 25 : 15);
    var minMoves = 7;
    var speedBonus = Math.max(0, (42 - moveCount) * 1.2);
    return Math.round(base + diffBonus + speedBonus);
  }

  function getAIMove() {
    var moves = getLegalMoves(board);
    if (!moves.length) return null;
    if (aiDifficulty === 'easy' && Math.random() < 0.45) {
      return moves[Math.floor(Math.random() * moves.length)];
    }
    var best = -Infinity;
    var bestCol = moves[0];
    for (var i = 0; i < moves.length; i++) {
      var nb = applyMove(board, moves[i], P2);
      var score = minimax(nb, aiDepth - 1, P1, -Infinity, Infinity, false);
      if (score > best) { best = score; bestCol = moves[i]; }
    }
    return bestCol;
  }

  function doMove(col) {
    moveCount++;
    board = applyMove(board, col, currentPlayer);
    winner = checkWinner(board);
    if (winner !== null) {
      gameOver = true;
      render();
      if (mode === '1vAI' && leaderboardEl && winner === P1) {
        var score = computeVieropeenrijScore();
        window.Leaderboard.showSubmitForm(CLASS_ID, score, function () {
          if (window.Leaderboard && leaderboardEl) window.Leaderboard.render(leaderboardEl, CLASS_ID);
        });
      }
      return;
    }
    currentPlayer = currentPlayer === P1 ? P2 : P1;
    render();
    if (mode === '1vAI' && currentPlayer === P2 && !gameOver) {
      thinking = true;
      render();
      setTimeout(function () {
        var aiCol = getAIMove();
        if (aiCol !== null) doMove(aiCol);
        thinking = false;
        render();
      }, 400);
    }
  }

  function onColumnClick(col) {
    if (gameOver || thinking) return;
    if (mode === 'multiplayer' && currentPlayer !== mySide) return;
    if (board[0][col] !== null) return;
    if (mode === 'multiplayer' && socket) {
      socket.emit('move', { col: col });
      render();
    } else {
      doMove(col);
    }
  }

  function renderBoard() {
    var html = '<div class="vieropeenrij-board">';
    for (var c = 0; c < COLS; c++) {
      var colFull = board[0][c] !== null;
      var canClick = !gameOver && !thinking && !colFull && (mode !== 'multiplayer' || currentPlayer === mySide);
      var colCls = 'vieropeenrij-col' + (canClick ? '' : ' vieropeenrij-col-disabled');
      html += '<div class="' + colCls + '" data-col="' + c + '" role="button" tabindex="' + (canClick ? '0' : '-1') + '" aria-label="Kolom ' + (c + 1) + (colFull ? ', vol' : ', klik om te gooien') + '">';
      for (var r = 0; r < ROWS; r++) {
        var cell = board[r][c];
        var cls = 'vieropeenrij-cell';
        if (cell === P1) cls += ' vieropeenrij-p1';
        if (cell === P2) cls += ' vieropeenrij-p2';
        html += '<div class="' + cls + '" data-r="' + r + '" data-c="' + c + '"></div>';
      }
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function render() {
    if (mode === null) {
      var guidance = window.RegenboogCore && window.RegenboogCore.introGuidance && window.RegenboogCore.introGuidance.vieropeenrij;
      var cardLines = '';
      if (guidance && guidance.length) {
        cardLines = '<p><strong>Hoe te spelen:</strong></p><ul>' +
          guidance.map(function (line) { return '<li class="core-intro-step">🔴 ' + escapeHtml(line) + '</li>'; }).join('') + '</ul>';
      } else {
        cardLines = '<p><strong>Hoe te spelen:</strong></p><ul><li class="core-intro-step">🔴 Laat stenen vallen in een kolom.</li><li class="core-intro-step">🔵 Vier op een rij wint.</li></ul>';
      }
      area.innerHTML =
        '<div class="core-intro">' +
        '  <h3 class="core-intro-title">4 op een rij</h3>' +
        '  <p class="core-intro-subtitle">Maak vier op een rij: horizontaal, verticaal of diagonaal.</p>' +
        '  <div class="core-intro-card">' + cardLines + '</div>' +
        '  <div class="core-intro-actions dammen-mode-actions">' +
        '    <p class="dammen-choose-mode">Kies hoe je wilt spelen:</p>' +
        '    <div class="dammen-mode-buttons">' +
        '      <button type="button" class="dammen-mode-btn" data-mode="1v1">1 tegen 1 (op dezelfde computer)</button>' +
        '      <button type="button" class="dammen-mode-btn" data-mode="1vAI">1 tegen computer</button>' +
        '      <button type="button" class="dammen-mode-btn" data-mode="multiplayer">1 tegen 1 (over internet)</button>' +
        '    </div>' +
        '  </div>' +
        '</div>';
      area.querySelectorAll('.dammen-mode-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          mode = btn.getAttribute('data-mode');
          if (mode === '1v1') {
            step = 'play';
            board = initBoard();
            currentPlayer = P1;
            gameOver = false;
            winner = null;
            thinking = false;
          } else if (mode === 'multiplayer') step = 'mp-name';
          else step = 'difficulty';
          render();
        });
      });
      if (window.Leaderboard && leaderboardEl) window.Leaderboard.render(leaderboardEl, CLASS_ID);
      return;
    }

    if (mode === 'multiplayer' && step === 'mp-name') {
      area.innerHTML =
        '<p class="dammen-instruction">Voer je naam in voor de speelzaal.</p>' +
        '<div class="dammen-name-form">' +
        '<input type="text" id="dammen-player-name" class="dammen-name-input" placeholder="Jouw naam" maxlength="30" value="' + (myName ? myName.replace(/"/g, '&quot;') : '') + '">' +
        '<button type="button" class="dammen-mode-btn" id="dammen-name-ok">Ga naar speelzaal</button>' +
        '</div>' +
        '<button type="button" class="dammen-back" id="dammen-mp-back">Terug</button>';
      document.getElementById('dammen-name-ok').addEventListener('click', function () {
        var input = document.getElementById('dammen-player-name');
        myName = input && input.value ? input.value.trim().slice(0, 30) : '';
        if (!myName) myName = 'Speler';
        step = 'mp-lobby';
        if (socket) socket.disconnect();
        socket = (typeof io !== 'undefined' && io) ? io('/vieropeenrij') : null;
        if (!socket) { step = 'mp-name'; render(); return; }
        setupSocketListeners();
        socket.emit('setName', myName);
        render();
      });
      document.getElementById('dammen-mp-back').addEventListener('click', function () {
        mode = null; step = null;
        if (socket) { socket.disconnect(); socket = null; }
        render();
      });
      return;
    }

    if (mode === 'multiplayer' && step === 'mp-lobby') {
      var listHtml = lobbyList.filter(function (u) { return u.id !== (socket && socket.id) && u.name; }).map(function (u) {
        return '<div class="dammen-lobby-user"><span class="dammen-lobby-name">' + escapeHtml(u.name) + '</span><button type="button" class="dammen-invite-btn" data-id="' + escapeHtml(u.id) + '">Nodig uit</button></div>';
      }).join('') || '<p class="dammen-lobby-empty">Niemand anders online.</p>';
      var inviteHtml = pendingInviteFrom
        ? '<div class="dammen-invite-overlay"><p>' + escapeHtml(pendingInviteFrom.fromName) + ' nodigt je uit.</p><button type="button" class="dammen-accept-btn" id="dammen-accept">Accepteer</button><button type="button" class="dammen-decline-btn" id="dammen-decline">Weiger</button></div>' : '';
      area.innerHTML = '<p class="dammen-instruction">Speelzaal</p><div class="dammen-lobby-list">' + listHtml + '</div>' + inviteHtml + '<button type="button" class="dammen-back" id="dammen-lobby-back">Terug</button>';
      area.querySelectorAll('.dammen-invite-btn').forEach(function (btn) {
        btn.addEventListener('click', function () { var id = btn.getAttribute('data-id'); if (socket && id) socket.emit('invite', id); });
      });
      if (pendingInviteFrom) {
        document.getElementById('dammen-accept').addEventListener('click', function () {
          if (socket && pendingInviteFrom) socket.emit('acceptInvite', pendingInviteFrom.fromId);
          pendingInviteFrom = null;
        });
        document.getElementById('dammen-decline').addEventListener('click', function () {
          if (socket && pendingInviteFrom) socket.emit('declineInvite', pendingInviteFrom.fromId);
          pendingInviteFrom = null;
          render();
        });
      }
      document.getElementById('dammen-lobby-back').addEventListener('click', function () {
        step = 'mp-name';
        if (socket) { socket.disconnect(); socket = null; }
        lobbyList = []; pendingInviteFrom = null;
        render();
      });
      return;
    }

    if (mode === '1vAI' && step === 'difficulty') {
      area.innerHTML =
        '<p class="dammen-instruction">Kies de moeilijkheid.</p>' +
        '<div class="dammen-difficulty-buttons">' +
        '<button type="button" class="dammen-difficulty-btn" data-diff="easy">Makkelijk</button>' +
        '<button type="button" class="dammen-difficulty-btn" data-diff="normal">Normaal</button>' +
        '<button type="button" class="dammen-difficulty-btn" data-diff="hard">Moeilijk</button>' +
        '</div><button type="button" class="dammen-back" id="dammen-diff-back">Terug</button>';
      area.querySelectorAll('.dammen-difficulty-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var d = btn.getAttribute('data-diff');
          aiDepth = AI_DEPTHS[d] || AI_DEPTHS.normal;
          aiDifficulty = (d === 'easy' || d === 'hard') ? d : 'normal';
          step = 'play';
          board = initBoard();
          currentPlayer = P1;
          moveCount = 0;
          gameOver = false;
          winner = null;
          thinking = false;
          render();
        });
      });
      document.getElementById('dammen-diff-back').addEventListener('click', function () { mode = null; step = null; render(); });
      return;
    }

    var turnText = gameOver
      ? (winner === 0 ? 'Gelijkspel!' : (winner === P1 ? 'Rood wint!' : 'Blauw wint!'))
      : thinking ? 'Computer denkt…'
      : mode === '1vAI' && currentPlayer === P2 ? 'Computer is aan zet'
      : mode === 'multiplayer'
        ? (currentPlayer === mySide ? 'Jij bent aan zet' : opponentName + ' is aan zet')
        : (currentPlayer === P1 ? 'Rood aan zet' : 'Blauw aan zet');
    if (gameOver && mode === 'multiplayer' && winner === mySide) turnText = 'Jij wint!';
    if (gameOver && mode === 'multiplayer' && winner !== null && winner !== 0 && winner !== mySide) turnText = opponentName + ' wint!';

    var chatHtml = '';
    if (mode === 'multiplayer') {
      var chatList = chatMessages.map(function (msg) { return '<div class="dammen-chat-msg"><strong>' + escapeHtml(msg.name) + '</strong>: ' + escapeHtml(msg.text) + '</div>'; }).join('');
      chatHtml = '<div class="dammen-chat-panel"><div class="dammen-chat-title">Chat – ' + escapeHtml(opponentName) + '</div><div class="dammen-chat-messages" id="dammen-chat-msgs">' + chatList + '</div><div class="dammen-chat-input-wrap"><input type="text" class="dammen-chat-input" id="dammen-chat-input" placeholder="Bericht…" maxlength="500"><button type="button" class="dammen-chat-send" id="dammen-chat-send">Verstuur</button></div></div>';
    }

    area.innerHTML =
      '<p class="dammen-instruction">' + turnText + '</p>' +
      '<div class="dammen-play-wrap"><div class="dammen-board-wrap">' + renderBoard() + '</div>' + chatHtml + '</div>' +
      '<div class="dammen-actions">' +
      (mode === 'multiplayer' ? '<button type="button" class="dammen-back" id="dammen-leave-room">Verlaat spel</button>' : '<button type="button" class="dammen-again" id="dammen-new">Nieuw spel</button><button type="button" class="dammen-back" id="dammen-back">Andere spelmodus</button>') +
      '</div>';

    area.querySelectorAll('.vieropeenrij-col').forEach(function (colEl) {
      if (colEl.classList.contains('vieropeenrij-col-disabled')) return;
      colEl.addEventListener('click', function () {
        var col = parseInt(colEl.getAttribute('data-col'), 10);
        onColumnClick(col);
      });
      colEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); colEl.click(); }
      });
    });

    if (mode === 'multiplayer') {
      var leaveBtn = document.getElementById('dammen-leave-room');
      if (leaveBtn) leaveBtn.addEventListener('click', function () {
        if (socket) socket.emit('leaveRoom');
        roomId = null; step = 'mp-lobby'; opponentName = ''; mySide = null; chatMessages = [];
        render();
      });
      var chatIn = document.getElementById('dammen-chat-input');
      var chatSend = document.getElementById('dammen-chat-send');
      var chatMsgs = document.getElementById('dammen-chat-msgs');
      if (chatSend && chatIn && socket) {
        function sendChat() { var t = chatIn.value.trim(); if (t) { socket.emit('chat', t); chatIn.value = ''; } }
        chatSend.addEventListener('click', sendChat);
        chatIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') sendChat(); });
      }
      if (chatMsgs) chatMsgs.scrollTop = chatMsgs.scrollHeight;
    } else {
      document.getElementById('dammen-new').addEventListener('click', function () {
        board = initBoard();
        currentPlayer = P1;
        moveCount = 0;
        gameOver = false;
        winner = null;
        thinking = false;
        render();
      });
      document.getElementById('dammen-back').addEventListener('click', function () { mode = null; step = null; render(); });
    }
  }

  render();
  if (window.Leaderboard && leaderboardEl) window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
