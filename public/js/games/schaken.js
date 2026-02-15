/**
 * Schaken – 1 vs 1, 1 vs computer, of multiplayer. Zelfde flow als dammen.
 */
(function () {
  const CLASS_ID = 'schaken';
  const area = document.getElementById('game-area');
  if (area) area.classList.add('schaken-game');
  const leaderboardEl = document.getElementById('leaderboard');
  const SIZE = 8;
  const P1 = 1;
  const P2 = 2;
  const AI_DEPTHS = { easy: 1, normal: 2, hard: 3 };

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  let board = [];
  let currentPlayer = P1;
  let selected = null;
  let validMoves = [];
  let mode = null;
  let step = null;
  let aiDepth = AI_DEPTHS.normal;
  let aiDifficulty = 'normal';
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

  function initBoard() {
    var b = [];
    for (var r = 0; r < SIZE; r++) {
      var row = [];
      for (var c = 0; c < SIZE; c++) row.push(null);
      b.push(row);
    }
    function back(color, row) {
      b[row][0] = { color: color, piece: 'R' }; b[row][1] = { color: color, piece: 'N' };
      b[row][2] = { color: color, piece: 'B' }; b[row][3] = { color: color, piece: 'Q' };
      b[row][4] = { color: color, piece: 'K' }; b[row][5] = { color: color, piece: 'B' };
      b[row][6] = { color: color, piece: 'N' }; b[row][7] = { color: color, piece: 'R' };
      var pr = row + (color === P1 ? -1 : 1);
      for (var c = 0; c < 8; c++) b[pr][c] = { color: color, piece: 'P' };
    }
    back(P2, 0);
    back(P1, 7);
    return b;
  }

  function cloneBoard(b) {
    return b.map(function (row) {
      return row.map(function (c) { return c ? { color: c.color, piece: c.piece } : null; });
    });
  }

  function getKingPos(b, color) {
    for (var r = 0; r < SIZE; r++)
      for (var c = 0; c < SIZE; c++)
        if (b[r][c] && b[r][c].color === color && b[r][c].piece === 'K') return [r, c];
    return null;
  }

  function getPieceCounts(b) {
    var p1 = 0, p2 = 0;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var piece = b[r][c];
        if (!piece) continue;
        if (piece.color === P1) p1++; else p2++;
      }
    }
    return { p1: p1, p2: p2 };
  }

  function computeSchakenScore() {
    var counts = getPieceCounts(board);
    var margin = Math.max(0, counts.p1 - counts.p2);
    var base = 10;
    var diffBonus = (aiDifficulty === 'easy' ? 5 : aiDifficulty === 'hard' ? 25 : 15);
    var marginBonus = margin * 2;
    return Math.round(base + diffBonus + marginBonus);
  }

  function attacked(b, r, c, byColor) {
    function at(rr, cc) {
      return rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE ? b[rr][cc] : null;
    }
    var d = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
    for (var i = 0; i < d.length; i++) {
      var rr = r + d[i][0], cc = c + d[i][1];
      var p = at(rr, cc);
      if (p && p.color === byColor && p.piece === 'K') return true;
      for (var s = 1; s < SIZE; s++) {
        rr = r + d[i][0] * s; cc = c + d[i][1] * s;
        if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) break;
        p = at(rr, cc);
        if (p) {
          if (p.color !== byColor) break;
          if (p.piece === 'Q' || p.piece === 'R') { if (d[i][0] === 0 || d[i][1] === 0) return true; break; }
          if (p.piece === 'B') { if (d[i][0] !== 0 && d[i][1] !== 0) return true; break; }
          break;
        }
      }
    }
    var kn = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (var j = 0; j < kn.length; j++) {
      var p = at(r + kn[j][0], c + kn[j][1]);
      if (p && p.color === byColor && p.piece === 'N') return true;
    }
    var pw = byColor === P1 ? -1 : 1;
    if (at(r + pw, c - 1) && at(r + pw, c - 1).color === byColor && at(r + pw, c - 1).piece === 'P') return true;
    if (at(r + pw, c + 1) && at(r + pw, c + 1).color === byColor && at(r + pw, c + 1).piece === 'P') return true;
    return false;
  }

  function inCheck(b, color) {
    var k = getKingPos(b, color);
    if (!k) return false;
    return attacked(b, k[0], k[1], color === P1 ? P2 : P1);
  }

  function rawMoves(b, r, c) {
    var piece = b[r][c];
    if (!piece) return [];
    var color = piece.color;
    var other = color === P1 ? P2 : P1;
    var moves = [];
    function add(rr, cc, capOk) {
      if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) return;
      var p = b[rr][cc];
      if (!p) { moves.push([rr, cc]); return; }
      if (p.color === other && capOk) moves.push([rr, cc]);
    }
    function slide(dr, dc) {
      for (var s = 1; s < SIZE; s++) {
        var rr = r + dr * s, cc = c + dc * s;
        if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) break;
        var p = b[rr][cc];
        if (!p) { moves.push([rr, cc]); continue; }
        if (p.color === other) moves.push([rr, cc]);
        break;
      }
    }
    switch (piece.piece) {
      case 'K':
        for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) if (dr || dc) add(r + dr, c + dc, true);
        break;
      case 'Q':
        for (var d1 = -1; d1 <= 1; d1++) for (var d2 = -1; d2 <= 1; d2++) if (d1 || d2) slide(d1, d2);
        break;
      case 'R':
        slide(-1, 0); slide(1, 0); slide(0, -1); slide(0, 1);
        break;
      case 'B':
        slide(-1, -1); slide(-1, 1); slide(1, -1); slide(1, 1);
        break;
      case 'N':
        var kn = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        for (var k = 0; k < kn.length; k++) add(r + kn[k][0], c + kn[k][1], true);
        break;
      case 'P':
        var fw = color === P1 ? -1 : 1;
        if (!b[r + fw][c]) {
          moves.push([r + fw, c]);
          if ((color === P1 && r === 6) || (color === P2 && r === 1)) {
            if (!b[r + 2 * fw][c]) moves.push([r + 2 * fw, c]);
          }
        }
        for (var dc = -1; dc <= 1; dc += 2) {
          if (c + dc >= 0 && c + dc < SIZE && b[r + fw] && b[r + fw][c + dc] && b[r + fw][c + dc].color === other)
            moves.push([r + fw, c + dc]);
        }
        break;
    }
    return moves;
  }

  function getLegalMoves(b, color) {
    var out = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var p = b[r][c];
        if (!p || p.color !== color) continue;
        var dests = rawMoves(b, r, c);
        for (var i = 0; i < dests.length; i++) {
          var toR = dests[i][0], toC = dests[i][1];
          var next = cloneBoard(b);
          next[toR][toC] = next[r][c];
          next[r][c] = null;
          if (next[toR][toC].piece === 'P' && (toR === 0 || toR === 7)) next[toR][toC] = { color: color, piece: 'Q' };
          if (!inCheck(next, color)) out.push({ fromR: r, fromC: c, toR: toR, toC: toC });
        }
      }
    }
    return out;
  }

  function applyMove(b, move) {
    var next = cloneBoard(b);
    next[move.toR][move.toC] = next[move.fromR][move.fromC];
    next[move.fromR][move.fromC] = null;
    if (next[move.toR][move.toC].piece === 'P' && (move.toR === 0 || move.toR === 7))
      next[move.toR][move.toC] = { color: next[move.toR][move.toC].color, piece: 'Q' };
    return next;
  }

  function checkWinner(b, cur) {
    if (!getKingPos(b, cur)) return cur === P1 ? P2 : P1;
    var moves = getLegalMoves(b, cur);
    var checked = inCheck(b, cur);
    if (moves.length === 0) return checked ? (cur === P1 ? P2 : P1) : 0;
    return null;
  }

  function moveMatches(a, b) {
    return a.fromR === b.fromR && a.fromC === b.fromC && a.toR === b.toR && a.toC === b.toC;
  }

  var PIECE_VAL = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
  function evalBoard(b, forPlayer) {
    var score = 0;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var p = b[r][c];
        if (!p) continue;
        var v = PIECE_VAL[p.piece] || 0;
        if (p.color === forPlayer) score += v; else score -= v;
      }
    }
    return score;
  }

  function getAIMove() {
    var moves = getLegalMoves(board, P2);
    if (!moves.length) return null;
    if (aiDifficulty === 'easy' && Math.random() < 0.45) {
      return moves[Math.floor(Math.random() * moves.length)];
    }
    var best = -Infinity;
    var bestMove = moves[0];
    for (var i = 0; i < moves.length; i++) {
      var nb = applyMove(board, moves[i]);
      var score = minimax(nb, aiDepth - 1, P1, -Infinity, Infinity, false);
      if (score > best) { best = score; bestMove = moves[i]; }
    }
    return bestMove;
  }

  function minimax(b, depth, player, alpha, beta, maximizing) {
    var w = checkWinner(b, player);
    if (w === P1) return maximizing ? -1000 : 1000;
    if (w === P2) return maximizing ? 1000 : -1000;
    if (w === 0) return 0;
    if (depth <= 0) return evalBoard(b, P2);
    var moves = getLegalMoves(b, player);
    if (moves.length === 0) return minimax(b, depth - 1, player === P1 ? P2 : P1, alpha, beta, !maximizing);
    if (maximizing) {
      var best = -Infinity;
      for (var i = 0; i < moves.length; i++) {
        var val = minimax(applyMove(b, moves[i]), depth - 1, P1, alpha, beta, false);
        if (val > best) best = val;
        if (best > alpha) alpha = best;
        if (beta <= alpha) break;
      }
      return best;
    } else {
      var worst = Infinity;
      for (var j = 0; j < moves.length; j++) {
        var v2 = minimax(applyMove(b, moves[j]), depth - 1, P2, alpha, beta, true);
        if (v2 < worst) worst = v2;
        if (worst < beta) beta = worst;
        if (beta <= alpha) break;
      }
      return worst;
    }
  }

  function doMove(move) {
    board = applyMove(board, move);
    var nextToMove = currentPlayer === P1 ? P2 : P1;
    winner = checkWinner(board, nextToMove);
    if (winner !== null) {
      gameOver = true;
      render();
      if (mode === '1vAI' && leaderboardEl && winner === P1) {
        var score = computeSchakenScore();
        window.Leaderboard.showSubmitForm(CLASS_ID, score, function () {
          if (window.Leaderboard && leaderboardEl) window.Leaderboard.render(leaderboardEl, CLASS_ID);
        });
      }
      return;
    }
    currentPlayer = currentPlayer === P1 ? P2 : P1;
    selected = null;
    validMoves = [];
    render();
    if (mode === '1vAI' && currentPlayer === P2 && !gameOver) {
      thinking = true;
      render();
      setTimeout(function () {
        var aiMove = getAIMove();
        if (aiMove) doMove(aiMove);
        thinking = false;
        render();
      }, 400);
    }
  }

  function onCellClick(r, c) {
    if (gameOver || thinking) return;
    if (mode === 'multiplayer' && currentPlayer !== mySide) return;
    var i, m;
    for (i = 0; i < validMoves.length; i++) {
      m = validMoves[i];
      if (m.toR === r && m.toC === c) {
        if (mode === 'multiplayer' && socket) {
          socket.emit('move', m);
          selected = null;
          validMoves = [];
          render();
        } else {
          doMove(m);
        }
        return;
      }
    }
    var piece = board[r][c];
    if (!piece || piece.color !== currentPlayer) {
      selected = null;
      validMoves = [];
      render();
      return;
    }
    selected = { r: r, c: c };
    var all = getLegalMoves(board, currentPlayer);
    validMoves = [];
    for (i = 0; i < all.length; i++) {
      if (all[i].fromR === r && all[i].fromC === c) validMoves.push(all[i]);
    }
    render();
  }

  function renderBoard() {
    var html = '<div class="schaken-board">';
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var light = (r + c) % 2 === 0;
        var cls = 'schaken-cell schaken-' + (light ? 'light' : 'dark');
        var piece = board[r][c];
        if (selected && selected.r === r && selected.c === c) cls += ' schaken-selected';
        for (var i = 0; i < validMoves.length; i++) {
          if (validMoves[i].toR === r && validMoves[i].toC === c) { cls += ' schaken-valid'; break; }
        }
        var pieceHtml = '';
        if (piece) {
          var labels = { K: 'Koning', Q: 'Koningin', R: 'Toren', B: 'Loper', N: 'Paard', P: 'Pion' };
          var colorLabel = piece.color === P1 ? 'wit' : 'zwart';
          pieceHtml = '<span class="schaken-piece schaken-p' + piece.color + ' schaken-' + piece.piece + '" role="img" aria-label="' + (labels[piece.piece] || piece.piece) + ' ' + colorLabel + '"></span>';
        }
        html += '<button type="button" class="' + cls + '" data-r="' + r + '" data-c="' + c + '">' + pieceHtml + '</button>';
      }
    }
    html += '</div>';
    return html;
  }

  function render() {
    if (mode === null) {
      var guidance = window.RegenboogCore && window.RegenboogCore.introGuidance && window.RegenboogCore.introGuidance.schaken;
      var cardLines = '';
      if (guidance && guidance.length) {
        cardLines = '<p><strong>Hoe te spelen:</strong></p><ul>' +
          guidance.map(function (line) { return '<li class="core-intro-step">♔ ' + escapeHtml(line) + '</li>'; }).join('') + '</ul>';
      } else {
        cardLines = '<p><strong>Hoe te spelen:</strong></p><ul><li class="core-intro-step">♔ Elk stuk beweegt volgens zijn regels.</li><li class="core-intro-step">♚ Schaakmat wint het spel.</li></ul>';
      }
      area.innerHTML =
        '<div class="core-intro">' +
        '  <h3 class="core-intro-title">Schaken</h3>' +
        '  <p class="core-intro-subtitle">Klassiek bordspel: versla de koning van je tegenstander.</p>' +
        '  <div class="core-intro-card">' + cardLines + '</div>' +
        '  <div class="core-intro-actions dammen-mode-actions">' +
        '    <p class="dammen-choose-mode">Kies hoe je wilt spelen:</p>' +
        '    <div class="dammen-mode-buttons">' +
        '      <button type="button" class="dammen-mode-btn" data-mode="1v1">1 vs 1</button>' +
        '      <button type="button" class="dammen-mode-btn" data-mode="1vAI">1 vs computer</button>' +
        '      <button type="button" class="dammen-mode-btn" data-mode="multiplayer">Multiplayer</button>' +
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
            selected = null;
            validMoves = [];
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
        socket = (typeof io !== 'undefined' && io) ? io('/schaken') : null;
        if (!socket) {
          step = 'mp-name';
          render();
          return;
        }
        socket.emit('setName', myName);
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
          selected = null;
          validMoves = [];
          step = 'play';
          render();
        });
        socket.on('gameState', function (data) {
          board = data.board || board;
          currentPlayer = data.currentPlayer;
          winner = data.winner != null ? data.winner : null;
          gameOver = winner !== null;
          selected = null;
          validMoves = [];
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
          gameOver = false;
          winner = null;
          selected = null;
          validMoves = [];
          thinking = false;
          render();
        });
      });
      document.getElementById('dammen-diff-back').addEventListener('click', function () { mode = null; step = null; render(); });
      return;
    }

    var turnText = gameOver
      ? (winner === 0 ? 'Gelijkspel!' : (winner === P1 ? 'Wit wint!' : 'Zwart wint!'))
      : thinking ? 'Computer denkt…'
      : mode === '1vAI' && currentPlayer === P2 ? 'Computer is aan zet'
      : mode === 'multiplayer'
        ? (currentPlayer === mySide ? 'Jij bent aan zet' : opponentName + ' is aan zet')
        : (currentPlayer === P1 ? 'Wit aan zet' : 'Zwart aan zet');
    if (gameOver && mode === 'multiplayer' && winner === mySide) turnText = 'Jij wint!';
    if (gameOver && mode === 'multiplayer' && winner !== null && winner !== 0 && winner !== mySide) turnText = opponentName + ' wint!';

    var counts = getPieceCounts(board);
    var standLine = 'Stand: Wit ' + counts.p1 + ' stuks – Zwart ' + counts.p2 + ' stuks.';

    var chatHtml = '';
    if (mode === 'multiplayer') {
      var chatList = chatMessages.map(function (msg) { return '<div class="dammen-chat-msg"><strong>' + escapeHtml(msg.name) + '</strong>: ' + escapeHtml(msg.text) + '</div>'; }).join('');
      chatHtml = '<div class="dammen-chat-panel"><div class="dammen-chat-title">Chat – ' + escapeHtml(opponentName) + '</div><div class="dammen-chat-messages" id="dammen-chat-msgs">' + chatList + '</div><div class="dammen-chat-input-wrap"><input type="text" class="dammen-chat-input" id="dammen-chat-input" placeholder="Bericht…" maxlength="500"><button type="button" class="dammen-chat-send" id="dammen-chat-send">Verstuur</button></div></div>';
    }

    area.innerHTML =
      '<p class="dammen-instruction">' + turnText + '</p>' +
      '<p class="dammen-stand">' + standLine + '</p>' +
      '<div class="dammen-play-wrap"><div class="dammen-board-wrap">' + renderBoard() + '</div>' + chatHtml + '</div>' +
      '<div class="dammen-actions">' +
      (mode === 'multiplayer' ? '<button type="button" class="dammen-back" id="dammen-leave-room">Verlaat spel</button>' : '<button type="button" class="dammen-again" id="dammen-new">Nieuw spel</button><button type="button" class="dammen-back" id="dammen-back">Andere spelmodus</button>') +
      '</div>';

    area.querySelectorAll('.schaken-cell').forEach(function (cell) {
      cell.addEventListener('click', function () {
        var r = parseInt(cell.getAttribute('data-r'), 10);
        var c = parseInt(cell.getAttribute('data-c'), 10);
        onCellClick(r, c);
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
        gameOver = false;
        winner = null;
        selected = null;
        validMoves = [];
        thinking = false;
        render();
      });
      document.getElementById('dammen-back').addEventListener('click', function () { mode = null; step = null; render(); });
    }
  }

  board = initBoard();
  render();
  if (window.Leaderboard && leaderboardEl) window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
