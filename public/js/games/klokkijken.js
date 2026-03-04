(function () {
  'use strict';

  var CLASS_ID = 'klokkijken';
  var TOTAL_ROUNDS = 3;
  var QUESTIONS_PER_ROUND = 5;
  var PTS_MAX = 100;
  var PTS_MIN = 20;    // minimum pts for a correct answer regardless of time
  var PTS_PER_SEC = 5; // pts lost per elapsed second
  var PTS_WRONG = 20;  // immediate score deduction per wrong attempt

  var area = document.getElementById('game-area');
  var leaderboardEl = document.getElementById('leaderboard');

  var currentRound = 0;
  var totalScore = 0;
  var questionIndex = 0;

  var canvas, ctx;
  var targetH = 0, targetM = 0;
  var questionType = 'lees';
  var setH = 12, setM = 0;

  var questionStartTime = 0;
  var timerInterval = null;

  /* ── Timer helpers ────────────────────────────────────────── */
  function startTimer() {
    stopTimer();
    questionStartTime = Date.now();
    timerInterval = setInterval(function () {
      var elapsed = (Date.now() - questionStartTime) / 1000;
      window.RegenboogCore.updateHUDTimer(CLASS_ID, elapsed, false);
    }, 200);
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  function calcPts() {
    var elapsed = (Date.now() - questionStartTime) / 1000;
    return Math.max(PTS_MIN, PTS_MAX - Math.floor(elapsed * PTS_PER_SEC));
  }

  /* ── Time pool per round ─────────────────────────────────── */
  function getTimePool(round) {
    var pool = [];
    if (round === 1) {
      for (var h = 1; h <= 12; h++) {
        pool.push([h, 0]);
      }
    } else if (round === 2) {
      for (var h2 = 1; h2 <= 12; h2++) {
        [0, 15, 30, 45].forEach(function (m) { pool.push([h2, m]); });
      }
    } else {
      for (var h3 = 1; h3 <= 12; h3++) {
        for (var m3 = 0; m3 < 60; m3 += 5) {
          pool.push([h3, m3]);
        }
      }
    }
    return pool;
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  /* ── Time formatting ──────────────────────────────────────── */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function formatTime(h, m) { return h + ':' + pad(m); }

  /* ── Clock drawing ────────────────────────────────────────── */
  function drawClock(h, m) {
    var size = canvas.width;
    var cx = size / 2;
    var cy = size / 2;
    var r = size / 2 - 8;

    ctx.clearRect(0, 0, size, size);

    // Face
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Numbers + tick marks
    ctx.fillStyle = '#222';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + Math.round(r * 0.18) + 'px Arial';
    for (var i = 1; i <= 12; i++) {
      var angle = (i * 30 - 90) * Math.PI / 180;
      ctx.fillText('' + i, cx + Math.cos(angle) * r * 0.78, cy + Math.sin(angle) * r * 0.78);
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * r * 0.90, cy + Math.sin(angle) * r * 0.90);
      ctx.lineTo(cx + Math.cos(angle) * r * 0.97, cy + Math.sin(angle) * r * 0.97);
      ctx.stroke();
    }

    // Minute hand
    var minAngle = (m * 6 - 90) * Math.PI / 180;
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(minAngle) * r * 0.82, cy + Math.sin(minAngle) * r * 0.82);
    ctx.stroke();

    // Hour hand (include minute offset so it sits between hours)
    var hourFrac = (h % 12) + m / 60;
    var hrAngle = (hourFrac * 30 - 90) * Math.PI / 180;
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(hrAngle) * r * 0.55, cy + Math.sin(hrAngle) * r * 0.55);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ── Distractor generation ────────────────────────────────── */
  function buildDistractors(pool, correctH, correctM) {
    var distractors = [];
    var attempts = 0;
    while (distractors.length < 3 && attempts < 200) {
      attempts++;
      var candidate = pickRandom(pool);
      if (candidate[0] === correctH && candidate[1] === correctM) continue;
      var dup = false;
      for (var d = 0; d < distractors.length; d++) {
        if (distractors[d][0] === candidate[0] && distractors[d][1] === candidate[1]) { dup = true; break; }
      }
      if (!dup) distractors.push(candidate);
    }
    return distractors;
  }

  /* ── HUD ──────────────────────────────────────────────────── */
  function renderHUD() {
    return window.RegenboogCore.createHUD(CLASS_ID, currentRound, TOTAL_ROUNDS, true, true);
  }

  function refreshHUD() {
    window.RegenboogCore.updateHUDScore(CLASS_ID, totalScore);
    window.RegenboogCore.updateHUDRound(CLASS_ID, currentRound);
  }

  /* ── Show question ────────────────────────────────────────── */
  function showQuestion() {
    var pool = getTimePool(currentRound);
    var pick = pickRandom(pool);
    targetH = pick[0];
    targetM = pick[1];

    // Alternate type: even index → lees, odd → stel
    questionType = (questionIndex % 2 === 0) ? 'lees' : 'stel';

    if (questionType === 'lees') {
      showLeesQuestion(pool);
    } else {
      showStelQuestion();
    }
  }

  function showLeesQuestion(pool) {
    var distractors = buildDistractors(pool, targetH, targetM);
    var options = shuffle([[targetH, targetM]].concat(distractors));

    var buttonsHtml = options.map(function (opt) {
      return '<button class="kl-option game-btn" data-h="' + opt[0] + '" data-m="' + opt[1] + '">' + formatTime(opt[0], opt[1]) + '</button>';
    }).join('');

    area.innerHTML = renderHUD() +
      '<div style="text-align:center">' +
      '<p style="font-size:1.1em;margin:8px 0 4px">Vraag ' + (questionIndex + 1) + ' van ' + QUESTIONS_PER_ROUND + ' — Hoe laat is het?</p>' +
      '</div>' +
      '<canvas id="klokkijken-canvas" width="280" height="280" style="display:block;margin:8px auto;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.15);"></canvas>' +
      '<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:12px">' + buttonsHtml + '</div>';

    refreshHUD();
    canvas = document.getElementById('klokkijken-canvas');
    ctx = canvas.getContext('2d');
    drawClock(targetH, targetM);
    startTimer();

    area.querySelectorAll('.kl-option').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var h = parseInt(btn.getAttribute('data-h'), 10);
        var m = parseInt(btn.getAttribute('data-m'), 10);
        if (h === targetH && m === targetM) {
          stopTimer();
          btn.style.background = '#4caf50';
          btn.style.color = '#fff';
          playSound(660, 0.15, 'sine');
          totalScore += calcPts();
          window.RegenboogCore.updateHUDScore(CLASS_ID, totalScore);
          area.querySelectorAll('.kl-option').forEach(function (b) { b.disabled = true; });
          setTimeout(nextQuestion, 900);
        } else {
          btn.style.background = '#e53935';
          btn.style.color = '#fff';
          btn.disabled = true;
          totalScore = Math.max(0, totalScore - PTS_WRONG);
          window.RegenboogCore.updateHUDScore(CLASS_ID, totalScore);
          playSound(200, 0.2, 'sawtooth');
        }
      });
    });
  }

  function showStelQuestion() {
    setH = 12;
    setM = 0;

    area.innerHTML = renderHUD() +
      '<div style="text-align:center">' +
      '<p style="font-size:1.1em;margin:8px 0 4px">Vraag ' + (questionIndex + 1) + ' van ' + QUESTIONS_PER_ROUND + ' — Zet de klok op <strong>' + formatTime(targetH, targetM) + '</strong></p>' +
      '</div>' +
      '<canvas id="klokkijken-canvas" width="280" height="280" style="display:block;margin:8px auto;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.15);"></canvas>' +
      '<div style="display:flex;justify-content:center;align-items:center;gap:20px;flex-wrap:wrap;margin-top:10px">' +
        '<div style="display:flex;align-items:center;gap:6px">' +
          '<button class="kl-adj" id="kl-hr-min"  style="background:#1565c0;color:#fff;border:none;border-radius:8px;padding:10px 16px;font-size:1em;font-weight:bold;cursor:pointer;">uur −</button>' +
          '<button class="kl-adj" id="kl-hr-plus" style="background:#1565c0;color:#fff;border:none;border-radius:8px;padding:10px 16px;font-size:1em;font-weight:bold;cursor:pointer;">uur +</button>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:6px">' +
          '<button class="kl-adj" id="kl-min-min"  style="background:#e65100;color:#fff;border:none;border-radius:8px;padding:10px 16px;font-size:1em;font-weight:bold;cursor:pointer;">−5 min</button>' +
          '<button class="kl-adj" id="kl-min-plus" style="background:#e65100;color:#fff;border:none;border-radius:8px;padding:10px 16px;font-size:1em;font-weight:bold;cursor:pointer;">+5 min</button>' +
        '</div>' +
      '</div>' +
      '<div style="text-align:center;margin-top:12px">' +
        '<button class="game-btn" id="kl-submit" style="font-size:1.1em;padding:10px 28px">Klaar!</button>' +
      '</div>';

    refreshHUD();
    canvas = document.getElementById('klokkijken-canvas');
    ctx = canvas.getContext('2d');
    drawClock(setH, setM);
    startTimer();

    function updateSet() {
      drawClock(setH, setM);
    }

    document.getElementById('kl-hr-min').addEventListener('click', function () {
      setH = (setH === 1) ? 12 : setH - 1;
      updateSet();
    });
    document.getElementById('kl-hr-plus').addEventListener('click', function () {
      setH = (setH === 12) ? 1 : setH + 1;
      updateSet();
    });
    document.getElementById('kl-min-min').addEventListener('click', function () {
      setM = (setM === 0) ? 55 : setM - 5;
      updateSet();
    });
    document.getElementById('kl-min-plus').addEventListener('click', function () {
      setM = (setM === 55) ? 0 : setM + 5;
      updateSet();
    });

    document.getElementById('kl-submit').addEventListener('click', function () {
      if (setH === targetH && setM === targetM) {
        stopTimer();
        playSound(660, 0.15, 'sine');
        totalScore += calcPts();
        window.RegenboogCore.updateHUDScore(CLASS_ID, totalScore);
        area.querySelectorAll('.kl-adj, #kl-submit').forEach(function (b) { b.disabled = true; });
        ctx.fillStyle = 'rgba(76,175,80,0.25)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setTimeout(nextQuestion, 900);
      } else {
        totalScore = Math.max(0, totalScore - PTS_WRONG);
        window.RegenboogCore.updateHUDScore(CLASS_ID, totalScore);
        playSound(200, 0.2, 'sawtooth');
        ctx.fillStyle = 'rgba(229,57,53,0.25)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setTimeout(function () { drawClock(setH, setM); }, 400);
      }
    });
  }

  /* ── Navigation ───────────────────────────────────────────── */
  function nextQuestion() {
    questionIndex++;
    if (questionIndex >= QUESTIONS_PER_ROUND) {
      completeRound();
    } else {
      showQuestion();
    }
  }

  function completeRound() {
    stopTimer();
    if (currentRound >= TOTAL_ROUNDS) {
      showFinal();
    } else {
      area.innerHTML =
        '<div style="text-align:center;padding:32px">' +
        '<p style="font-size:1.4em">Ronde ' + currentRound + ' klaar! Score: <strong>' + totalScore + '</strong></p>' +
        '<button class="game-btn" id="kl-next-round" style="margin-top:16px;font-size:1.1em">Volgende ronde</button>' +
        '</div>';
      document.getElementById('kl-next-round').addEventListener('click', function () {
        startRound();
      });
    }
  }

  function showFinal() {
    area.innerHTML =
      '<div style="text-align:center;padding:32px">' +
      '<p style="font-size:1.6em">Gefeliciteerd!</p>' +
      '<p style="font-size:1.2em">Eindscore: <strong>' + totalScore + '</strong></p>' +
      '</div>';
    window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
      window.Leaderboard.render(leaderboardEl, CLASS_ID);
    });
  }

  /* ── Round / game start ───────────────────────────────────── */
  function startRound() {
    currentRound++;
    questionIndex = 0;
    showQuestion();
  }

  function showIntro() {
    area.innerHTML =
      '<div style="text-align:center;padding:32px">' +
      '<p style="font-size:1.2em;max-width:480px;margin:0 auto 20px">Lees de klok en kies het juiste tijdstip, of zet de wijzers op de gevraagde tijd! Hoe sneller, hoe meer punten!</p>' +
      '<p style="margin-bottom:8px">3 rondes · 5 vragen per ronde</p>' +
      '<p style="margin-bottom:20px;font-size:0.9em;color:#666">Ronde 1: hele uren &nbsp;|&nbsp; Ronde 2: kwartieren &nbsp;|&nbsp; Ronde 3: 5 minuten</p>' +
      '<button class="game-btn" id="kl-start" style="font-size:1.2em;padding:12px 36px">Start!</button>' +
      '</div>';
    document.getElementById('kl-start').addEventListener('click', function () {
      startRound();
    });
  }

  /* ── Boot ─────────────────────────────────────────────────── */
  showIntro();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
