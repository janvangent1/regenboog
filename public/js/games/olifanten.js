(function () {
  const CLASS_ID = 'olifanten';
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  const TOTAL_ROUNDS = 3;

  const GRID_BY_ROUND = [5, 6, 7];
  const PATH_LEN_BY_ROUND = [6, 9, 12];
  const ROUND_SECONDS = [55, 50, 45];
  const SHOW_STEP_MS = [520, 430, 360];

  let currentRound = 1;
  let totalScore = 0;
  let mistakes = 0;
  let roundStartMs = 0;
  let roundEndMs = 0;
  let timerId = null;
  let running = false;

  let canvas = null;
  let ctx = null;
  let gridSize = 5;
  let cellSize = 80;

  let route = [];
  let playerRoute = [];
  let isShowingRoute = false;
  let showIndex = 0;
  let highlightedKey = '';
  let startCell = null;
  let endCell = null;

  function playSound(freq, duration, type) {
    try {
      const a = new (window.AudioContext || window.webkitAudioContext)();
      const o = a.createOscillator();
      const g = a.createGain();
      o.connect(g);
      g.connect(a.destination);
      o.frequency.value = freq;
      o.type = type || 'sine';
      g.gain.setValueAtTime(0.28, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, a.currentTime + duration);
      o.start(a.currentTime);
      o.stop(a.currentTime + duration);
    } catch (e) {}
  }

  function playCorrectSound() {
    playSound(650, 0.09, 'sine');
  }

  function playWrongSound() {
    playSound(210, 0.2, 'sawtooth');
  }

  function playRoundWinSound() {
    playSound(620, 0.12, 'sine');
    setTimeout(function () { playSound(760, 0.12, 'sine'); }, 120);
    setTimeout(function () { playSound(900, 0.16, 'sine'); }, 240);
  }

  function keyFor(r, c) {
    return r + ',' + c;
  }

  function roundIdx() {
    return Math.max(0, Math.min(TOTAL_ROUNDS - 1, currentRound - 1));
  }

  function inBounds(r, c) {
    return r >= 0 && r < gridSize && c >= 0 && c < gridSize;
  }

  function randomStartCell() {
    return { r: gridSize - 1, c: Math.floor(Math.random() * gridSize) };
  }

  function buildRoute() {
    const targetLen = PATH_LEN_BY_ROUND[roundIdx()];
    const visited = {};
    const path = [];
    let cur = randomStartCell();
    startCell = { r: cur.r, c: cur.c };
    path.push({ r: cur.r, c: cur.c });
    visited[keyFor(cur.r, cur.c)] = true;

    while (path.length < targetLen) {
      const dirs = [
        { dr: -1, dc: 0 },
        { dr: 1, dc: 0 },
        { dr: 0, dc: -1 },
        { dr: 0, dc: 1 }
      ];

      for (let i = dirs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = dirs[i];
        dirs[i] = dirs[j];
        dirs[j] = t;
      }

      let moved = false;
      for (let i = 0; i < dirs.length; i++) {
        const nr = cur.r + dirs[i].dr;
        const nc = cur.c + dirs[i].dc;
        const k = keyFor(nr, nc);
        if (!inBounds(nr, nc) || visited[k]) continue;
        visited[k] = true;
        cur = { r: nr, c: nc };
        path.push({ r: nr, c: nc });
        moved = true;
        break;
      }

      if (!moved) return buildRoute();
    }

    route = path;
    endCell = path[path.length - 1];
  }

  function calculateLiveScore() {
    const elapsed = Math.max(0, (Date.now() - roundStartMs) / 1000);
    const base = currentRound === 1 ? 180 : currentRound === 2 ? 260 : 360;
    const mistakePenalty = mistakes * 18;
    const timePenalty = Math.floor(elapsed * 1.2);
    const progressBonus = Math.floor((playerRoute.length / Math.max(1, route.length)) * 40);
    return Math.max(10, Math.floor(base - mistakePenalty - timePenalty + progressBonus));
  }

  function drawGrid() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#d8f3dc');
    grad.addColorStop(1, '#b7e4c7');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const x = c * cellSize;
        const y = r * cellSize;
        const k = keyFor(r, c);
        const isStart = startCell && startCell.r === r && startCell.c === c;
        const isEnd = endCell && endCell.r === r && endCell.c === c;
        const inPlayerTrail = playerRoute.some(function (cell) { return cell.r === r && cell.c === c; });

        let fill = 'rgba(255,255,255,0.50)';
        if (k === highlightedKey) fill = '#ffe066';
        else if (inPlayerTrail) fill = '#bde0fe';
        else if (isStart) fill = '#caffbf';
        else if (isEnd) fill = '#90e0ef';

        ctx.fillStyle = fill;
        ctx.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
      }
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= gridSize; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(canvas.width, i * cellSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, canvas.height);
      ctx.stroke();
    }

    if (startCell) {
      ctx.font = Math.floor(cellSize * 0.55) + 'px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🐘', (startCell.c + 0.5) * cellSize, (startCell.r + 0.50) * cellSize);
    }
    if (endCell) {
      ctx.font = Math.floor(cellSize * 0.50) + 'px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💧', (endCell.c + 0.5) * cellSize, (endCell.r + 0.50) * cellSize);
    }
  }

  function showRouteStep() {
    if (!running || !isShowingRoute) return;

    if (showIndex >= route.length) {
      highlightedKey = '';
      isShowingRoute = false;
      const inst = document.getElementById('olifanten-inst');
      if (inst) inst.textContent = 'Jouw beurt: klik de route van de olifant naar de waterpoel.';
      drawGrid();
      return;
    }

    const cell = route[showIndex];
    highlightedKey = keyFor(cell.r, cell.c);
    drawGrid();
    playCorrectSound();
    showIndex++;
    setTimeout(showRouteStep, SHOW_STEP_MS[roundIdx()]);
  }

  function roundDone() {
    running = false;
    isShowingRoute = false;
    highlightedKey = '';
    clearInterval(timerId);
    timerId = null;

    const roundScore = calculateLiveScore();
    totalScore += roundScore;
    playRoundWinSound();

    if (currentRound >= TOTAL_ROUNDS) {
      area.innerHTML = `
        <div style="text-align:center; padding:2rem;">
          <h2 class="game-score" style="font-size:1.8rem; color:#2a9d8f;">Geweldig! Alle routes onthouden!</h2>
          <p style="font-size:1.2rem; margin:0.7rem 0;">Laatste ronde score: <strong>${roundScore}</strong></p>
          <p style="font-size:1.5rem; margin:0.9rem 0;">Totaal score: <strong>${totalScore}</strong></p>
        </div>
      `;
      window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
        window.Leaderboard.render(leaderboardEl, CLASS_ID);
      });
      return;
    }

    area.innerHTML = `
      <div style="text-align:center; padding:2rem;">
        <h2 class="game-score" style="font-size:1.5rem; color:#2a9d8f;">Ronde ${currentRound} voltooid!</h2>
        <p style="font-size:1.1rem; margin:0.6rem 0;">Ronde score: <strong>${roundScore}</strong></p>
        <p style="font-size:1.1rem; margin:0.6rem 0;">Totaal score: <strong>${totalScore}</strong></p>
        <button type="button" id="olifanten-next" style="padding:0.8rem 1.2rem; margin-top:0.8rem; border:0; border-radius:10px; background:#2a9d8f; color:#fff; font-weight:600; cursor:pointer;">
          Start ronde ${currentRound + 1}
        </button>
      </div>
    `;

    document.getElementById('olifanten-next').addEventListener('click', function () {
      currentRound++;
      startRound();
    });
  }

  function onTimeUp() {
    running = false;
    isShowingRoute = false;
    highlightedKey = '';
    clearInterval(timerId);
    timerId = null;
    playWrongSound();

    area.innerHTML = `
      <div style="text-align:center; padding:2rem;">
        <h2 class="game-score" style="font-size:1.8rem; color:#e63946;">Tijd om!</h2>
        <p style="font-size:1.1rem; margin:0.7rem 0;">Je totaal score: <strong>${totalScore}</strong></p>
      </div>
    `;
    window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
      window.Leaderboard.render(leaderboardEl, CLASS_ID);
    });
  }

  function onCanvasClick(ev) {
    if (!running || isShowingRoute) return;
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const c = Math.floor(x / cellSize);
    const r = Math.floor(y / cellSize);
    if (!inBounds(r, c)) return;

    const expected = route[playerRoute.length];
    if (!expected) return;

    if (expected.r === r && expected.c === c) {
      playerRoute.push({ r: r, c: c });
      playCorrectSound();
      drawGrid();
      if (playerRoute.length >= route.length) {
        roundDone();
      }
    } else {
      mistakes++;
      playWrongSound();
      playerRoute = [];
      const inst = document.getElementById('olifanten-inst');
      if (inst) inst.textContent = 'Fout pad! Probeer opnieuw vanaf de olifant.';
      drawGrid();
    }
  }

  function tickHud() {
    if (!running) return;
    const remaining = Math.max(0, Math.ceil((roundEndMs - Date.now()) / 1000));
    window.RegenboogCore.updateHUDTimer(CLASS_ID, remaining, true);
    window.RegenboogCore.updateHUDScore(CLASS_ID, calculateLiveScore() + totalScore);
    if (remaining <= 0) onTimeUp();
  }

  function startRound() {
    const idx = roundIdx();
    running = true;
    mistakes = 0;
    playerRoute = [];
    route = [];
    isShowingRoute = true;
    showIndex = 0;
    highlightedKey = '';
    roundStartMs = Date.now();
    roundEndMs = roundStartMs + ROUND_SECONDS[idx] * 1000;

    gridSize = GRID_BY_ROUND[idx];
    const hudHtml = window.RegenboogCore.createHUD(CLASS_ID, currentRound, TOTAL_ROUNDS, true, true);
    area.innerHTML =
      hudHtml +
      `<div style="text-align:center; margin-bottom:0.55rem; color:#445; font-weight:600;">
        Onthoud de route naar de waterpoel en klik die daarna terug.
      </div>
      <p id="olifanten-inst" style="text-align:center; margin:0.4rem 0 0.7rem 0; color:#445;">
        Kijk goed... de route wordt getoond.
      </p>
      <canvas id="olifanten-canvas" style="display:block; margin:0 auto; border:2px solid var(--border); border-radius:12px; background:#d8f3dc;"></canvas>`;

    canvas = document.getElementById('olifanten-canvas');
    ctx = canvas.getContext('2d');

    const maxSize = Math.min(640, area.offsetWidth - 40);
    canvas.width = maxSize;
    canvas.height = maxSize;
    canvas.style.width = maxSize + 'px';
    canvas.style.height = maxSize + 'px';
    cellSize = canvas.width / gridSize;

    buildRoute();
    drawGrid();
    canvas.addEventListener('click', onCanvasClick);

    tickHud();
    clearInterval(timerId);
    timerId = setInterval(tickHud, 120);
    setTimeout(showRouteStep, 450);
  }

  function init() {
    currentRound = 1;
    totalScore = 0;
    running = false;
    clearInterval(timerId);
    timerId = null;
    area.innerHTML = `
      <div style="text-align: center; margin-bottom: 1rem;">
        <h3>Waterpoel Route Geheugen</h3>
        <p style="font-size: 1.05rem; color: #555; margin-bottom: 0.6rem;">
          Help de olifant de weg naar de waterpoel te onthouden.
        </p>
        <div style="margin: 1rem 0; padding: 1rem; background: #f0f0f0; border-radius: 8px;">
          <p style="margin: 0.5rem 0;"><strong>Hoe te spelen:</strong></p>
          <p style="margin: 0.5rem 0;">👀 Kijk goed naar het pad dat kort oplicht</p>
          <p style="margin: 0.5rem 0;">🖱️ Klik daarna dezelfde route in exact dezelfde volgorde</p>
          <p style="margin: 0.5rem 0;">🎯 Doel: bereik de waterpoel zonder fouten</p>
          <p style="margin: 0.5rem 0;">⏱️ 3 rondes: langer pad, sneller tonen, minder tijd</p>
        </div>
        <button id="olifanten-start" style="padding: 1rem 2rem; font-size: 1.1rem; background: linear-gradient(135deg, #2a9d8f, #264653); color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: 700;">
          Start spel
        </button>
      </div>
    `;
    const startBtn = document.getElementById('olifanten-start');
    if (startBtn) startBtn.addEventListener('click', startRound);
  }

  init();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
