(function () {
  const CLASS_ID = 'giraffen';
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');

  const ROWS = 16;
  const COLS = 10;
  const DROP_MS = 850;
  const LINE_CLEAR_POINTS = [0, 100, 300, 500, 800];

  let board = [];
  let score = 0;
  let activePiece = null;
  let nextPiece = null;
  let dropTimer = null;
  let gameOver = false;
  let audioCtx = null;
  let clearingRows = [];
  let isClearingLines = false;
  let clearAnimTimer = null;

  const ANIMAL_PIECES = [
    { id: 'giraffen', label: 'Giraffen', logo: 'giraffen', color: '#f4a261', base: [[0, 0], [0, 1], [0, 2], [0, 3]] }, // I
    { id: 'nijlpaarden', label: 'Nijlpaarden', logo: 'nijlpaarden', color: '#8d99ae', base: [[0, 0], [0, 1], [1, 0], [1, 1]] }, // O
    { id: 'olifanten', label: 'Olifanten', logo: 'olifanten', color: '#4f6d7a', base: [[0, 1], [1, 0], [1, 1], [1, 2]] }, // T
    { id: 'zebras', label: 'Zebras', logo: 'zebras', color: '#c0c0c0', base: [[0, 1], [0, 2], [1, 0], [1, 1]] }, // S
    { id: 'wolven', label: 'Wolven', logo: 'wolven', color: '#6b7c8f', base: [[0, 0], [0, 1], [1, 1], [1, 2]] }, // Z
    { id: 'koalas', label: 'Koalas', logo: 'koalas', color: '#8f9779', base: [[0, 0], [1, 0], [1, 1], [1, 2]] }, // J
    { id: 'pandas', label: 'Pandas', logo: 'pandas', color: '#5f6368', base: [[0, 2], [1, 0], [1, 1], [1, 2]] } // L
  ];

  function cloneCells(cells) {
    return cells.map(function (p) { return [p[0], p[1]]; });
  }

  function normalizeCells(cells) {
    var minR = Infinity;
    var minC = Infinity;
    for (var i = 0; i < cells.length; i++) {
      if (cells[i][0] < minR) minR = cells[i][0];
      if (cells[i][1] < minC) minC = cells[i][1];
    }
    return cells.map(function (p) { return [p[0] - minR, p[1] - minC]; });
  }

  function rotateCells(cells) {
    var rotated = cells.map(function (p) {
      return [p[1], -p[0]];
    });
    return normalizeCells(rotated);
  }

  function keyForCells(cells) {
    var sorted = cloneCells(cells).sort(function (a, b) {
      if (a[0] !== b[0]) return a[0] - b[0];
      return a[1] - b[1];
    });
    return sorted.map(function (p) { return p[0] + ',' + p[1]; }).join('|');
  }

  function buildRotations(base) {
    var rotations = [];
    var seen = {};
    var current = normalizeCells(cloneCells(base));
    for (var i = 0; i < 4; i++) {
      var key = keyForCells(current);
      if (!seen[key]) {
        seen[key] = true;
        rotations.push(cloneCells(current));
      }
      current = rotateCells(current);
    }
    return rotations;
  }

  const PIECES = ANIMAL_PIECES.map(function (piece) {
    return {
      id: piece.id,
      label: piece.label,
      logo: piece.logo,
      color: piece.color,
      rotations: buildRotations(piece.base)
    };
  });

  function randomPieceDef() {
    return PIECES[Math.floor(Math.random() * PIECES.length)];
  }

  function makePiece(def) {
    return {
      def: def,
      row: -2,
      col: Math.floor(COLS / 2) - 2,
      rotation: 0
    };
  }

  function getPieceCells(piece) {
    return piece.def.rotations[piece.rotation];
  }

  function isValidPosition(piece, row, col, rotation) {
    var cells = piece.def.rotations[rotation];
    for (var i = 0; i < cells.length; i++) {
      var rr = row + cells[i][0];
      var cc = col + cells[i][1];
      if (cc < 0 || cc >= COLS || rr >= ROWS) return false;
      if (rr >= 0 && board[rr][cc]) return false;
    }
    return true;
  }

  function mergedBoard() {
    var renderGrid = board.map(function (row) { return row.slice(); });
    if (!activePiece) return renderGrid;
    var cells = getPieceCells(activePiece);
    for (var i = 0; i < cells.length; i++) {
      var rr = activePiece.row + cells[i][0];
      var cc = activePiece.col + cells[i][1];
      if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) {
        renderGrid[rr][cc] = {
          id: activePiece.def.id,
          logo: activePiece.def.logo,
          color: activePiece.def.color,
          active: true
        };
      }
    }
    return renderGrid;
  }

  function ensureAudio() {
    if (audioCtx) return audioCtx;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    return audioCtx;
  }

  function playLineClearSound(linesCleared) {
    var ctx = ensureAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(function () {});
    }
    var now = ctx.currentTime;
    var base = linesCleared >= 4 ? 780 : 620;
    var notes = linesCleared >= 4 ? [base, base * 1.33, base * 1.78] : [base, base * 1.25];
    for (var i = 0; i < notes.length; i++) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = notes[i];
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18 + i * 0.03);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.01);
      osc.stop(now + 0.2 + i * 0.03);
    }
  }

  function findFullRows() {
    var rows = [];
    for (var r = ROWS - 1; r >= 0; r--) {
      var full = true;
      for (var c = 0; c < COLS; c++) {
        if (!board[r][c]) {
          full = false;
          break;
        }
      }
      if (full) {
        rows.push(r);
      }
    }
    return rows;
  }

  function removeRows(rows) {
    var sortedRows = rows.slice().sort(function (a, b) { return b - a; });
    for (var i = 0; i < sortedRows.length; i++) {
      board.splice(sortedRows[i], 1);
      var emptyRow = [];
      for (var c = 0; c < COLS; c++) emptyRow.push(null);
      board.unshift(emptyRow);
    }
  }

  function startLineClearAnimation(rows, onDone) {
    clearingRows = rows.slice();
    isClearingLines = true;
    render();
    if (clearAnimTimer) clearTimeout(clearAnimTimer);
    // Verwijder rijen één voor één met delay
    var rowsToRemove = rows.slice().sort(function (a, b) { return b - a; });
    var currentIndex = 0;
    function removeNextRow() {
      if (currentIndex >= rowsToRemove.length) {
        clearAnimTimer = null;
        isClearingLines = false;
        clearingRows = [];
        onDone();
        render();
        return;
      }
      // Verwijder één rij
      var rowToRemove = rowsToRemove[currentIndex];
      board.splice(rowToRemove, 1);
      var emptyRow = [];
      for (var c = 0; c < COLS; c++) emptyRow.push(null);
      board.unshift(emptyRow);
      // Update clearingRows om alleen de volgende rijen te tonen (aangepast voor verschuiving)
      clearingRows = rowsToRemove.slice(currentIndex + 1).map(function (r) { return r - 1; });
      currentIndex++;
      render();
      // Wacht 200ms voordat volgende rij wordt verwijderd
      clearAnimTimer = setTimeout(removeNextRow, 200);
    }
    // Start met eerste rij na 240ms
    clearAnimTimer = setTimeout(removeNextRow, 240);
  }

  function lockPiece() {
    var cells = getPieceCells(activePiece);
    var landed = 0;
    for (var i = 0; i < cells.length; i++) {
      var rr = activePiece.row + cells[i][0];
      var cc = activePiece.col + cells[i][1];
      if (rr < 0) {
        endGame();
        return;
      }
      board[rr][cc] = {
        id: activePiece.def.id,
        logo: activePiece.def.logo,
        color: activePiece.def.color,
        active: false
      };
      landed++;
    }
    score += landed * 10;
    var rowsToClear = findFullRows();
    var linesCleared = rowsToClear.length;
    if (linesCleared > 0) {
      var bonus = LINE_CLEAR_POINTS[Math.min(linesCleared, 4)];
      score += bonus;
      playLineClearSound(linesCleared);
      startLineClearAnimation(rowsToClear, function () {
        removeRows(rowsToClear);
        spawnNextPiece();
      });
      return;
    }
    spawnNextPiece();
  }

  function spawnNextPiece() {
    activePiece = nextPiece || makePiece(randomPieceDef());
    nextPiece = makePiece(randomPieceDef());
    activePiece.row = -2;
    activePiece.col = Math.floor(COLS / 2) - 2;
    activePiece.rotation = 0;
    if (!isValidPosition(activePiece, activePiece.row, activePiece.col, activePiece.rotation)) {
      endGame();
      return;
    }
    render();
  }

  function movePiece(dr, dc, skipRender) {
    if (gameOver || !activePiece || isClearingLines) return false;
    var nr = activePiece.row + dr;
    var nc = activePiece.col + dc;
    if (!isValidPosition(activePiece, nr, nc, activePiece.rotation)) return false;
    activePiece.row = nr;
    activePiece.col = nc;
    if (!skipRender) render();
    return true;
  }

  function rotatePiece() {
    if (gameOver || !activePiece || isClearingLines) return;
    var nextRotation = (activePiece.rotation + 1) % activePiece.def.rotations.length;
    var offsets = [0, -1, 1, -2, 2];
    for (var i = 0; i < offsets.length; i++) {
      var nc = activePiece.col + offsets[i];
      if (isValidPosition(activePiece, activePiece.row, nc, nextRotation)) {
        activePiece.col = nc;
        activePiece.rotation = nextRotation;
        render();
        return;
      }
    }
  }

  function tick() {
    if (gameOver || !activePiece || isClearingLines) return;
    if (!movePiece(1, 0, true)) {
      lockPiece();
    } else {
      render();
    }
  }

  function stopTimers() {
    if (dropTimer) {
      clearInterval(dropTimer);
      dropTimer = null;
    }
    if (clearAnimTimer) {
      clearTimeout(clearAnimTimer);
      clearAnimTimer = null;
    }
  }

  function endGame() {
    gameOver = true;
    stopTimers();
    render();
    window.Leaderboard.showSubmitForm(CLASS_ID, score, function () {
      window.Leaderboard.render(leaderboardEl, CLASS_ID);
    });
  }

  function renderGridCells() {
    var grid = mergedBoard();
    var html = '';
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var cell = grid[r][c];
        if (!cell) {
          var clearClassEmpty = clearingRows.indexOf(r) !== -1 ? ' giraffen-cell-line-clear' : '';
          html += '<div class="giraffen-cell giraffen-cell-empty' + clearClassEmpty + '"></div>';
        } else {
          var activeClass = cell.active ? ' giraffen-cell-active' : '';
          var clearClassFilled = clearingRows.indexOf(r) !== -1 ? ' giraffen-cell-line-clear' : '';
          var logoSrc = '/assets/images/classes/' + cell.logo + '.png';
          html += '<div class="giraffen-cell giraffen-cell-filled' + activeClass + clearClassFilled + '" style="--piece-color:' + cell.color + '"><img src="' + logoSrc + '" alt="' + cell.id + '" class="giraffen-piece-logo" onerror="this.style.display=\'none\'"></div>';
        }
      }
    }
    return html;
  }

  function renderNextPreview() {
    if (!nextPiece || !nextPiece.def) {
      return '<div class="giraffen-next-grid"></div>';
    }
    var previewSize = 4;
    var cells = nextPiece.def.rotations[0];
    var map = {};
    for (var i = 0; i < cells.length; i++) {
      map[cells[i][0] + ',' + cells[i][1]] = true;
    }
    var html = '<div class="giraffen-next-grid">';
    for (var r = 0; r < previewSize; r++) {
      for (var c = 0; c < previewSize; c++) {
        var key = r + ',' + c;
        if (map[key]) {
          var logoSrc = '/assets/images/classes/' + nextPiece.def.logo + '.png';
          html += '<div class="giraffen-next-cell giraffen-next-cell-filled" style="--piece-color:' + nextPiece.def.color + '"><img src="' + logoSrc + '" alt="' + nextPiece.def.id + '" class="giraffen-next-logo" onerror="this.style.display=\'none\'"></div>';
        } else {
          html += '<div class="giraffen-next-cell"></div>';
        }
      }
    }
    html += '</div>';
    return html;
  }

  function render() {
    var status = gameOver
      ? 'Spel afgelopen: geen plaats meer voor een nieuwe dierenvorm.'
      : 'Vul rijen volledig om ze te laten verdwijnen en extra punten te krijgen.';
    var nextLabel = nextPiece ? nextPiece.def.label : '-';
    area.innerHTML =
      '<p class="giraffen-instruction">Dierentetris (1 ronde): ' + status + '</p>' +
      '<div class="giraffen-hud">' +
      '<div class="giraffen-score-card"><span class="giraffen-label">Score</span><span class="game-score giraffen-score">' + score + '</span></div>' +
      '<div class="giraffen-next-card"><span class="giraffen-label">Volgende vorm</span><span class="giraffen-next-name">' + nextLabel + '</span>' + renderNextPreview() + '</div>' +
      '</div>' +
      '<div class="giraffen-grid" aria-label="Spelraster">' + renderGridCells() + '</div>' +
      '<div class="giraffen-controls">' +
      '<button type="button" class="giraffen-btn" data-action="left">⬅️ links</button>' +
      '<button type="button" class="giraffen-btn" data-action="rotate">🔄 draai</button>' +
      '<button type="button" class="giraffen-btn" data-action="right">rechts ➡️</button>' +
      '<button type="button" class="giraffen-btn giraffen-btn-down" data-action="down">⬇️ omlaag</button>' +
      '</div>' +
      '<p class="giraffen-help">Toetsen: pijltjes om te bewegen en te draaien. Puntentabel: 1/2/3/4 rijen = 100/300/500/800.</p>' +
      (gameOver ? '<button type="button" class="giraffen-again" id="giraffen-restart">Speel opnieuw</button>' : '');

    var controlButtons = area.querySelectorAll('.giraffen-btn');
    controlButtons.forEach(function (button) {
      button.disabled = gameOver;
      button.addEventListener('click', function () {
        var action = button.getAttribute('data-action');
        if (action === 'left') {
          movePiece(0, -1);
        } else if (action === 'right') {
          movePiece(0, 1);
        } else if (action === 'down') {
          if (!movePiece(1, 0, true)) {
            tick();
          } else {
            score += 1;
            render();
          }
        } else if (action === 'rotate') {
          rotatePiece();
        }
      });
    });

    var restartBtn = document.getElementById('giraffen-restart');
    if (restartBtn) {
      restartBtn.addEventListener('click', function () {
        startGame();
      });
    }
  }

  function handleKeyDown(e) {
    if (gameOver || !activePiece || isClearingLines) return;
    if (e.key === 'ArrowLeft' || e.key === 'Left') {
      e.preventDefault();
      movePiece(0, -1);
    } else if (e.key === 'ArrowRight' || e.key === 'Right') {
      e.preventDefault();
      movePiece(0, 1);
    } else if (e.key === 'ArrowDown' || e.key === 'Down') {
      e.preventDefault();
      if (!movePiece(1, 0, true)) {
        tick();
      } else {
        score += 1;
        render();
      }
    } else if (e.key === 'ArrowUp' || e.key === 'Up') {
      e.preventDefault();
      rotatePiece();
    }
  }

  function startGame() {
    stopTimers();
    board = [];
    for (var r = 0; r < ROWS; r++) {
      var row = [];
      for (var c = 0; c < COLS; c++) row.push(null);
      board.push(row);
    }
    score = 0;
    gameOver = false;
    clearingRows = [];
    isClearingLines = false;
    nextPiece = makePiece(randomPieceDef());
    spawnNextPiece();
    dropTimer = setInterval(tick, DROP_MS);
    render();
  }

  window.addEventListener('beforeunload', stopTimers);
  document.addEventListener('keydown', handleKeyDown);

  function showIntro() {
    area.innerHTML =
      '<div style="text-align:center; margin-bottom:1rem;">' +
      '  <h3>Giraffen - Blokken Toren</h3>' +
      '  <p style="font-size:1.05rem; color:#555; margin-bottom:0.6rem;">Stapel dierenvormen en maak volle rijen voor punten.</p>' +
      '  <div style="margin:1rem 0; padding:1rem; background:#fff4e6; border-radius:8px; display:inline-block; text-align:left;">' +
      '    <p style="margin:0.5rem 0;"><strong>Hoe te spelen:</strong></p>' +
      '    <p style="margin:0.5rem 0;">- Beweeg met pijltjes links/rechts</p>' +
      '    <p style="margin:0.5rem 0;">- Draai met pijl omhoog</p>' +
      '    <p style="margin:0.5rem 0;">- Maak meerdere volle rijen tegelijk voor bonuspunten</p>' +
      '  </div>' +
      '  <div><button type="button" id="giraffen-start" style="padding:1rem 2rem; font-size:1.1rem; background:linear-gradient(135deg, #dd6b20, #b45309); color:white; border:none; border-radius:12px; cursor:pointer; font-weight:700;">Start spel</button></div>' +
      '</div>';
    var startBtn = document.getElementById('giraffen-start');
    if (startBtn) {
      startBtn.addEventListener('click', startGame);
    }
  }

  showIntro();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
