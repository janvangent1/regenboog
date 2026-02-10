(function () {
  const CLASS_ID = 'vossen';
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  const TOTAL_ROUNDS = 3;
  const ROWS = 6;
  const COLS = 8;
  let grid = [];
  let fox = { r: 0, c: 0 };
  let goal = { r: ROWS - 1, c: COLS - 1 };
  let moves = 0;
  let currentRound = 1;
  let totalScore = 0;

  /** BFS: is goal reachable from (0,0) without stepping on walls? */
  function isMazeSolvable() {
    var startR = 0, startC = 0;
    var goalR = ROWS - 1, goalC = COLS - 1;
    if (grid[startR][startC] === 1 || grid[goalR][goalC] === 1) return false;
    var seen = {};
    seen['0,0'] = true;
    var queue = [{ r: startR, c: startC }];
    var dr = [1, -1, 0, 0], dc = [0, 0, 1, -1];
    while (queue.length > 0) {
      var cell = queue.shift();
      if (cell.r === goalR && cell.c === goalC) return true;
      for (var d = 0; d < 4; d++) {
        var nr = cell.r + dr[d], nc = cell.c + dc[d];
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
        if (grid[nr][nc] === 1) continue;
        var key = nr + ',' + nc;
        if (seen[key]) continue;
        seen[key] = true;
        queue.push({ r: nr, c: nc });
      }
    }
    return false;
  }

  function createMaze(wallChance) {
    var maxAttempts = 50;
    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      for (var r = 0; r < ROWS; r++) {
        grid[r] = [];
        for (var c = 0; c < COLS; c++) {
          grid[r][c] = r === 0 && c === 0 ? 0 : r === ROWS - 1 && c === COLS - 1 ? 0 : Math.random() < wallChance ? 1 : 0;
        }
      }
      grid[0][0] = 0;
      grid[ROWS - 1][COLS - 1] = 0;
      if (isMazeSolvable()) return;
    }
    /* Fallback: no walls so path is straight (should not happen often) */
    for (var r = 0; r < ROWS; r++) {
      grid[r] = [];
      for (var c = 0; c < COLS; c++) {
        grid[r][c] = 0;
      }
    }
  }

  function render() {
    const wrap = document.createElement('div');
    wrap.className = 'vossen-grid-wrap';
    wrap.setAttribute('tabindex', '0');
    wrap.setAttribute('aria-label', 'Speelveld: stuur de vos met pijltjestoetsen naar het hol');
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement('div');
        cell.className = 'vossen-cell' + (grid[r][c] === 1 ? ' vossen-wall' : '');
        if (r === goal.r && c === goal.c) {
          const hole = document.createElement('span');
          hole.className = 'vossen-hole';
          hole.setAttribute('aria-hidden', 'true');
          hole.textContent = '🕳️';
          cell.appendChild(hole);
        }
        if (r === fox.r && c === fox.c) {
          const f = document.createElement('img');
          f.src = '/assets/images/classes/vossen.png';
          f.alt = 'Vos';
          f.className = 'vossen-fox';
          f.onerror = function () {
            var s = document.createElement('span');
            s.className = 'vossen-fox-emoji';
            s.textContent = '🦊';
            f.parentNode.replaceChild(s, f);
          };
          cell.appendChild(f);
        }
        wrap.appendChild(cell);
      }
    }
    area.innerHTML = '';
    area.appendChild(wrap);
    const hint = document.createElement('p');
    hint.className = 'game-score vossen-hint';
    hint.textContent = 'Ronde ' + currentRound + '/' + TOTAL_ROUNDS + '. Zetten: ' + moves + ' – Gebruik pijltjestoetsen om het hol te bereiken.';
    area.appendChild(hint);
    wrap.focus();
  }

  function move(dr, dc) {
    const nr = fox.r + dr;
    const nc = fox.c + dc;
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || grid[nr][nc] === 1) return;
    fox.r = nr;
    fox.c = nc;
    moves++;
    render();
    if (fox.r === goal.r && fox.c === goal.c) {
      // Score: basis van 200 punten per ronde, minus 3 punten per move
      // Minimum score is altijd 10 per ronde
      const roundScore = Math.max(10, 200 - moves * 3);
      totalScore += roundScore;
      if (currentRound >= TOTAL_ROUNDS) {
        area.innerHTML = '<p class="game-score">Alle ' + TOTAL_ROUNDS + ' rondes! Score: ' + totalScore + '</p>';
        window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
          window.Leaderboard.render(leaderboardEl, CLASS_ID);
        });
      } else {
        currentRound++;
        area.innerHTML =
          '<p class="game-score">Ronde voltooid! Score: ' + roundScore + '. Totaal: ' + totalScore + '</p>' +
          '<button type="button" id="vossen-next">Volgende ronde</button>';
        document.getElementById('vossen-next').addEventListener('click', run);
      }
    }
  }

  function handleKey(e) {
    var wrap = area.querySelector('.vossen-grid-wrap');
    if (!wrap) return;
    var dr = 0, dc = 0;
    if (e.key === 'ArrowUp' || e.key === 'Up' || e.key === '8') {
      dr = -1;
    } else if (e.key === 'ArrowDown' || e.key === 'Down' || e.key === '2') {
      dr = 1;
    } else if (e.key === 'ArrowLeft' || e.key === 'Left' || e.key === '4') {
      dc = -1;
    } else if (e.key === 'ArrowRight' || e.key === 'Right' || e.key === '6') {
      dc = 1;
    }
    if (dr !== 0 || dc !== 0) {
      e.preventDefault();
      move(dr, dc);
    }
  }

  document.addEventListener('keydown', handleKey);
  area.addEventListener('click', function () {
    var wrap = area.querySelector('.vossen-grid-wrap');
    if (wrap) wrap.focus();
  });

  function run() {
    var wallChance = currentRound === 1 ? 0.28 : currentRound === 2 ? 0.35 : 0.42;
    moves = 0;
    fox = { r: 0, c: 0 };
    goal = { r: ROWS - 1, c: COLS - 1 };
    createMaze(wallChance);
    render();
  }

  run();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
