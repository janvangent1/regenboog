(function () {
  const CLASS_ID = 'pandas';
  const TOTAL_ROUNDS = 3;
  const ROUND_SECONDS = [45, 50, 55];
  const TARGET_PER_ROUND = [14, 20, 28];
  const SPAWN_INTERVAL_MS = [980, 760, 560];
  const BUBBLE_RISE_SPEED = [55, 72, 92];
  const ANIMAL_FALL_GRAVITY = 220;
  const PLAYER_SPEED = 290;
  const FIRE_COOLDOWN_MS = 220;
  const ESCAPE_PENALTY = 12;
  const OBSTACLE_TYPES = [
    { key: 'konijn', label: 'konijn', emoji: '🐇', hp: 1, radius: [14, 18], points: 14, speedBoost: 0, color: '#8fbf83', weight: [38, 28, 20] },
    { key: 'egel', label: 'egel', emoji: '🦔', hp: 1, radius: [15, 19], points: 16, speedBoost: 8, color: '#9c8a73', weight: [30, 30, 26] },
    { key: 'vogel', label: 'kleine vogel', emoji: '🐤', hp: 2, radius: [16, 21], points: 22, speedBoost: 10, color: '#84a9c9', weight: [20, 25, 28] },
    { key: 'koala', label: 'koala', emoji: '🐨', hp: 2, radius: [18, 23], points: 26, speedBoost: 14, color: '#9ea4b8', weight: [10, 14, 18] },
    { key: 'panda', label: 'baby panda', emoji: '🐼', hp: 3, radius: [22, 28], points: 36, speedBoost: 20, color: '#b3a1a1', weight: [2, 7, 12] }
  ];

  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');

  let currentRound = 1;
  let totalScore = 0;
  let rescuedThisRound = 0;
  let roundEnded = false;

  let canvas = null;
  let ctx = null;
  let animationId = null;
  let lastFrameTs = 0;
  let spawnAccumulator = 0;
  let roundTimeLeft = 0;
  let fireCooldown = 0;

  const keys = { left: false, right: false };
  let bullets = [];
  let bubbles = [];
  let fallingAnimals = [];
  let player = { x: 200, y: 360, w: 52, h: 52 };

  const listeners = [];

  function hexToRgba(hex, alpha) {
    const clean = (hex || '').replace('#', '');
    if (clean.length !== 6) return 'rgba(120, 120, 120, ' + alpha + ')';
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
  }

  function addListener(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    listeners.push({ target: target, type: type, handler: handler, options: options });
  }

  function clearListeners() {
    while (listeners.length > 0) {
      const entry = listeners.pop();
      entry.target.removeEventListener(entry.type, entry.handler, entry.options);
    }
  }

  function playSound(freq, duration, type) {
    try {
      const audio = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.frequency.value = freq;
      osc.type = type || 'sine';
      gain.gain.setValueAtTime(0.22, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audio.currentTime + duration);
      osc.start(audio.currentTime);
      osc.stop(audio.currentTime + duration);
    } catch (e) {}
  }

  function playShootSound() { playSound(470, 0.08, 'square'); }
  function playHitSound() { playSound(210, 0.2, 'sawtooth'); }
  function playDestroySound() { playSound(650, 0.1, 'triangle'); }
  function playRoundWinSound() { playSound(750, 0.15, 'sine'); setTimeout(function () { playSound(900, 0.16, 'sine'); }, 120); }
  function playGameOverSound() { playSound(140, 0.45, 'triangle'); }

  function getRoundIndex() {
    return Math.max(0, Math.min(TOTAL_ROUNDS - 1, currentRound - 1));
  }

  function updateHud() {
    window.RegenboogCore.updateHUDRound(CLASS_ID, currentRound);
    window.RegenboogCore.updateHUDTimer(CLASS_ID, roundTimeLeft, true);
    window.RegenboogCore.updateHUDScore(CLASS_ID, totalScore);
    const progressEl = document.getElementById('pandas-progress');
    if (progressEl) {
      progressEl.textContent = 'Gered: ' + rescuedThisRound + '/' + TARGET_PER_ROUND[getRoundIndex()] + ' dieren';
    }
  }

  function spawnBubble() {
    const idx = getRoundIndex();
    let totalWeight = 0;
    for (let i = 0; i < OBSTACLE_TYPES.length; i++) {
      totalWeight += OBSTACLE_TYPES[i].weight[idx];
    }
    let pick = Math.random() * totalWeight;
    let chosen = OBSTACLE_TYPES[0];
    for (let i = 0; i < OBSTACLE_TYPES.length; i++) {
      pick -= OBSTACLE_TYPES[i].weight[idx];
      if (pick <= 0) {
        chosen = OBSTACLE_TYPES[i];
        break;
      }
    }

    const radius = chosen.radius[0] + Math.random() * (chosen.radius[1] - chosen.radius[0]);

    bubbles.push({
      x: radius + Math.random() * (canvas.width - radius * 2),
      y: canvas.height + radius + Math.random() * 45,
      radius: radius,
      speed: BUBBLE_RISE_SPEED[idx] + chosen.speedBoost + Math.random() * 28,
      hp: chosen.hp,
      maxHp: chosen.hp,
      type: chosen.key,
      label: chosen.label,
      emoji: chosen.emoji,
      color: chosen.color,
      points: chosen.points
    });
  }

  function shootBamboo() {
    if (roundEnded || fireCooldown > 0) return;
    bullets.push({
      x: player.x + player.w / 2,
      y: player.y - 8,
      vy: 420
    });
    fireCooldown = FIRE_COOLDOWN_MS / 1000;
    playShootSound();
  }

  function updateGame(dt) {
    const idx = getRoundIndex();

    roundTimeLeft = Math.max(0, roundTimeLeft - dt);
    fireCooldown = Math.max(0, fireCooldown - dt);

    if (keys.left) player.x -= PLAYER_SPEED * dt;
    if (keys.right) player.x += PLAYER_SPEED * dt;
    player.x = Math.max(6, Math.min(canvas.width - player.w - 6, player.x));

    spawnAccumulator += dt * 1000;
    while (spawnAccumulator >= SPAWN_INTERVAL_MS[idx]) {
      spawnAccumulator -= SPAWN_INTERVAL_MS[idx];
      spawnBubble();
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      bullets[i].y -= bullets[i].vy * dt;
      if (bullets[i].y < -20) bullets.splice(i, 1);
    }

    for (let j = bubbles.length - 1; j >= 0; j--) {
      const d = bubbles[j];
      d.y -= d.speed * dt;

      if (d.y + d.radius < -10) {
        bubbles.splice(j, 1);
        totalScore = Math.max(0, totalScore - ESCAPE_PENALTY);
        playHitSound();
        const msg = document.getElementById('pandas-message');
        if (msg) msg.textContent = d.label + ' is weggezweefd! -' + ESCAPE_PENALTY + ' punten';
        continue;
      }

      for (let b = bullets.length - 1; b >= 0; b--) {
        const bullet = bullets[b];
        const dx = d.x - bullet.x;
        const dy = d.y - bullet.y;
        if (dx * dx + dy * dy <= (d.radius + 6) * (d.radius + 6)) {
          bullets.splice(b, 1);
          d.hp -= 1;
          if (d.hp <= 0) {
            bubbles.splice(j, 1);
            fallingAnimals.push({
              x: d.x,
              y: d.y,
              vy: 15 + Math.random() * 20,
              emoji: d.emoji,
              points: d.points,
              label: d.label
            });
            playDestroySound();
          }
          break;
        }
      }
    }

    for (let a = fallingAnimals.length - 1; a >= 0; a--) {
      const animal = fallingAnimals[a];
      animal.vy += ANIMAL_FALL_GRAVITY * dt;
      animal.y += animal.vy * dt;
      if (animal.y >= canvas.height - 18) {
        fallingAnimals.splice(a, 1);
        rescuedThisRound++;
        totalScore += animal.points + Math.max(0, Math.floor(roundTimeLeft * 0.25));
      }
    }

    if (!roundEnded && rescuedThisRound >= TARGET_PER_ROUND[idx]) {
      endRound(true);
      return;
    }
    if (!roundEnded && roundTimeLeft <= 0) {
      endRound(false);
      return;
    }

    updateHud();
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#0b1d38');
    grad.addColorStop(1, '#1f3f64');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let s = 0; s < 26; s++) {
      const x = (s * 83 + currentRound * 11) % canvas.width;
      const y = (s * 57 + currentRound * 19) % canvas.height;
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(x, y, 2, 2);
    }
  }

  function drawPlayer() {
    const cx = player.x + player.w / 2;
    const cy = player.y + player.h / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.arc(cx, cy, player.w * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = '34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🐼', cx, cy + 11);
  }

  function drawBullets() {
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      ctx.fillStyle = '#a5d66f';
      ctx.fillRect(b.x - 3, b.y - 14, 6, 18);
      ctx.fillStyle = '#d8f0b9';
      ctx.fillRect(b.x - 1, b.y - 16, 2, 5);
    }
  }

  function drawBubbles() {
    for (let i = 0; i < bubbles.length; i++) {
      const d = bubbles[i];
      const wobble = Math.sin((d.y + i * 25) / 22) * 1.2;
      const cx = d.x + wobble;
      ctx.fillStyle = hexToRgba(d.color, 0.42);
      ctx.beginPath();
      ctx.arc(cx, d.y, d.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.62)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.arc(cx - d.radius * 0.28, d.y - d.radius * 0.28, d.radius * 0.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = (d.radius > 22 ? '23px' : '20px') + ' sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.emoji, cx, d.y + 7);

      if (d.hp > 1 && d.hp < d.maxHp) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(d.hp), cx, d.y - d.radius - 4);
      }
    }
  }

  function drawFallingAnimals() {
    for (let i = 0; i < fallingAnimals.length; i++) {
      const a = fallingAnimals[i];
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(a.emoji, a.x, a.y + 7);
    }
  }

  function drawOverlay() {
    // no overlay needed in rescue mode
  }

  function frame(ts) {
    if (!lastFrameTs) lastFrameTs = ts;
    const dt = Math.min(0.033, (ts - lastFrameTs) / 1000);
    lastFrameTs = ts;

    drawBackground();
    if (!roundEnded) updateGame(dt);
    drawBubbles();
    drawBullets();
    drawFallingAnimals();
    drawPlayer();
    drawOverlay();

    if (!roundEnded) animationId = requestAnimationFrame(frame);
  }

  function stopLoop() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function endRound(won) {
    roundEnded = true;
    stopLoop();
    updateHud();
    const msg = document.getElementById('pandas-message');
    const nextBtn = document.getElementById('pandas-next');
    const shootBtn = document.getElementById('pandas-shoot');
    if (shootBtn) shootBtn.disabled = true;

    if (won) {
      playRoundWinSound();
      if (msg) msg.textContent = 'Ronde gehaald! Je hebt genoeg dieren gered.';
      if (nextBtn) {
        nextBtn.style.display = 'inline-block';
        nextBtn.textContent = currentRound >= TOTAL_ROUNDS ? 'Bekijk eindscore' : 'Volgende ronde';
      }
      return;
    }

    playGameOverSound();
    if (msg) msg.textContent = 'Tijd om! Te weinig dieren gered in deze ronde.';
    finishGame();
  }

  function finishGame() {
    roundEnded = true;
    stopLoop();
    const controls = document.querySelector('.pandas-controls');
    if (controls) controls.style.display = 'none';
    const nextBtn = document.getElementById('pandas-next');
    if (nextBtn) nextBtn.style.display = 'none';

    area.innerHTML =
      window.RegenboogCore.createHUD(CLASS_ID, currentRound, TOTAL_ROUNDS, true, true) +
      '<div class="pandas-finish">' +
      '<p class="game-score">Eindscore: ' + totalScore + '</p>' +
      '<p>Je panda heeft dieren gered uit de wegzwevende bellen.</p>' +
      '</div>';
    window.RegenboogCore.updateHUDScore(CLASS_ID, totalScore);
    window.RegenboogCore.updateHUDRound(CLASS_ID, currentRound);
    window.RegenboogCore.updateHUDTimer(CLASS_ID, 0, true);

    window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
      window.Leaderboard.render(leaderboardEl, CLASS_ID);
    });
  }

  function setupInputHandlers() {
    clearListeners();

    addListener(document, 'keydown', function (e) {
      if (e.key === 'ArrowLeft') keys.left = true;
      if (e.key === 'ArrowRight') keys.right = true;
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        shootBamboo();
      }
    });

    addListener(document, 'keyup', function (e) {
      if (e.key === 'ArrowLeft') keys.left = false;
      if (e.key === 'ArrowRight') keys.right = false;
    });

    function bindHold(id, field) {
      const btn = document.getElementById(id);
      if (!btn) return;
      const onStart = function (e) {
        e.preventDefault();
        keys[field] = true;
      };
      const onEnd = function (e) {
        e.preventDefault();
        keys[field] = false;
      };
      addListener(btn, 'mousedown', onStart);
      addListener(btn, 'touchstart', onStart, { passive: false });
      addListener(btn, 'mouseup', onEnd);
      addListener(btn, 'mouseleave', onEnd);
      addListener(btn, 'touchend', onEnd);
      addListener(btn, 'touchcancel', onEnd);
    }

    bindHold('pandas-left', 'left');
    bindHold('pandas-right', 'right');

    const shootBtn = document.getElementById('pandas-shoot');
    if (shootBtn) {
      addListener(shootBtn, 'click', function () {
        shootBamboo();
      });
    }

    const nextBtn = document.getElementById('pandas-next');
    if (nextBtn) {
      addListener(nextBtn, 'click', function () {
        if (currentRound >= TOTAL_ROUNDS) {
          finishGame();
          return;
        }
        currentRound++;
        renderRound();
      });
    }
  }

  function renderRound() {
    roundEnded = false;
    rescuedThisRound = 0;
    roundTimeLeft = ROUND_SECONDS[getRoundIndex()];
    bullets = [];
    bubbles = [];
    fallingAnimals = [];
    spawnAccumulator = 0;
    fireCooldown = 0;
    keys.left = false;
    keys.right = false;
    lastFrameTs = 0;

    area.innerHTML =
      window.RegenboogCore.createHUD(CLASS_ID, currentRound, TOTAL_ROUNDS, true, true) +
      '<div class="pandas-layout">' +
      '  <p id="pandas-progress" class="pandas-progress">Gered: 0/' + TARGET_PER_ROUND[getRoundIndex()] + ' dieren</p>' +
      '  <div class="pandas-legend">' +
      '    <span class="pandas-legend-title">Dieren in bellen:</span>' +
      '    <span class="pandas-legend-item">🐇 konijn (1 x raken)</span>' +
      '    <span class="pandas-legend-item">🦔 egel (1 x raken)</span>' +
      '    <span class="pandas-legend-item">🐤 vogel (2 x raken)</span>' +
      '    <span class="pandas-legend-item">🐨 koala (2 x raken)</span>' +
      '    <span class="pandas-legend-item">🐼 baby panda (3 x raken)</span>' +
      '  </div>' +
      '  <canvas id="pandas-canvas" class="pandas-canvas" width="420" height="420" aria-label="Panda space invaders speelveld"></canvas>' +
      '  <div class="pandas-controls">' +
      '    <button type="button" id="pandas-left" class="pandas-control-btn">◀ Links</button>' +
      '    <button type="button" id="pandas-shoot" class="pandas-control-btn pandas-shoot-btn">🎋 Vuur</button>' +
      '    <button type="button" id="pandas-right" class="pandas-control-btn">Rechts ▶</button>' +
      '  </div>' +
      '  <p id="pandas-message" class="pandas-message">Besturing: pijltjes links/rechts + spatie om te schieten.</p>' +
      '  <button type="button" id="pandas-next" class="pandas-next" style="display:none;">Volgende ronde</button>' +
      '</div>';

    canvas = document.getElementById('pandas-canvas');
    ctx = canvas.getContext('2d');
    player = { x: (canvas.width - 52) / 2, y: canvas.height - 62, w: 52, h: 52 };

    setupInputHandlers();
    updateHud();
    stopLoop();
    animationId = requestAnimationFrame(frame);
  }

  function showIntro() {
    area.innerHTML =
      '<div style="text-align:center; margin-bottom:1rem;">' +
      '  <h3>Panda Space Verdediging</h3>' +
      '  <p style="font-size:1.05rem; color:#555; margin-bottom:0.6rem;">Schiet bellen kapot en red de dieren binnen de tijd.</p>' +
      '  <div style="margin:1rem 0; padding:1rem; background:#eef8f0; border-radius:8px; display:inline-block; text-align:left;">' +
      '    <p style="margin:0.5rem 0;"><strong>Hoe te spelen:</strong></p>' +
      '    <p style="margin:0.5rem 0;">- Beweeg met pijltjes links/rechts of knoppen</p>' +
      '    <p style="margin:0.5rem 0;">- Schiet met spatie of de vuurknop</p>' +
      '    <p style="margin:0.5rem 0;">- Red genoeg dieren in 3 rondes</p>' +
      '  </div>' +
      '  <div><button type="button" id="pandas-start" style="padding:1rem 2rem; font-size:1.1rem; background:linear-gradient(135deg, #2f855a, #276749); color:white; border:none; border-radius:12px; cursor:pointer; font-weight:700;">Start spel</button></div>' +
      '</div>';
    var startBtn = document.getElementById('pandas-start');
    if (startBtn) {
      startBtn.addEventListener('click', function () {
        currentRound = 1;
        totalScore = 0;
        renderRound();
      });
    }
  }

  showIntro();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
