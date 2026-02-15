(function () {
  const CLASS_ID = 'zwaluwen';
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  const TOTAL_ROUNDS = 3;

  const ROUND_TIME_SECONDS = [95, 105, 115];
  const PLAYER_STEP_MS = [170, 160, 150];
  // Hogere waarde = tragere roofvogelbeweging (makkelijker).
  const PREDATOR_STEP_MS = [425, 405, 365];
  const PREDATOR_COUNT_BY_ROUND = [1, 2, 3];
  const PREDATOR_CHASE_BIAS_BY_ROUND = [0.62, 0.44, 0.5];
  const PELLET_SCORE = 8;
  const COLLISION_PENALTY = 30;
  const VISUAL_SMOOTH_SPEED = 20;

  const MAPS = [
    [
      '#############',
      '#S....#....P#',
      '#.##.#.#.##.#',
      '#....#.#....#',
      '###.##.##.###',
      '#...........#',
      '#.##.###.##.#',
      '#....#.#....#',
      '#.##.#.#.##.#',
      '#....#.#....#',
      '#############'
    ],
    [
      '###############',
      '#S...#...#...P#',
      '#.###.#.#.#.#.#',
      '#...#.#.#.#...#',
      '#.#.#...#...#.#',
      '#.#.###.###.#.#',
      '#...#.....#...#',
      '#.###.#.#.#.###',
      '#.....#.#.#...#',
      '#.###.#.#.#.#.#',
      '#...#...#...#.#',
      '#P#.#.###.#.#P#',
      '###############'
    ],
    [
      '#################',
      '#S...#...#...#P.#',
      '#.###.#.#.#.###.#',
      '#.....#.#.#.....#',
      '#.###.....###.#.#',
      '#...#.###.#...#.#',
      '#.#.#.....#.#.#.#',
      '#.#.###.###.#.#.#',
      '#...#...#...#...#',
      '#.###.#.#.#.###.#',
      '#.....#...#.....#',
      '#.#.###.#.###.#.#',
      '#P#.....#.....#P#',
      '#...###...###...#',
      '#################'
    ]
  ];

  const DIRS = {
    up: { r: -1, c: 0 },
    down: { r: 1, c: 0 },
    left: { r: 0, c: -1 },
    right: { r: 0, c: 1 },
    none: { r: 0, c: 0 }
  };

  const TILE_SIZE = 28;
  let currentRound = 1;
  let totalScore = 0;
  let running = false;
  let map = [];
  let rows = 0;
  let cols = 0;
  let pelletsLeft = 0;
  let timeLeft = 0;
  let rafId = null;
  let lastTs = 0;
  let playerAcc = 0;
  let predatorAcc = 0;
  let timerAcc = 0;
  let collisionFlash = 0;
  let message = '';

  let canvas = null;
  let ctx = null;
  let audioCtx = null;
  let audioUnlocked = false;
  let audioUnlockInFlight = false;
  const pendingSounds = [];
  let swallowImage = null;
  let swallowImageReady = false;

  let player = null;
  let predators = [];
  let playerVisual = { x: 0, y: 0 };
  const input = { nextDir: 'none' };
  const listeners = [];

  function addListener(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    listeners.push({ target: target, type: type, fn: fn, opts: opts });
  }

  function clearListeners() {
    while (listeners.length) {
      const l = listeners.pop();
      l.target.removeEventListener(l.type, l.fn, l.opts);
    }
  }

  function playSound(freq, duration, type) {
    try {
      const ctxAudio = getAudioContext();
      if (!ctxAudio) return;
      const startTone = function () {
        const osc = ctxAudio.createOscillator();
        const gain = ctxAudio.createGain();
        osc.connect(gain);
        gain.connect(ctxAudio.destination);
        osc.frequency.value = freq;
        osc.type = type || 'sine';
        gain.gain.setValueAtTime(0.2, ctxAudio.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctxAudio.currentTime + duration);
        osc.start(ctxAudio.currentTime);
        osc.stop(ctxAudio.currentTime + duration);
      };
      if (ctxAudio.state === 'suspended') {
        ctxAudio.resume().then(startTone).catch(function () {});
      } else {
        startTone();
      }
    } catch (e) {
      // Geluid mag het spel nooit breken.
    }
  }

  function getAudioContext() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        audioCtx = null;
      }
    }
    return audioCtx;
  }

  function unlockAudio(playConfirmTone) {
    const ctxAudio = getAudioContext();
    if (!ctxAudio) return;
    if (audioUnlocked) return;
    if (audioUnlockInFlight) return;
    audioUnlockInFlight = true;

    const finalizeUnlock = function () {
      // Prime output in dezelfde user gesture om audio policies te passeren.
      try {
        const osc = ctxAudio.createOscillator();
        const gain = ctxAudio.createGain();
        osc.connect(gain);
        gain.connect(ctxAudio.destination);
        gain.gain.setValueAtTime(0.00001, ctxAudio.currentTime);
        osc.frequency.value = 220;
        osc.start(ctxAudio.currentTime);
        osc.stop(ctxAudio.currentTime + 0.01);
      } catch (e) {}
      audioUnlocked = true;
      if (audioUnlocked && playConfirmTone) {
        try {
          const osc = ctxAudio.createOscillator();
          const gain = ctxAudio.createGain();
          osc.connect(gain);
          gain.connect(ctxAudio.destination);
          gain.gain.setValueAtTime(0.03, ctxAudio.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.00001, ctxAudio.currentTime + 0.02);
          osc.frequency.value = 440;
          osc.type = 'sine';
          osc.start(ctxAudio.currentTime);
          osc.stop(ctxAudio.currentTime + 0.02);
        } catch (e) {}
      }
      while (pendingSounds.length > 0) {
        const s = pendingSounds.shift();
        playSound(s.freq, s.duration, s.type);
      }
      audioUnlockInFlight = false;
    };

    if (ctxAudio.state === 'suspended') {
      ctxAudio.resume().then(finalizeUnlock).catch(function () {
        audioUnlockInFlight = false;
      });
    } else {
      finalizeUnlock();
    }
  }

  function playPelletSound() { playSound(540, 0.08, 'triangle'); }
  function playHitSound() { playSound(190, 0.25, 'sawtooth'); }
  function playRoundWinSound() { playSound(720, 0.12, 'sine'); setTimeout(function () { playSound(890, 0.15, 'sine'); }, 120); }
  function playLoseSound() { playSound(140, 0.4, 'triangle'); }

  function dirEquals(a, b) {
    return DIRS[a].r === DIRS[b].r && DIRS[a].c === DIRS[b].c;
  }

  function isWall(r, c) {
    return r < 0 || c < 0 || r >= rows || c >= cols || map[r][c] === '#';
  }

  function cellCenter(r, c) {
    return {
      x: c * TILE_SIZE + TILE_SIZE / 2,
      y: r * TILE_SIZE + TILE_SIZE / 2
    };
  }

  function parseMap(roundIdx) {
    const raw = MAPS[roundIdx];
    rows = raw.length;
    cols = raw[0].length;
    map = [];
    pelletsLeft = 0;
    predators = [];
    for (let r = 0; r < rows; r++) {
      const line = raw[r];
      const row = [];
      for (let c = 0; c < cols; c++) {
        const ch = line[c];
        if (ch === '#') {
          row.push('#');
        } else if (ch === 'S') {
          row.push('.');
          player = { r: r, c: c, dir: 'none', nextDir: 'none', spawnR: r, spawnC: c };
          pelletsLeft++;
        } else if (ch === 'P') {
          row.push('.');
          const center = cellCenter(r, c);
          predators.push({
            r: r, c: c, dir: 'left', spawnR: r, spawnC: c,
            vx: center.x, vy: center.y
          });
          pelletsLeft++;
        } else if (ch === '.') {
          row.push('.');
          pelletsLeft++;
        } else {
          row.push(' ');
        }
      }
      map.push(row);
    }
    limitPredatorsForRound(roundIdx);
    enforceReachableMap();
    syncVisualPositions(true);
  }

  function limitPredatorsForRound(roundIdx) {
    const allowed = PREDATOR_COUNT_BY_ROUND[roundIdx] || predators.length;
    if (predators.length <= allowed) return;

    // Behoud de roofvogels die het verst van de start staan, voor een eerlijkere start.
    const pr = player.spawnR;
    const pc = player.spawnC;
    predators.sort(function (a, b) {
      const da = Math.abs(a.r - pr) + Math.abs(a.c - pc);
      const db = Math.abs(b.r - pr) + Math.abs(b.c - pc);
      return db - da;
    });
    predators = predators.slice(0, allowed);
  }

  function cellKey(r, c) {
    return r + ',' + c;
  }

  function computeReachableFromStart() {
    const start = { r: player.spawnR, c: player.spawnC };
    const queue = [start];
    const visited = {};
    visited[cellKey(start.r, start.c)] = true;
    const list = [start];
    const dirs = ['up', 'down', 'left', 'right'];

    while (queue.length > 0) {
      const cur = queue.shift();
      for (let i = 0; i < dirs.length; i++) {
        const d = DIRS[dirs[i]];
        const nr = cur.r + d.r;
        const nc = cur.c + d.c;
        const key = cellKey(nr, nc);
        if (visited[key] || isWall(nr, nc)) continue;
        visited[key] = true;
        const next = { r: nr, c: nc };
        queue.push(next);
        list.push(next);
      }
    }
    return { visited: visited, list: list };
  }

  function enforceReachableMap() {
    const reach = computeReachableFromStart();
    // Verwijder alle onbereikbare vrije tegels/bolletjes uit de map
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (map[r][c] === '#') continue;
        if (!reach.visited[cellKey(r, c)]) {
          if (map[r][c] === '.') pelletsLeft = Math.max(0, pelletsLeft - 1);
          map[r][c] = '#';
        }
      }
    }

    // Zet roofvogels altijd op bereikbare vrije tegels
    const validPredatorCells = reach.list.filter(function (cell) {
      return !(cell.r === player.r && cell.c === player.c) && !isWall(cell.r, cell.c);
    });
    for (let i = 0; i < predators.length; i++) {
      const p = predators[i];
      if (!reach.visited[cellKey(p.r, p.c)] && validPredatorCells.length > 0) {
        const pick = validPredatorCells[Math.floor(Math.random() * validPredatorCells.length)];
        p.r = pick.r;
        p.c = pick.c;
        p.spawnR = pick.r;
        p.spawnC = pick.c;
      }
    }
  }

  function setMessage(text) {
    message = text;
    const el = document.getElementById('zwaluwen-message');
    if (el) el.textContent = text;
  }

  function updateHud() {
    window.RegenboogCore.updateHUDRound(CLASS_ID, currentRound);
    window.RegenboogCore.updateHUDScore(CLASS_ID, totalScore);
    window.RegenboogCore.updateHUDTimer(CLASS_ID, timeLeft, true);
    const progressEl = document.getElementById('zwaluwen-progress');
    if (progressEl) progressEl.textContent = 'Bolletjes over: ' + pelletsLeft;
  }

  function movePlayer() {
    player.nextDir = input.nextDir;
    if (player.nextDir !== 'none') {
      const nd = DIRS[player.nextDir];
      if (!isWall(player.r + nd.r, player.c + nd.c)) player.dir = player.nextDir;
    }
    if (player.dir !== 'none') {
      const d = DIRS[player.dir];
      if (!isWall(player.r + d.r, player.c + d.c)) {
        player.r += d.r;
        player.c += d.c;
      }
    }

    if (map[player.r][player.c] === '.') {
      map[player.r][player.c] = ' ';
      pelletsLeft--;
      totalScore += PELLET_SCORE;
      playPelletSound();
    }
  }

  function choosePredatorDir(pred) {
    const options = ['up', 'down', 'left', 'right'].filter(function (dir) {
      const d = DIRS[dir];
      return !isWall(pred.r + d.r, pred.c + d.c);
    });
    if (options.length === 0) return 'none';
    const reverse = pred.dir === 'up' ? 'down' : pred.dir === 'down' ? 'up' : pred.dir === 'left' ? 'right' : 'left';
    let filtered = options;
    if (options.length > 1 && reverse && options.indexOf(reverse) !== -1) {
      filtered = options.filter(function (o) { return o !== reverse; });
    }
    const roundIdx = Math.max(0, Math.min(TOTAL_ROUNDS - 1, currentRound - 1));
    const chaseBias = Math.random() < PREDATOR_CHASE_BIAS_BY_ROUND[roundIdx];
    if (!chaseBias) return filtered[Math.floor(Math.random() * filtered.length)];
    let best = filtered[0];
    let bestDist = Infinity;
    for (let i = 0; i < filtered.length; i++) {
      const dir = filtered[i];
      const d = DIRS[dir];
      const nr = pred.r + d.r;
      const nc = pred.c + d.c;
      const dist = Math.abs(nr - player.r) + Math.abs(nc - player.c);
      if (dist < bestDist) {
        bestDist = dist;
        best = dir;
      }
    }
    return best;
  }

  function movePredators() {
    for (let i = 0; i < predators.length; i++) {
      const p = predators[i];
      p.dir = choosePredatorDir(p);
      if (p.dir !== 'none') {
        const d = DIRS[p.dir];
        p.r += d.r;
        p.c += d.c;
      }
    }
  }

  function resetPositionsAfterHit() {
    player.r = player.spawnR;
    player.c = player.spawnC;
    player.dir = 'none';
    input.nextDir = 'none';
    for (let i = 0; i < predators.length; i++) {
      predators[i].r = predators[i].spawnR;
      predators[i].c = predators[i].spawnC;
      predators[i].dir = 'left';
    }
    syncVisualPositions(true);
  }

  function syncVisualPositions(immediate) {
    const playerCenter = cellCenter(player.r, player.c);
    if (immediate) {
      playerVisual.x = playerCenter.x;
      playerVisual.y = playerCenter.y;
    }
    for (let i = 0; i < predators.length; i++) {
      const p = predators[i];
      const center = cellCenter(p.r, p.c);
      if (immediate || typeof p.vx !== 'number' || typeof p.vy !== 'number') {
        p.vx = center.x;
        p.vy = center.y;
      }
    }
  }

  function smoothValue(current, target, dt) {
    const alpha = 1 - Math.exp(-VISUAL_SMOOTH_SPEED * dt);
    return current + (target - current) * alpha;
  }

  function updateVisualMotion(dt) {
    const playerCenter = cellCenter(player.r, player.c);
    playerVisual.x = smoothValue(playerVisual.x, playerCenter.x, dt);
    playerVisual.y = smoothValue(playerVisual.y, playerCenter.y, dt);

    for (let i = 0; i < predators.length; i++) {
      const p = predators[i];
      const center = cellCenter(p.r, p.c);
      p.vx = smoothValue(p.vx, center.x, dt);
      p.vy = smoothValue(p.vy, center.y, dt);
    }
  }

  function checkCollisions() {
    for (let i = 0; i < predators.length; i++) {
      if (predators[i].r === player.r && predators[i].c === player.c) {
        totalScore = Math.max(0, totalScore - COLLISION_PENALTY);
        collisionFlash = 0.25;
        playHitSound();
        setMessage('Botsing met roofvogel! -' + COLLISION_PENALTY + ' punten');
        resetPositionsAfterHit();
        break;
      }
    }
  }

  function draw() {
    if (!ctx) return;
    const w = cols * TILE_SIZE;
    const h = rows * TILE_SIZE;

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#f6f7fb');
    bg.addColorStop(1, '#e8ebf4');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;
        if (map[r][c] === '#') {
          ctx.fillStyle = '#6f7892';
          ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          ctx.strokeStyle = '#8f99b4';
          ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        } else if (map[r][c] === '.') {
          ctx.fillStyle = '#52b788';
          ctx.beginPath();
          ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 3.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#d8f3dc';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
    }

    const px = playerVisual.x;
    const py = playerVisual.y;
    drawSwallowIcon(px, py);

    for (let i = 0; i < predators.length; i++) {
      const p = predators[i];
      const gx = p.vx;
      const gy = p.vy;
      ctx.font = '21px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(i % 2 === 0 ? '🦅' : '🦉', gx, gy + 7);
    }

    if (collisionFlash > 0) {
      ctx.fillStyle = 'rgba(255,80,80,0.32)';
      ctx.fillRect(0, 0, w, h);
    }
  }

  function drawSwallowIcon(cx, cy) {
    // Gebruik bij voorkeur dezelfde zwaluw-afbeelding als op de homepage.
    if (swallowImageReady && swallowImage) {
      const size = 22;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 12, cy - 12, 24, 24);
      ctx.drawImage(swallowImage, cx - size / 2, cy - size / 2, size, size);
      ctx.restore();
      ctx.strokeStyle = '#2f5a8a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }

    // Fallback: eenvoudige eigen tekening.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1.05, 1.05);

    // Staart (gevorkt)
    ctx.fillStyle = '#1f3f66';
    ctx.beginPath();
    ctx.moveTo(-3, 6);
    ctx.lineTo(-8, 13);
    ctx.lineTo(-1, 10);
    ctx.lineTo(1, 10);
    ctx.lineTo(8, 13);
    ctx.lineTo(3, 6);
    ctx.closePath();
    ctx.fill();

    // Linkervleugel
    ctx.beginPath();
    ctx.moveTo(-3, -1);
    ctx.quadraticCurveTo(-14, -11, -18, -1);
    ctx.quadraticCurveTo(-10, 3, -4, 2);
    ctx.closePath();
    ctx.fill();

    // Rechtervleugel
    ctx.beginPath();
    ctx.moveTo(3, -1);
    ctx.quadraticCurveTo(14, -11, 18, -1);
    ctx.quadraticCurveTo(10, 3, 4, 2);
    ctx.closePath();
    ctx.fill();

    // Lichaam
    ctx.fillStyle = '#2a5688';
    ctx.beginPath();
    ctx.ellipse(0, 1.5, 6.6, 8.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Buik
    ctx.fillStyle = '#f2f8ff';
    ctx.beginPath();
    ctx.ellipse(0, 4, 3.4, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Kop
    ctx.fillStyle = '#2a5688';
    ctx.beginPath();
    ctx.arc(0, -6.2, 4.2, 0, Math.PI * 2);
    ctx.fill();

    // Oog
    ctx.fillStyle = '#0f1f33';
    ctx.beginPath();
    ctx.arc(1.2, -6.7, 0.9, 0, Math.PI * 2);
    ctx.fill();

    // Snavel
    ctx.fillStyle = '#f0a43d';
    ctx.beginPath();
    ctx.moveTo(3.7, -5.7);
    ctx.lineTo(7.6, -4.8);
    ctx.lineTo(3.7, -3.8);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function stopGameLoop() {
    running = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function finishGame() {
    stopGameLoop();
    clearListeners();
    area.innerHTML =
      '<p class="game-score">Eindscore: ' + totalScore + '</p>' +
      '<p class="zwaluwen-end-note">De zwaluw heeft dapper door het luchtdoolhof gevlogen.</p>';
    window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
      window.Leaderboard.render(leaderboardEl, CLASS_ID);
    });
  }

  function completeRound() {
    stopGameLoop();
    clearListeners();
    playRoundWinSound();
    const bonus = Math.max(0, timeLeft * 4);
    totalScore += bonus;
    if (currentRound >= TOTAL_ROUNDS) {
      area.innerHTML =
        '<p class="game-score">Alle rondes gehaald! Bonus: +' + bonus + ' - Eindscore: ' + totalScore + '</p>' +
        '<p class="zwaluwen-message">Scoreformulier opent automatisch...</p>';
      setTimeout(function () {
        finishGame();
      }, 1200);
      return;
    }
    area.innerHTML =
      '<p class="game-score">Ronde ' + currentRound + ' voltooid! Bonus: +' + bonus + '</p>' +
      '<button type="button" class="zwaluwen-next-btn" id="zwaluwen-next">Volgende ronde</button>';
    const nextBtn = document.getElementById('zwaluwen-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        currentRound++;
        startRound();
      });
    }
  }

  function failRound() {
    stopGameLoop();
    clearListeners();
    playLoseSound();
    area.innerHTML =
      '<p class="game-score">Tijd op! Eindscore: ' + totalScore + '</p>' +
      '<button type="button" class="zwaluwen-next-btn" id="zwaluwen-retry">Opnieuw starten</button>';
    const retryBtn = document.getElementById('zwaluwen-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        totalScore = 0;
        currentRound = 1;
        startRound();
      });
    }
    window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
      window.Leaderboard.render(leaderboardEl, CLASS_ID);
    });
  }

  function tick(ts) {
    if (!running) return;
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;

    playerAcc += dt * 1000;
    predatorAcc += dt * 1000;
    timerAcc += dt;
    collisionFlash = Math.max(0, collisionFlash - dt);
    updateVisualMotion(dt);

    const roundIdx = currentRound - 1;
    while (playerAcc >= PLAYER_STEP_MS[roundIdx]) {
      playerAcc -= PLAYER_STEP_MS[roundIdx];
      movePlayer();
      checkCollisions();
      if (pelletsLeft <= 0) {
        updateHud();
        draw();
        completeRound();
        return;
      }
    }
    while (predatorAcc >= PREDATOR_STEP_MS[roundIdx]) {
      predatorAcc -= PREDATOR_STEP_MS[roundIdx];
      movePredators();
      checkCollisions();
    }
    if (timerAcc >= 1) {
      const elapsed = Math.floor(timerAcc);
      timerAcc -= elapsed;
      timeLeft = Math.max(0, timeLeft - elapsed);
      if (timeLeft <= 0) {
        updateHud();
        draw();
        failRound();
        return;
      }
    }

    updateHud();
    draw();
    rafId = requestAnimationFrame(tick);
  }

  function setupControls() {
    clearListeners();
    unlockAudio();

    const unlockFromGesture = function () {
      unlockAudio();
    };
    addListener(document, 'mousedown', unlockFromGesture, { passive: true });
    addListener(document, 'touchstart', unlockFromGesture, { passive: true });
    addListener(document, 'click', unlockFromGesture, { passive: true });
    addListener(window, 'keydown', unlockFromGesture, true);

    // Gebruik window+capture voor maximale betrouwbaarheid bij toetsenbordinput.
    addListener(window, 'keydown', function (e) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        unlockAudio(true);
        input.nextDir = 'up';
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        unlockAudio(true);
        input.nextDir = 'down';
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        unlockAudio(true);
        input.nextDir = 'left';
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        unlockAudio(true);
        input.nextDir = 'right';
      } else {
        unlockAudio();
      }
      // Eerste arrow input moet audio ook echt activeren op sommige browsers.
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        playSound(420, 0.02, 'sine');
      }
    }, true);

    function bindDir(id, dir) {
      const btn = document.getElementById(id);
      if (!btn) return;
      addListener(btn, 'click', function () {
        unlockAudio();
        input.nextDir = dir;
      });
      addListener(btn, 'touchstart', function () {
        unlockAudio();
      }, { passive: true });
    }
    bindDir('zw-dir-up', 'up');
    bindDir('zw-dir-down', 'down');
    bindDir('zw-dir-left', 'left');
    bindDir('zw-dir-right', 'right');
  }

  function startRound() {
    stopGameLoop();
    const roundIdx = currentRound - 1;
    parseMap(roundIdx);
    timeLeft = ROUND_TIME_SECONDS[roundIdx];
    input.nextDir = 'none';
    message = 'Verzamel alle bolletjes en ontwijk roofvogels.';
    collisionFlash = 0;
    playerAcc = 0;
    predatorAcc = 0;
    timerAcc = 0;
    lastTs = 0;

    const width = cols * TILE_SIZE;
    const height = rows * TILE_SIZE;
    area.innerHTML =
      window.RegenboogCore.createHUD(CLASS_ID, currentRound, TOTAL_ROUNDS, true, true) +
      '<div class="zwaluwen-layout">' +
      '<p class="zwaluwen-instruction">Pac-vlucht: vlieg met de zwaluw door het doolhof, pak alle bolletjes en blijf uit de buurt van de roofvogels.</p>' +
      '<p id="zwaluwen-progress" class="zwaluwen-progress"></p>' +
      '<canvas id="zwaluwen-canvas" class="zwaluwen-canvas" width="' + width + '" height="' + height + '"></canvas>' +
      '<div class="zwaluwen-controls">' +
      '<button type="button" class="zwaluwen-dir-btn zwaluwen-dir-btn-up" id="zw-dir-up" aria-label="Omhoog">▲</button>' +
      '<button type="button" class="zwaluwen-dir-btn zwaluwen-dir-btn-left" id="zw-dir-left" aria-label="Links">◀</button>' +
      '<button type="button" class="zwaluwen-dir-btn zwaluwen-dir-btn-down" id="zw-dir-down" aria-label="Omlaag">▼</button>' +
      '<button type="button" class="zwaluwen-dir-btn zwaluwen-dir-btn-right" id="zw-dir-right" aria-label="Rechts">▶</button>' +
      '</div>' +
      '<p id="zwaluwen-message" class="zwaluwen-message">' + message + '</p>' +
      '</div>';

    canvas = document.getElementById('zwaluwen-canvas');
    ctx = canvas.getContext('2d');
    setupControls();
    syncVisualPositions(true);
    updateHud();
    draw();
    running = true;
    rafId = requestAnimationFrame(tick);
  }

  function initSwallowImage() {
    swallowImage = new Image();
    swallowImage.onload = function () {
      swallowImageReady = true;
    };
    swallowImage.onerror = function () {
      swallowImageReady = false;
    };
    swallowImage.src = '/assets/images/classes/zwaluwen.png';
  }

  initSwallowImage();

  function showIntro() {
    area.innerHTML =
      '<div style="text-align:center; margin-bottom:1rem;">' +
      '  <h3>Zwaluwen - Luchtdoolhof</h3>' +
      '  <p style="font-size:1.05rem; color:#555; margin-bottom:0.6rem;">Vlieg door het doolhof, pak bolletjes en ontwijk roofvogels.</p>' +
      '  <div style="margin:1rem 0; padding:1rem; background:#eef6ff; border-radius:8px; display:inline-block; text-align:left;">' +
      '    <p style="margin:0.5rem 0;"><strong>Hoe te spelen:</strong></p>' +
      '    <p style="margin:0.5rem 0;">- Gebruik pijltjestoetsen of richtingknoppen</p>' +
      '    <p style="margin:0.5rem 0;">- Verzamel alle bolletjes per ronde</p>' +
      '    <p style="margin:0.5rem 0;">- Vermijd roofvogels in 3 rondes</p>' +
      '  </div>' +
      '  <div><button type="button" id="zwaluwen-start" style="padding:1rem 2rem; font-size:1.1rem; background:linear-gradient(135deg, #2b6cb0, #1e4e82); color:white; border:none; border-radius:12px; cursor:pointer; font-weight:700;">Start spel</button></div>' +
      '</div>';
    var startBtn = document.getElementById('zwaluwen-start');
    if (startBtn) {
      startBtn.addEventListener('click', function () {
        currentRound = 1;
        totalScore = 0;
        startRound();
      });
    }
  }

  showIntro();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
