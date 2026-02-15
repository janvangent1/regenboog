/**
 * Dammen – 1 vs 1 (twee spelers) of 1 vs computer.
 * Nederlands/Internationaal: 10x10, 20 schijven, 4 rijen; dam mag hele diagonaal; meerslag max verplicht.
 */
(function () {
  const CLASS_ID = 'dammen';
  const area = document.getElementById('game-area');
  if (area) area.classList.add('dammen-game');
  const leaderboardEl = document.getElementById('leaderboard');

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  const SIZE = 10;
  const P1 = 1;
  const P2 = 2;
  const AI_DEPTHS = { easy: 1, normal: 4, hard: 6 };

  let board = [];
  let currentPlayer = P1;
  let selected = null;       // { r, c }
  let validMoves = [];       // [{ toR, toC, captures: [[r,c],...] }]
  let mode = null;           // '1v1' | '1vAI' | 'multiplayer'
  let step = null;           // null = kies modus, 'difficulty' = kies moeilijkheid, 'play' = spel; voor mp: 'mp-name', 'mp-lobby', 'play'
  let aiDepth = AI_DEPTHS.normal;
  let aiDifficulty = 'normal';
  let gameOver = false;
  let winner = null;
  let thinking = false;
  let socket = null;
  let myName = '';
  let mySide = null;         // P1 of P2 in multiplayer
  let opponentName = '';
  let roomId = null;
  let chatMessages = [];
  let lobbyList = [];
  let pendingInviteFrom = null; // { fromId, fromName }
  let pendingOpponentMove = null; // { fromR, fromC, toR, toC, captures } – toont zet tegenstander trager

  function isDark(r, c) {
    return (r + c) % 2 === 1;
  }

  function cloneBoard(b) {
    return b.map(function (row) {
      return row.map(function (cell) {
        return cell ? { player: cell.player, king: cell.king } : null;
      });
    });
  }

  function initBoard() {
    board = [];
    for (var r = 0; r < SIZE; r++) {
      var row = [];
      for (var c = 0; c < SIZE; c++) {
        if (!isDark(r, c)) {
          row.push(null);
          continue;
        }
        if (r <= 3) row.push({ player: P2, king: false });
        else if (r >= 6) row.push({ player: P1, king: false });
        else row.push(null);
      }
      board.push(row);
    }
  }

  function getPieceJumpChains(b, r, c, player, chain) {
    var piece = b[r][c];
    if (!piece || piece.player !== player || piece.king) return [];
    var dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    var chains = [];
    for (var d = 0; d < dirs.length; d++) {
      var midR = r + dirs[d][0];
      var midC = c + dirs[d][1];
      var toR = r + 2 * dirs[d][0];
      var toC = c + 2 * dirs[d][1];
      if (toR < 0 || toR >= SIZE || toC < 0 || toC >= SIZE) continue;
      var mid = b[midR][midC];
      if (!mid || mid.player === player) continue;
      if (b[toR][toC]) continue;
      var alreadyCaptured = false;
      if (chain.captured && chain.captured.length) {
        for (var k = 0; k < chain.captured.length; k++) {
          if (chain.captured[k][0] === midR && chain.captured[k][1] === midC) {
            alreadyCaptured = true;
            break;
          }
        }
      }
      if (alreadyCaptured) continue;
      var newCaptures = (chain.captured || []).concat([[midR, midC]]);
      var newBoard = cloneBoard(b);
      newBoard[r][c] = null;
      newBoard[midR][midC] = null;
      newBoard[toR][toC] = { player: piece.player, king: piece.king };
      var further = getJumpChains(newBoard, toR, toC, player, { captured: newCaptures });
      if (further.length > 0) {
        for (var i = 0; i < further.length; i++) {
          chains.push({ toR: further[i].toR, toC: further[i].toC, captures: further[i].captures });
        }
      } else {
        chains.push({ toR: toR, toC: toC, captures: newCaptures });
      }
    }
    return chains;
  }

  function getKingJumpChains(b, r, c, player, chain) {
    var piece = b[r][c];
    if (!piece || piece.player !== player || !piece.king) return [];
    var dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    var chains = [];
    for (var d = 0; d < dirs.length; d++) {
      var er = r + dirs[d][0];
      var ec = c + dirs[d][1];
      while (er >= 0 && er < SIZE && ec >= 0 && ec < SIZE) {
        var cell = b[er][ec];
        if (cell) {
          if (cell.player === player) break;
          var alreadyCaptured = false;
          if (chain.captured && chain.captured.length) {
            for (var k = 0; k < chain.captured.length; k++) {
              if (chain.captured[k][0] === er && chain.captured[k][1] === ec) {
                alreadyCaptured = true;
                break;
              }
            }
          }
          if (alreadyCaptured) break;
          var lr = er + dirs[d][0];
          var lc = ec + dirs[d][1];
          while (lr >= 0 && lr < SIZE && lc >= 0 && lc < SIZE) {
            if (b[lr][lc]) break;
            var newCaptures = (chain.captured || []).concat([[er, ec]]);
            var newBoard = cloneBoard(b);
            newBoard[r][c] = null;
            newBoard[er][ec] = null;
            newBoard[lr][lc] = { player: piece.player, king: true };
            var further = getKingJumpChains(newBoard, lr, lc, player, { captured: newCaptures });
            if (further.length > 0) {
              for (var i = 0; i < further.length; i++) {
                chains.push({ toR: further[i].toR, toC: further[i].toC, captures: further[i].captures });
              }
            } else {
              chains.push({ toR: lr, toC: lc, captures: newCaptures });
            }
            lr += dirs[d][0];
            lc += dirs[d][1];
          }
          break;
        }
        er += dirs[d][0];
        ec += dirs[d][1];
      }
    }
    return chains;
  }

  function getJumpChains(b, r, c, player, chain) {
    var piece = b[r][c];
    if (!piece || piece.player !== player) return [];
    if (piece.king) return getKingJumpChains(b, r, c, player, chain);
    return getPieceJumpChains(b, r, c, player, chain);
  }

  function getAllJumps(b, player) {
    var moves = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var list = getJumpChains(b, r, c, player, { captured: [] });
        for (var i = 0; i < list.length; i++) {
          moves.push({ fromR: r, fromC: c, toR: list[i].toR, toC: list[i].toC, captures: list[i].captures });
        }
      }
    }
    return moves;
  }

  function getSimpleMoves(b, player) {
    var moves = [];
    var dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var piece = b[r][c];
        if (!piece || piece.player !== player) continue;
        if (piece.king) {
          for (var d = 0; d < dirs.length; d++) {
            var nr = r + dirs[d][0];
            var nc = c + dirs[d][1];
            while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && !b[nr][nc]) {
              moves.push({ fromR: r, fromC: c, toR: nr, toC: nc, captures: [] });
              nr += dirs[d][0];
              nc += dirs[d][1];
            }
          }
        } else {
          var stepDirs = player === P1 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
          for (var s = 0; s < stepDirs.length; s++) {
            var nr = r + stepDirs[s][0];
            var nc = c + stepDirs[s][1];
            if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE || b[nr][nc]) continue;
            if (player === P1 && nr >= r) continue;
            if (player === P2 && nr <= r) continue;
            moves.push({ fromR: r, fromC: c, toR: nr, toC: nc, captures: [] });
          }
        }
      }
    }
    return moves;
  }

  function getLegalMoves(b, player) {
    var jumps = getAllJumps(b, player);
    if (jumps.length > 0) {
      var maxCap = 0;
      for (var j = 0; j < jumps.length; j++) {
        var n = (jumps[j].captures || []).length;
        if (n > maxCap) maxCap = n;
      }
      var out = [];
      for (var k = 0; k < jumps.length; k++) {
        if ((jumps[k].captures || []).length === maxCap) out.push(jumps[k]);
      }
      return out;
    }
    return getSimpleMoves(b, player);
  }

  function applyMove(b, move) {
    var next = cloneBoard(b);
    var piece = next[move.fromR][move.fromC];
    next[move.fromR][move.fromC] = null;
    var caps = move.captures || [];
    for (var i = 0; i < caps.length; i++) {
      next[caps[i][0]][caps[i][1]] = null;
    }
    next[move.toR][move.toC] = { player: piece.player, king: piece.king };
    var crown = (piece.player === P1 && move.toR === 0) || (piece.player === P2 && move.toR === SIZE - 1);
    if (crown) next[move.toR][move.toC].king = true;
    return next;
  }

  function getPieceCounts(b) {
    var p1 = { pieces: 0, kings: 0 };
    var p2 = { pieces: 0, kings: 0 };
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var cell = b[r][c];
        if (!cell) continue;
        if (cell.player === P1) {
          if (cell.king) p1.kings++; else p1.pieces++;
        } else {
          if (cell.king) p2.kings++; else p2.pieces++;
        }
      }
    }
    return { p1: p1, p2: p2 };
  }

  function computeDammenScore() {
    var counts = getPieceCounts(board);
    var myPieces = counts.p1.pieces + counts.p1.kings;
    var oppPieces = counts.p2.pieces + counts.p2.kings;
    var margin = Math.max(0, myPieces - oppPieces);
    var base = 10;
    var diffBonus = (aiDifficulty === 'easy' ? 5 : aiDifficulty === 'hard' ? 25 : 15);
    var marginBonus = margin * 2;
    return Math.round(base + diffBonus + marginBonus);
  }

  function checkWinner(b) {
    var has1 = false;
    var has2 = false;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (b[r][c]) {
          if (b[r][c].player === P1) has1 = true;
          else has2 = true;
        }
      }
    }
    if (!has1) return P2;
    if (!has2) return P1;
    var m1 = getLegalMoves(b, P1);
    var m2 = getLegalMoves(b, P2);
    if (m1.length === 0) return P2;
    if (m2.length === 0) return P1;
    return null;
  }

  function evalBoard(b, forPlayer) {
    var score = 0;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var p = b[r][c];
        if (!p) continue;
        var v = p.king ? 4 : 1;
        var rowBonus = p.player === P1 ? (SIZE - 1 - r) : r;
        v += rowBonus * 0.05;
        if (p.player === forPlayer) score += v; else score -= v;
      }
    }
    return score;
  }

  function minimax(b, depth, player, alpha, beta, maximizing) {
    var w = checkWinner(b);
    if (w === P1) return maximizing ? -1000 + (aiDepth - depth) : 1000 - (aiDepth - depth);
    if (w === P2) return maximizing ? 1000 - (aiDepth - depth) : -1000 + (aiDepth - depth);
    if (depth <= 0) return evalBoard(b, P2);

    var moves = getLegalMoves(b, player);
    if (moves.length === 0) {
      var other = player === P1 ? P2 : P1;
      return minimax(b, depth - 1, other, alpha, beta, !maximizing);
    }

    if (maximizing) {
      var best = -Infinity;
      for (var i = 0; i < moves.length; i++) {
        var nb = applyMove(b, moves[i]);
        var nextP = player === P1 ? P2 : P1;
        var val = minimax(nb, depth - 1, nextP, alpha, beta, false);
        if (val > best) best = val;
        if (best > alpha) alpha = best;
        if (beta <= alpha) break;
      }
      return best;
    } else {
      var worst = Infinity;
      for (var j = 0; j < moves.length; j++) {
        var nb2 = applyMove(b, moves[j]);
        var nextP2 = player === P1 ? P2 : P1;
        var val2 = minimax(nb2, depth - 1, nextP2, alpha, beta, true);
        if (val2 < worst) worst = val2;
        if (worst < beta) beta = worst;
        if (beta <= alpha) break;
      }
      return worst;
    }
  }

  function getAIMove() {
    var moves = getLegalMoves(board, P2);
    if (!moves.length) return null;
    if (aiDifficulty === 'easy' && Math.random() < 0.4) {
      return moves[Math.floor(Math.random() * moves.length)];
    }
    var bestScore = -Infinity;
    var bestMove = moves[0];
    for (var i = 0; i < moves.length; i++) {
      var nb = applyMove(board, moves[i]);
      var score = minimax(nb, aiDepth - 1, P1, -Infinity, Infinity, false);
      if (score > bestScore) {
        bestScore = score;
        bestMove = moves[i];
      }
    }
    return bestMove;
  }

  function doMove(move) {
    board = applyMove(board, move);
    winner = checkWinner(board);
    if (winner) {
      gameOver = true;
      render();
      if (mode === '1vAI' && leaderboardEl && winner === P1) {
        var score = computeDammenScore();
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
        if (aiMove) {
          pendingOpponentMove = { fromR: aiMove.fromR, fromC: aiMove.fromC, toR: aiMove.toR, toC: aiMove.toC, captures: aiMove.captures || [] };
          render();
          setTimeout(function () {
            board = applyMove(board, aiMove);
            winner = checkWinner(board);
            if (winner) {
              gameOver = true;
              pendingOpponentMove = null;
              thinking = false;
              render();
              if (leaderboardEl && winner === P1) {
                var score = computeDammenScore();
                window.Leaderboard.showSubmitForm(CLASS_ID, score, function () {
                  if (window.Leaderboard && leaderboardEl) window.Leaderboard.render(leaderboardEl, CLASS_ID);
                });
              }
              return;
            }
            currentPlayer = P1;
            selected = null;
            validMoves = [];
            pendingOpponentMove = null;
            thinking = false;
            render();
          }, 1200);
        } else {
          thinking = false;
          render();
        }
      }, 500);
    }
  }

  function onCellClick(r, c) {
    if (gameOver || thinking) return;
    if (mode === null) return;
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
    if (!piece || piece.player !== currentPlayer) {
      selected = null;
      validMoves = [];
      render();
      return;
    }

    selected = { r: r, c: c };
    var allMoves = getLegalMoves(board, currentPlayer);
    validMoves = [];
    for (i = 0; i < allMoves.length; i++) {
      if (allMoves[i].fromR === r && allMoves[i].fromC === c) validMoves.push(allMoves[i]);
    }
    render();
  }

  function renderBoard() {
    var html = '<div class="dammen-board">';
    var pm = pendingOpponentMove;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var dark = isDark(r, c);
        var cellClass = 'dammen-cell' + (dark ? ' dammen-dark' : ' dammen-light');
        var piece = board[r][c];
        var selectedClass = selected && selected.r === r && selected.c === c ? ' dammen-selected' : '';
        var validClass = '';
        for (var i = 0; i < validMoves.length; i++) {
          if (validMoves[i].toR === r && validMoves[i].toC === c) {
            validClass = ' dammen-valid';
            break;
          }
        }
        if (pm && pm.fromR === r && pm.fromC === c) cellClass += ' dammen-move-from';
        if (pm && pm.toR === r && pm.toC === c) cellClass += ' dammen-move-to';
        if (pm && pm.captures && pm.captures.length) {
          for (var j = 0; j < pm.captures.length; j++) {
            if (pm.captures[j][0] === r && pm.captures[j][1] === c) { cellClass += ' dammen-move-capture'; break; }
          }
        }
        var pieceHtml = '';
        if (piece) {
          var pClass = 'dammen-piece dammen-p' + piece.player + (piece.king ? ' dammen-king' : '');
          pieceHtml = '<span class="' + pClass + '" aria-hidden="true"></span>';
        }
        html += '<button type="button" class="' + cellClass + selectedClass + validClass + '" data-r="' + r + '" data-c="' + c + '" ' + (dark ? '' : ' disabled') + '>' + pieceHtml + '</button>';
      }
    }
    html += '</div>';
    return html;
  }

  function render() {
    if (mode === null) {
      var guidance = window.RegenboogCore && window.RegenboogCore.introGuidance && window.RegenboogCore.introGuidance.dammen;
      var cardLines = '';
      if (guidance && guidance.length) {
        cardLines = '<p><strong>Hoe te spelen:</strong></p><ul>' +
          guidance.map(function (line) {
            var icon = '✨';
            var t = (line || '').toLowerCase();
            if (t.indexOf('beweeg') !== -1 || t.indexOf('diagonaal') !== -1) icon = '🎮';
            if (t.indexOf('slaan') !== -1 || t.indexOf('verplicht') !== -1 || t.indexOf('meerslag') !== -1) icon = '⚡';
            if (t.indexOf('dam') !== -1 || t.indexOf('achterste') !== -1) icon = '👑';
            if (t.indexOf('win') !== -1 || t.indexOf('tegenstander') !== -1) icon = '🏆';
            return '<li class="core-intro-step">' + icon + ' ' + escapeHtml(line) + '</li>';
          }).join('') + '</ul>';
      } else {
        cardLines = '<p><strong>Hoe te spelen:</strong></p><ul>' +
          '<li class="core-intro-step">🎮 Beweeg diagonaal; sla verplicht, meerslagen mogen.</li>' +
          '<li class="core-intro-step">👑 Word dam op de achterste rij.</li>' +
          '<li class="core-intro-step">🏆 Win door alle schijven van de tegenstander te slaan.</li></ul>';
      }
      area.innerHTML =
        '<div class="core-intro">' +
        '  <h3 class="core-intro-title">Dammen</h3>' +
        '  <p class="core-intro-subtitle">Sla en verover: speel het klassieke bordspel tegen iemand of tegen de computer.</p>' +
        '  <div class="core-intro-card">' + cardLines + '</div>' +
        '  <div class="core-intro-actions dammen-mode-actions">' +
        '    <p class="dammen-choose-mode">Kies hoe je wilt spelen:</p>' +
        '    <div class="dammen-mode-buttons">' +
        '      <button type="button" class="dammen-mode-btn" data-mode="1v1">1 vs 1 – twee spelers op één computer</button>' +
        '      <button type="button" class="dammen-mode-btn" data-mode="1vAI">1 vs computer</button>' +
        '      <button type="button" class="dammen-mode-btn" data-mode="multiplayer">Multiplayer – online tegen iemand anders</button>' +
        '    </div>' +
        '  </div>' +
        '</div>';
      area.querySelectorAll('.dammen-mode-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          mode = btn.getAttribute('data-mode');
          if (mode === '1v1') {
            step = 'play';
            currentPlayer = P1;
            gameOver = false;
            winner = null;
            selected = null;
            validMoves = [];
            thinking = false;
            initBoard();
          } else if (mode === 'multiplayer') {
            step = 'mp-name';
          } else {
            step = 'difficulty';
          }
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
        myName = (input && input.value) ? input.value.trim().slice(0, 30) : '';
        if (!myName) myName = 'Speler';
        step = 'mp-lobby';
        if (socket) socket.disconnect();
        socket = (typeof io !== 'undefined' && io) ? io() : null;
        if (!socket) {
          step = 'mp-name';
          area.querySelector && area.querySelector('.dammen-instruction') && (area.querySelector('.dammen-instruction').textContent = 'Geen verbinding. Controleer of de server draait en probeer opnieuw.');
          render();
          return;
        }
        socket.emit('setName', myName);
        socket.on('setNameOk', function () {
          lobbyList = [];
          socket.emit('getLobby');
          render();
        });
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
          var prevBoard = cloneBoard(board);
          board = data.board || board;
          currentPlayer = data.currentPlayer;
          winner = data.winner || null;
          gameOver = !!winner;
          selected = null;
          validMoves = [];
          var movedPlayer = currentPlayer === P1 ? P2 : P1;
          var fromR = null, fromC = null, toR = null, toC = null, caps = [];
          for (var ri = 0; ri < SIZE; ri++) {
            for (var ci = 0; ci < SIZE; ci++) {
              if (prevBoard[ri][ci] && prevBoard[ri][ci].player === movedPlayer && !board[ri][ci]) {
                if (fromR === null) { fromR = ri; fromC = ci; }
              } else if (prevBoard[ri][ci] && prevBoard[ri][ci].player === mySide && !board[ri][ci]) {
                caps.push([ri, ci]);
              }
              if (board[ri][ci] && board[ri][ci].player === movedPlayer) {
                toR = ri; toC = ci;
              }
            }
          }
          if (fromR !== null && toR !== null) {
            pendingOpponentMove = { fromR: fromR, fromC: fromC, toR: toR, toC: toC, captures: caps };
            render();
            setTimeout(function () {
              pendingOpponentMove = null;
              render();
            }, 1200);
          } else {
            render();
          }
        });
        socket.on('chat', function (msg) {
          chatMessages.push(msg);
          render();
        });
        socket.on('opponentLeft', function () {
          roomId = null;
          step = 'mp-lobby';
          opponentName = '';
          mySide = null;
          chatMessages = [];
          render();
        });
        socket.on('youLeftRoom', function () {
          roomId = null;
          step = 'mp-lobby';
          render();
        });
        socket.on('inviteFailed', function () { pendingInviteFrom = null; render(); });
        socket.on('inviteDeclined', function () { pendingInviteFrom = null; render(); });
        render();
      });
      document.getElementById('dammen-mp-back').addEventListener('click', function () {
        mode = null;
        step = null;
        if (socket) { socket.disconnect(); socket = null; }
        render();
      });
      return;
    }

    if (mode === 'multiplayer' && step === 'mp-lobby') {
      var listHtml = lobbyList.filter(function (u) { return u.id !== (socket && socket.id) && u.name; }).map(function (u) {
        return '<div class="dammen-lobby-user"><span class="dammen-lobby-name">' + escapeHtml(u.name) + '</span><button type="button" class="dammen-invite-btn" data-id="' + escapeHtml(u.id) + '">Nodig uit</button></div>';
      }).join('') || '<p class="dammen-lobby-empty">Niemand anders online. Wacht tot iemand de speelzaal opent.</p>';
      var inviteHtml = pendingInviteFrom
        ? '<div class="dammen-invite-overlay"><p>' + escapeHtml(pendingInviteFrom.fromName) + ' nodigt je uit.</p><button type="button" class="dammen-accept-btn" id="dammen-accept">Accepteer</button><button type="button" class="dammen-decline-btn" id="dammen-decline">Weiger</button></div>'
        : '';
      area.innerHTML =
        '<p class="dammen-instruction">Speelzaal – wie is online</p>' +
        '<div class="dammen-lobby-list">' + listHtml + '</div>' +
        inviteHtml +
        '<button type="button" class="dammen-back" id="dammen-lobby-back">Terug</button>';
      area.querySelectorAll('.dammen-invite-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-id');
          if (socket && id) socket.emit('invite', id);
        });
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
        lobbyList = [];
        pendingInviteFrom = null;
        render();
      });
      return;
    }

    if (mode === '1vAI' && step === 'difficulty') {
      area.innerHTML =
        '<p class="dammen-instruction">Kies de moeilijkheid van de computer.</p>' +
        '<div class="dammen-difficulty-buttons">' +
        '<button type="button" class="dammen-difficulty-btn" data-diff="easy">Makkelijk</button>' +
        '<button type="button" class="dammen-difficulty-btn" data-diff="normal">Normaal</button>' +
        '<button type="button" class="dammen-difficulty-btn" data-diff="hard">Moeilijk</button>' +
        '</div>' +
        '<button type="button" class="dammen-back" id="dammen-diff-back">Terug</button>';
      area.querySelectorAll('.dammen-difficulty-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var d = btn.getAttribute('data-diff');
          aiDepth = AI_DEPTHS[d] || AI_DEPTHS.normal;
          aiDifficulty = (d === 'easy' || d === 'hard') ? d : 'normal';
          step = 'play';
          currentPlayer = P1;
          gameOver = false;
          winner = null;
          selected = null;
          validMoves = [];
          thinking = false;
          initBoard();
          render();
        });
      });
      document.getElementById('dammen-diff-back').addEventListener('click', function () {
        mode = null;
        step = null;
        render();
      });
      return;
    }

    var turnText = gameOver
      ? (winner === P1 ? 'Speler 1 (wit) wint!' : 'Speler 2 (donker) wint!')
      : thinking
        ? 'Computer denkt…'
        : mode === '1vAI' && currentPlayer === P2
          ? 'Computer is aan zet'
          : mode === 'multiplayer'
            ? (gameOver ? (winner === mySide ? 'Jij wint!' : opponentName + ' wint!') : (currentPlayer === mySide ? 'Jij bent aan zet' : opponentName + ' is aan zet'))
            : currentPlayer === P1
              ? 'Speler 1 (wit) aan zet'
              : 'Speler 2 (donker) aan zet';

    var counts = getPieceCounts(board);
    var standLine = 'Stand: Wit ' + (counts.p1.pieces + counts.p1.kings) + ' stuks' + (counts.p1.kings ? ' (' + counts.p1.kings + ' dam' + (counts.p1.kings !== 1 ? 'men' : '') + ')' : '') + ' – Zwart ' + (counts.p2.pieces + counts.p2.kings) + ' stuks' + (counts.p2.kings ? ' (' + counts.p2.kings + ' dam' + (counts.p2.kings !== 1 ? 'men' : '') + ')' : '') + '.';

    var chatHtml = '';
    if (mode === 'multiplayer') {
      var chatList = chatMessages.map(function (msg) {
        return '<div class="dammen-chat-msg"><strong>' + escapeHtml(msg.name) + '</strong>: ' + escapeHtml(msg.text) + '</div>';
      }).join('');
      chatHtml =
        '<div class="dammen-chat-panel">' +
        '<div class="dammen-chat-title">Chat – ' + escapeHtml(opponentName) + '</div>' +
        '<div class="dammen-chat-messages" id="dammen-chat-msgs">' + chatList + '</div>' +
        '<div class="dammen-chat-input-wrap">' +
        '<input type="text" class="dammen-chat-input" id="dammen-chat-input" placeholder="Bericht…" maxlength="500">' +
        '<button type="button" class="dammen-chat-send" id="dammen-chat-send">Verstuur</button>' +
        '</div></div>';
    }

    area.innerHTML =
      '<p class="dammen-instruction">' + turnText + '</p>' +
      '<p class="dammen-stand">' + standLine + '</p>' +
      '<div class="dammen-play-wrap">' +
      '<div class="dammen-board-wrap">' + renderBoard() + '</div>' +
      chatHtml +
      '</div>' +
      '<div class="dammen-actions">' +
      (mode === 'multiplayer'
        ? '<button type="button" class="dammen-back" id="dammen-leave-room">Verlaat spel</button>'
        : '<button type="button" class="dammen-again" id="dammen-new">Nieuw spel</button><button type="button" class="dammen-back" id="dammen-back">Andere spelmodus</button>') +
      '</div>';

    area.querySelectorAll('.dammen-cell.dammen-dark').forEach(function (cell) {
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
        roomId = null;
        step = 'mp-lobby';
        opponentName = '';
        mySide = null;
        chatMessages = [];
        render();
      });
      var chatIn = document.getElementById('dammen-chat-input');
      var chatSend = document.getElementById('dammen-chat-send');
      var chatMsgs = document.getElementById('dammen-chat-msgs');
      if (chatSend && chatIn && socket) {
        function sendChat() {
          var t = chatIn.value.trim();
          if (t) { socket.emit('chat', t); chatIn.value = ''; }
        }
        chatSend.addEventListener('click', sendChat);
        chatIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') sendChat(); });
      }
      if (chatMsgs) chatMsgs.scrollTop = chatMsgs.scrollHeight;
    } else {
      document.getElementById('dammen-new').addEventListener('click', function () {
        currentPlayer = P1;
        gameOver = false;
        winner = null;
        selected = null;
        validMoves = [];
        thinking = false;
        initBoard();
        render();
      });
      document.getElementById('dammen-back').addEventListener('click', function () {
        mode = null;
        step = null;
        render();
      });
    }
  }

  render();
  if (window.Leaderboard && leaderboardEl) window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
