(function () {
  const CLASS_ID = 'vossen';
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  const TOTAL_ROUNDS = 3;
  const GRID_SIZES = [
    { rows: 6, cols: 8 },   // ronde 1
    { rows: 6, cols: 8 },   // ronde 2
    { rows: 8, cols: 10 }   // ronde 3 moeilijker: groter grid
  ];
  let rows = GRID_SIZES[0].rows;
  let cols = GRID_SIZES[0].cols;
  let grid = [];
  let fox = { r: 0, c: 0 };
  let goal = { r: rows - 1, c: cols - 1 };
  let moves = 0;
  let currentRound = 1;
  let totalScore = 0;

  function playCorrectSound() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      function play() {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 600;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
      }
      if (ctx.state === 'suspended') {
        ctx.resume().then(play).catch(function () {});
      } else {
        play();
      }
    } catch (e) {}
  }

  /** BFS: is goal reachable from (0,0) without stepping on walls? */
  function isMazeSolvable() {
    var startR = 0, startC = 0;
    var goalR = rows - 1, goalC = cols - 1;
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
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
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
      for (var r = 0; r < rows; r++) {
        grid[r] = [];
        for (var c = 0; c < cols; c++) {
          grid[r][c] = r === 0 && c === 0 ? 0 : r === rows - 1 && c === cols - 1 ? 0 : Math.random() < wallChance ? 1 : 0;
        }
      }
      grid[0][0] = 0;
      grid[rows - 1][cols - 1] = 0;
      if (isMazeSolvable()) return;
    }
    /* Fallback: no walls so path is straight (should not happen often) */
    for (var r = 0; r < rows; r++) {
      grid[r] = [];
      for (var c = 0; c < cols; c++) {
        grid[r][c] = 0;
      }
    }
  }

  function removeMobilePad() {
    var el = document.getElementById('vossen-arrow-pad');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function render() {
    removeMobilePad();
    const wrap = document.createElement('div');
    wrap.className = 'vossen-grid-wrap';
    wrap.setAttribute('tabindex', '0');
    wrap.setAttribute('aria-label', 'Speelveld: stuur de vos met pijltjestoetsen naar het hol');
    wrap.style.setProperty('--vossen-cols', String(cols));
    wrap.style.setProperty('--vossen-rows', String(rows));
    wrap.style.setProperty('--vossen-aspect', String(cols) + ' / ' + String(rows));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
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
    area.innerHTML = window.RegenboogCore.createHUD(CLASS_ID, currentRound, TOTAL_ROUNDS, false, true);
    var liveScore = totalScore + Math.max(10, 200 - moves * 3);
    window.RegenboogCore.updateHUDScore(CLASS_ID, liveScore);
    window.RegenboogCore.updateHUDRound(CLASS_ID, currentRound);

    var layout = document.createElement('div');
    layout.className = 'vossen-layout';
    layout.appendChild(wrap);
    var hint = document.createElement('p');
    hint.className = 'game-score vossen-hint';
    hint.textContent = 'Ronde ' + currentRound + '/' + TOTAL_ROUNDS + '. Zetten: ' + moves + ' – Pijltjes of knoppen om het hol te bereiken.';
    layout.appendChild(hint);
    var pad = document.createElement('div');
    pad.className = 'arrow-pad';
    pad.innerHTML = '<button type="button" class="arrow-pad-btn arrow-pad-btn-up" data-dr="-1" data-dc="0" aria-label="Omhoog">↑</button><button type="button" class="arrow-pad-btn arrow-pad-btn-left" data-dr="0" data-dc="-1" aria-label="Links">←</button><button type="button" class="arrow-pad-btn arrow-pad-btn-down" data-dr="1" data-dc="0" aria-label="Omlaag">↓</button><button type="button" class="arrow-pad-btn arrow-pad-btn-right" data-dr="0" data-dc="1" aria-label="Rechts">→</button>';
    pad.id = 'vossen-arrow-pad';
    pad.querySelectorAll('.arrow-pad-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dr = parseInt(btn.getAttribute('data-dr'), 10);
        var dc = parseInt(btn.getAttribute('data-dc'), 10);
        move(dr, dc);
      });
    });
    var isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) {
      document.body.appendChild(pad);
    } else {
      layout.appendChild(pad);
    }
    area.appendChild(layout);
    wrap.focus();
  }

  function move(dr, dc) {
    const nr = fox.r + dr;
    const nc = fox.c + dc;
    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || grid[nr][nc] === 1) return;
    fox.r = nr;
    fox.c = nc;
    moves++;
    render();
    if (fox.r === goal.r && fox.c === goal.c) {
      playCorrectSound();
      // Score: basis van 200 punten per ronde, minus 3 punten per move
      // Minimum score is altijd 10 per ronde
      const roundScore = Math.max(10, 200 - moves * 3);
      totalScore += roundScore;
      if (currentRound >= TOTAL_ROUNDS) {
        removeMobilePad();
        area.innerHTML = '<p class="game-score">Alle ' + TOTAL_ROUNDS + ' rondes! Score: ' + totalScore + '</p>';
        window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
          window.Leaderboard.render(leaderboardEl, CLASS_ID);
        });
      } else {
        currentRound++;
        removeMobilePad();
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

  var audioUnlocked = false;
  function ensureAudioUnlock() {
    if (audioUnlocked) return;
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume().then(function () { audioUnlocked = true; }).catch(function () {});
      else audioUnlocked = true;
    } catch (e) {}
  }

  window.addEventListener('resize', function () {
    var pad = document.getElementById('vossen-arrow-pad');
    var inLayout = area.querySelector('.vossen-layout .arrow-pad');
    if (!pad && !inLayout) return;
    var isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (pad && pad.parentNode === document.body && !isMobile) {
      pad.parentNode.removeChild(pad);
      var layout = area.querySelector('.vossen-layout');
      if (layout) layout.appendChild(pad);
    } else if (isMobile && area.querySelector('.vossen-grid-wrap')) {
      var padInLayout = area.querySelector('.vossen-layout .arrow-pad');
      if (padInLayout && padInLayout.parentNode !== document.body) {
        padInLayout.parentNode.removeChild(padInLayout);
        padInLayout.id = 'vossen-arrow-pad';
        document.body.appendChild(padInLayout);
      }
    }
  });
  document.addEventListener('keydown', function (e) {
    ensureAudioUnlock();
    handleKey(e);
  });
  area.addEventListener('click', function () {
    var wrap = area.querySelector('.vossen-grid-wrap');
    if (wrap) wrap.focus();
  });

  function run() {
    var wallChance = currentRound === 1 ? 0.28 : currentRound === 2 ? 0.35 : 0.42;
    var size = GRID_SIZES[Math.max(0, Math.min(TOTAL_ROUNDS - 1, currentRound - 1))];
    rows = size.rows;
    cols = size.cols;
    moves = 0;
    fox = { r: 0, c: 0 };
    goal = { r: rows - 1, c: cols - 1 };
    createMaze(wallChance);
    render();
  }

  function showIntro() {
    area.innerHTML =
      '<div style="text-align:center; margin-bottom:1rem;">' +
      '  <h3>Vossen - Hol Zoeken</h3>' +
      '  <p style="font-size:1.05rem; color:#555; margin-bottom:0.6rem;">' +
      '    Help de vos de weg naar het hol te vinden in een doolhof.' +
      '  </p>' +
      '  <div style="margin:1rem 0; padding:1rem; background:#f5f0e8; border-radius:8px; display:inline-block; text-align:left;">' +
      '    <p style="margin:0.5rem 0;"><strong>Hoe te spelen:</strong></p>' +
      '    <p style="margin:0.5rem 0;">- Gebruik de pijltjestoetsen om de vos te bewegen</p>' +
      '    <p style="margin:0.5rem 0;">- Vermijd muren en bereik het hol zo snel mogelijk</p>' +
      '    <p style="margin:0.5rem 0;">- 3 rondes: ronde 3 heeft een grotere grid</p>' +
      '    <p style="margin:0.5rem 0;">- Minder zetten = hogere score</p>' +
      '  </div>' +
      '  <div>' +
      '    <button type="button" id="vossen-start" style="padding:1rem 2rem; font-size:1.1rem; background:linear-gradient(135deg, #8b4513, #6b3410); color:white; border:none; border-radius:12px; cursor:pointer; font-weight:700;">Start spel</button>' +
      '  </div>' +
      '</div>';

    var startBtn = document.getElementById('vossen-start');
    if (startBtn) {
      startBtn.addEventListener('click', function () {
        currentRound = 1;
        totalScore = 0;
        run();
      });
    }
  }

  showIntro();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
