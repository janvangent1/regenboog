(function () {
  const CLASS_ID = 'koalas';
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  const TOTAL_ROUNDS = 3;
  const ROUND_SECONDS = [45, 45, 45];
  const BALL_SPEED = [4.0, 5.0, 6.2];
  const CPU_SPEED = [2.5, 3.8, 5.4];
  const CPU_ERROR = [40, 26, 14];
  const PLAYER_POINTS_PER_GOAL = [20, 30, 40];
  const WIN_BONUS = [40, 60, 80];

  let canvas = null;
  let ctx = null;
  let running = false;
  let currentRound = 1;
  let totalScore = 0;
  let roundScore = 0;
  let timerId = null;
  let roundEndMs = 0;
  let rafId = null;
  let lastTickMs = 0;

  const paddle = {
    w: 14,
    h: 84,
    gap: 20
  };

  let playerY = 0;
  let cpuY = 0;
  let cpuTargetY = 0;
  let cpuAimY = 0;
  let cpuErrorOffset = 0;
  let cpuTargetRefreshMs = 0;

  let ball = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    r: 8
  };

  let playerGoals = 0;
  let cpuGoals = 0;

  const input = {
    up: false,
    down: false
  };

  function playSound(frequency, duration, type) {
    try {
      const a = new (window.AudioContext || window.webkitAudioContext)();
      const o = a.createOscillator();
      const g = a.createGain();
      o.connect(g);
      g.connect(a.destination);
      o.frequency.value = frequency;
      o.type = type || 'sine';
      g.gain.setValueAtTime(0.24, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, a.currentTime + duration);
      o.start(a.currentTime);
      o.stop(a.currentTime + duration);
    } catch (e) {}
  }

  function playPaddleSound() {
    playSound(520, 0.05, 'square');
  }

  function playScoreSound() {
    playSound(760, 0.12, 'sine');
  }

  function playLosePointSound() {
    playSound(210, 0.2, 'sawtooth');
  }

  function playRoundWinSound() {
    playSound(600, 0.1, 'sine');
    setTimeout(function () { playSound(720, 0.11, 'sine'); }, 90);
    setTimeout(function () { playSound(860, 0.14, 'sine'); }, 180);
  }

  function getRoundIndex() {
    return Math.max(0, Math.min(TOTAL_ROUNDS - 1, currentRound - 1));
  }

  function resetBall(servingToPlayer) {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    const base = BALL_SPEED[getRoundIndex()];
    const dir = servingToPlayer ? -1 : 1;
    ball.vx = dir * base;
    // Kleine variatie zodat rally's minder voorspelbaar zijn.
    ball.vy = (Math.random() * 2 - 1) * base * 0.65;
  }

  function calculateLiveScore() {
    const idx = getRoundIndex();
    return Math.max(0, totalScore + roundScore + playerGoals * PLAYER_POINTS_PER_GOAL[idx] - cpuGoals * 10);
  }

  function updateHud() {
    const remaining = Math.max(0, Math.ceil((roundEndMs - Date.now()) / 1000));
    window.RegenboogCore.updateHUDTimer(CLASS_ID, remaining, true);
    window.RegenboogCore.updateHUDScore(CLASS_ID, calculateLiveScore());
    if (remaining <= 0 && running) {
      finishRound();
    }
  }

  function clamp(v, min, max) {
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  function updatePlayer(dt) {
    const speed = 330;
    if (input.up) playerY -= speed * dt;
    if (input.down) playerY += speed * dt;
    playerY = clamp(playerY, 0, canvas.height - paddle.h);
  }

  function updateCpu(dt) {
    const idx = getRoundIndex();
    const now = Date.now();

    // Refresh only occasionally to avoid jittery re-targeting.
    if (now >= cpuTargetRefreshMs) {
      cpuErrorOffset = Math.random() * CPU_ERROR[idx] - CPU_ERROR[idx] / 2;
      cpuTargetRefreshMs = now + 280;
    }

    // If ball moves away from CPU, recentre a bit instead of hard-chasing.
    const recenter = canvas.height / 2 - paddle.h / 2;
    const rawTarget = (ball.vx > 0 ? (ball.y - paddle.h / 2) : recenter) + cpuErrorOffset;
    cpuTargetY = clamp(rawTarget, 0, canvas.height - paddle.h);

    // Smooth aim interpolation (main anti-jitter part).
    const aimLerp = Math.min(1, dt * 6.5);
    cpuAimY += (cpuTargetY - cpuAimY) * aimLerp;

    // Move paddle toward smoothed aim with capped speed.
    const diff = cpuAimY - cpuY;
    const deadZone = 2.5;
    const maxStep = CPU_SPEED[idx] * 60 * dt;
    if (Math.abs(diff) > deadZone) {
      cpuY += clamp(diff, -maxStep, maxStep);
    }

    cpuY = clamp(cpuY, 0, canvas.height - paddle.h);
  }

  function intersectsPaddle(px, py) {
    return ball.x + ball.r >= px &&
      ball.x - ball.r <= px + paddle.w &&
      ball.y + ball.r >= py &&
      ball.y - ball.r <= py + paddle.h;
  }

  function updateBall(dt) {
    ball.x += ball.vx * dt * 60;
    ball.y += ball.vy * dt * 60;

    // Top/bottom bounce.
    if (ball.y - ball.r <= 0) {
      ball.y = ball.r;
      ball.vy *= -1;
      playPaddleSound();
    } else if (ball.y + ball.r >= canvas.height) {
      ball.y = canvas.height - ball.r;
      ball.vy *= -1;
      playPaddleSound();
    }

    // Left paddle (player).
    const playerX = paddle.gap;
    if (intersectsPaddle(playerX, playerY) && ball.vx < 0) {
      ball.x = playerX + paddle.w + ball.r;
      const rel = (ball.y - (playerY + paddle.h / 2)) / (paddle.h / 2);
      ball.vx = Math.abs(ball.vx) * 1.03;
      ball.vy += rel * 1.6;
      playPaddleSound();
    }

    // Right paddle (CPU).
    const cpuX = canvas.width - paddle.gap - paddle.w;
    if (intersectsPaddle(cpuX, cpuY) && ball.vx > 0) {
      ball.x = cpuX - ball.r;
      const rel = (ball.y - (cpuY + paddle.h / 2)) / (paddle.h / 2);
      ball.vx = -Math.abs(ball.vx) * 1.03;
      ball.vy += rel * 1.6;
      playPaddleSound();
    }

    // Score events.
    if (ball.x + ball.r < 0) {
      cpuGoals++;
      roundScore = Math.max(0, roundScore - 8);
      playLosePointSound();
      resetBall(false);
    } else if (ball.x - ball.r > canvas.width) {
      playerGoals++;
      roundScore += PLAYER_POINTS_PER_GOAL[getRoundIndex()];
      playScoreSound();
      resetBall(true);
    }
  }

  function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background.
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#d7f2c8');
    grad.addColorStop(1, '#a8d48f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Middle dashed line.
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 12]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 8);
    ctx.lineTo(canvas.width / 2, canvas.height - 8);
    ctx.stroke();
    ctx.setLineDash([]);

    // Paddles.
    const playerX = paddle.gap;
    const cpuX = canvas.width - paddle.gap - paddle.w;
    ctx.fillStyle = '#2f5d2a';
    ctx.fillRect(playerX, playerY, paddle.w, paddle.h);
    ctx.fillRect(cpuX, cpuY, paddle.w, paddle.h);

    // Simple koala icons on paddles.
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐨', playerX + paddle.w / 2, playerY + paddle.h / 2);
    ctx.fillText('🤖', cpuX + paddle.w / 2, cpuY + paddle.h / 2);

    // Ball.
    ctx.beginPath();
    ctx.fillStyle = '#fff';
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();

    // Round duel score overlay (not total score; that is in HUD).
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(canvas.width / 2 - 95, 10, 190, 34);
    ctx.fillStyle = '#fff';
    ctx.font = '16px Arial';
    ctx.fillText('Jij ' + playerGoals + ' - ' + cpuGoals + ' CPU', canvas.width / 2, 27);
  }

  function frame(ts) {
    if (!running) return;
    if (!lastTickMs) lastTickMs = ts;
    const dt = Math.min(0.05, (ts - lastTickMs) / 1000);
    lastTickMs = ts;

    updatePlayer(dt);
    updateCpu(dt);
    updateBall(dt);
    drawGame();
    rafId = requestAnimationFrame(frame);
  }

  function stopRoundLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastTickMs = 0;
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function finishRound() {
    if (!running) return;
    running = false;
    stopTimer();
    stopRoundLoop();

    // End-of-round bonus based on duel result.
    const idx = getRoundIndex();
    if (playerGoals > cpuGoals) {
      roundScore += WIN_BONUS[idx];
      playRoundWinSound();
    } else if (playerGoals === cpuGoals) {
      roundScore += Math.floor(WIN_BONUS[idx] / 2);
      playScoreSound();
    } else {
      playLosePointSound();
    }

    totalScore = Math.max(0, totalScore + roundScore);

    if (currentRound >= TOTAL_ROUNDS) {
      area.innerHTML = `
        <div style="text-align:center; padding:2rem;">
          <h2 class="game-score" style="font-size:1.8rem; color:#2a9d8f;">Koala Pong klaar!</h2>
          <p style="font-size:1.1rem; margin:0.6rem 0;">Laatste duel: Jij ${playerGoals} - ${cpuGoals} CPU</p>
          <p style="font-size:1.1rem; margin:0.6rem 0;">Ronde score: <strong>${roundScore}</strong></p>
          <p style="font-size:1.5rem; margin:0.9rem 0;">Totaal score: <strong>${totalScore}</strong></p>
        </div>
      `;
      window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
        window.Leaderboard.render(leaderboardEl, CLASS_ID);
      });
      return;
    }

    const nextRound = currentRound + 1;
    area.innerHTML = `
      <div style="text-align:center; padding:2rem;">
        <h2 class="game-score" style="font-size:1.5rem; color:#2a9d8f;">Ronde ${currentRound} klaar!</h2>
        <p style="font-size:1.1rem; margin:0.6rem 0;">Duel: Jij ${playerGoals} - ${cpuGoals} CPU</p>
        <p style="font-size:1.1rem; margin:0.6rem 0;">Ronde score: <strong>${roundScore}</strong></p>
        <p style="font-size:1.1rem; margin:0.6rem 0;">Totaal score: <strong>${totalScore}</strong></p>
        <button type="button" id="koalas-next" style="padding:0.8rem 1.2rem; margin-top:0.8rem; border:0; border-radius:10px; background:#2a9d8f; color:#fff; font-weight:600; cursor:pointer;">
          Start ronde ${nextRound}
        </button>
      </div>
    `;
    document.getElementById('koalas-next').addEventListener('click', function () {
      currentRound = nextRound;
      startRound();
    });
  }

  function startRound() {
    running = true;
    roundScore = 0;
    playerGoals = 0;
    cpuGoals = 0;

    const hudHtml = window.RegenboogCore.createHUD(CLASS_ID, currentRound, TOTAL_ROUNDS, true, true);
    area.innerHTML =
      hudHtml +
      `<div style="text-align:center; margin-bottom:0.5rem; color:#445; font-weight:600;">
        Koala Pong - Ronde ${currentRound}/${TOTAL_ROUNDS}
      </div>
      <canvas id="koalas-canvas" style="display:block; margin:0 auto; border:2px solid var(--border); border-radius:12px; background:#d7f2c8;"></canvas>
      <div class="arrow-pad arrow-pad-vertical" id="koalas-paddle-pad" style="max-width:80px;">
        <button type="button" class="arrow-pad-btn" id="koalas-btn-up" aria-label="Omhoog">↑</button>
        <button type="button" class="arrow-pad-btn" id="koalas-btn-down" aria-label="Omlaag">↓</button>
      </div>`;

    canvas = document.getElementById('koalas-canvas');
    ctx = canvas.getContext('2d');
    const containerWidth = area.offsetWidth - 40;
    canvas.width = Math.min(760, containerWidth);
    canvas.height = 460;
    canvas.style.width = canvas.width + 'px';
    canvas.style.height = canvas.height + 'px';

    playerY = canvas.height / 2 - paddle.h / 2;
    cpuY = canvas.height / 2 - paddle.h / 2;
    cpuTargetY = cpuY;
    cpuAimY = cpuY;
    cpuErrorOffset = 0;
    cpuTargetRefreshMs = 0;
    resetBall(Math.random() > 0.5);

    roundEndMs = Date.now() + ROUND_SECONDS[getRoundIndex()] * 1000;
    window.RegenboogCore.updateHUDScore(CLASS_ID, totalScore);
    window.RegenboogCore.updateHUDTimer(CLASS_ID, ROUND_SECONDS[getRoundIndex()], true);

    stopTimer();
    timerId = setInterval(updateHud, 120);
    updateHud();
    stopRoundLoop();
    rafId = requestAnimationFrame(frame);

    var btnUp = document.getElementById('koalas-btn-up');
    var btnDown = document.getElementById('koalas-btn-down');
    if (btnUp) {
      btnUp.addEventListener('pointerdown', function () { input.up = true; });
      btnUp.addEventListener('pointerup', function () { input.up = false; });
      btnUp.addEventListener('pointerleave', function () { input.up = false; });
    }
    if (btnDown) {
      btnDown.addEventListener('pointerdown', function () { input.down = true; });
      btnDown.addEventListener('pointerup', function () { input.down = false; });
      btnDown.addEventListener('pointerleave', function () { input.down = false; });
    }
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowUp' || e.key === 'Up' || e.key === 'w' || e.key === 'W') {
      e.preventDefault();
      input.up = true;
    } else if (e.key === 'ArrowDown' || e.key === 'Down' || e.key === 's' || e.key === 'S') {
      e.preventDefault();
      input.down = true;
    }
  }

  function onKeyUp(e) {
    if (e.key === 'ArrowUp' || e.key === 'Up' || e.key === 'w' || e.key === 'W') {
      input.up = false;
    } else if (e.key === 'ArrowDown' || e.key === 'Down' || e.key === 's' || e.key === 'S') {
      input.down = false;
    }
  }

  function init() {
    currentRound = 1;
    totalScore = 0;
    roundScore = 0;
    running = false;
    stopTimer();
    stopRoundLoop();
    area.innerHTML = `
      <div style="text-align:center; margin-bottom:1rem;">
        <h3>Koala Pong Duel</h3>
        <p>Speel 3 rondes Pong tegen de computer. Elke ronde wordt moeilijker.</p>
        <p style="margin:0.6rem 0; color:#556;">
          ⬆️⬇️ of W/S om je paddle te bewegen.
        </p>
        <button id="koalas-start" style="padding:0.9rem 1.4rem; font-size:1.05rem; border:0; border-radius:10px; background:#2a9d8f; color:#fff; font-weight:700; cursor:pointer;">
          Start spel
        </button>
      </div>
    `;
    const startBtn = document.getElementById('koalas-start');
    if (startBtn) {
      startBtn.addEventListener('click', startRound);
    }
  }

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  init();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
