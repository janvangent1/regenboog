(function () {
  'use strict';

  var CLASS_ID = 'geld-rekenen';
  var TOTAL_ROUNDS = 3;
  var QUESTIONS_PER_ROUND = 4; // 2 exact + 2 wisselgeld
  var PTS_MAX = 100;
  var PTS_MIN = 20;    // minimum pts for a correct answer regardless of time
  var PTS_PER_SEC = 4; // pts lost per elapsed second (money takes a bit longer)
  var PTS_WRONG = 25;  // immediate score deduction per wrong attempt

  var area = document.getElementById('game-area');
  var leaderboardEl = document.getElementById('leaderboard');

  var currentRound = 0;
  var totalScore = 0;
  var questionIndex = 0;

  var selectedCents = 0;

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

  /* ── Coin definitions ─────────────────────────────────────── */
  var ALL_COINS = [
    { label: '1c',  cents: 1 },
    { label: '2c',  cents: 2 },
    { label: '5c',  cents: 5 },
    { label: '10c', cents: 10 },
    { label: '20c', cents: 20 },
    { label: '50c', cents: 50 },
    { label: '€1',  cents: 100 },
    { label: '€2',  cents: 200 },
    { label: '€5',  cents: 500 },
    { label: '€10', cents: 1000 },
  ];

  function coinsForRound(round) {
    if (round === 1) return ALL_COINS.slice(0, 6);
    if (round === 2) return ALL_COINS.slice(0, 8);
    return ALL_COINS;
  }

  /* ── Price pools (in cents) ────────────────────────────────── */
  var ROUND1_PRICES = [5, 8, 10, 12, 15, 18, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 95];
  var ROUND2_PRICES = [110, 120, 125, 135, 145, 150, 175, 180, 190, 200, 210, 225, 240, 250, 275, 280, 295, 300, 320, 350, 380, 390, 400, 450, 480, 490];
  var ROUND3_PRICES = [510, 525, 550, 575, 600, 625, 650, 700, 750, 800, 850, 900, 950, 1000, 1050, 1100, 1200, 1250, 1350, 1400, 1500, 1600, 1750, 1800, 1900, 1950];

  function pricePool(round) {
    if (round === 1) return ROUND1_PRICES;
    if (round === 2) return ROUND2_PRICES;
    return ROUND3_PRICES;
  }

  /* ── Items ────────────────────────────────────────────────── */
  var ITEMS = [
    'potlood', 'gum', 'boek', 'appel', 'sap', 'brood', 'pen', 'koek',
    'kaart', 'bal', 'stift', 'schrift', 'atlas', 'liniaal', 'passer',
    'vilt', 'map', 'krijtje', 'sticker', 'dobbelsteen',
  ];

  function randomItem() {
    return ITEMS[Math.floor(Math.random() * ITEMS.length)];
  }

  /* ── Formatting ───────────────────────────────────────────── */
  function formatCents(c) {
    if (c < 100) return c + ' cent';
    var euros = Math.floor(c / 100);
    var cents = c % 100;
    if (cents === 0) return '€' + euros + ',00';
    return '€' + euros + ',' + (cents < 10 ? '0' : '') + cents;
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

  /* ── "Betaald" round-up logic ──────────────────────────────── */
  function betaaldBedrag(priceCents) {
    var roundUps = [50, 100, 200, 500, 1000, 2000];
    for (var i = 0; i < roundUps.length; i++) {
      if (roundUps[i] > priceCents) return roundUps[i];
    }
    return 2000;
  }

  /* ── HUD ──────────────────────────────────────────────────── */
  function renderHUD() {
    return window.RegenboogCore.createHUD(CLASS_ID, currentRound, TOTAL_ROUNDS, true, true);
  }

  function refreshHUD() {
    window.RegenboogCore.updateHUDScore(CLASS_ID, totalScore);
    window.RegenboogCore.updateHUDRound(CLASS_ID, currentRound);
  }

  /* ── Coin / note image config ────────────────────────────── */
  // Coins use real photos; notes use a colored rectangle with label.
  var COIN_IMG = {
    1:    { img: '/assets/images/coins/coin-1c.gif',    size: 56 },
    2:    { img: '/assets/images/coins/coin-2c.gif',    size: 60 },
    5:    { img: '/assets/images/coins/coin-5c.jpg',    size: 64 },
    10:   { img: '/assets/images/coins/coin-10c.jpg',   size: 64 },
    20:   { img: '/assets/images/coins/coin-20c.gif',   size: 64 },
    50:   { img: '/assets/images/coins/coin-50c.jpg',   size: 68 },
    100:  { img: '/assets/images/coins/coin-1eur.jpg',  size: 68 },
    200:  { img: '/assets/images/coins/coin-2eur.jpg',  size: 72 },
    500:  { note: true, img: '/assets/images/coins/note-5eur.jpg',  label: '€5'  },
    1000: { note: true, img: '/assets/images/coins/note-10eur.jpg', label: '€10' },
  };

  function coinHtml(coin) {
    var cfg = COIN_IMG[coin.cents];
    if (!cfg) return '';

    if (cfg.note) {
      return '<button class="gr-coin" data-cents="' + coin.cents + '" style="' +
        'background:none;border:none;padding:0;cursor:pointer;margin:4px;' +
        'display:inline-flex;flex-direction:column;align-items:center;gap:2px;">' +
        '<img src="' + cfg.img + '" alt="' + escapeHtml(cfg.label) + '" ' +
        'width="140" ' +
        'style="display:block;border-radius:4px;box-shadow:0 2px 5px rgba(0,0,0,0.4);">' +
        '<span style="font-size:0.72em;font-weight:bold;color:#333;">' + escapeHtml(cfg.label) + '</span>' +
        '</button>';
    }

    var sz = cfg.size;
    return '<button class="gr-coin" data-cents="' + coin.cents + '" style="' +
      'background:none;border:none;padding:0;cursor:pointer;margin:4px;' +
      'display:inline-flex;flex-direction:column;align-items:center;gap:2px;">' +
      '<img src="' + cfg.img + '" alt="' + escapeHtml(coin.label) + '" ' +
      'width="' + sz + '" height="' + sz + '" ' +
      'style="border-radius:50%;display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.4));">' +
      '<span style="font-size:0.72em;font-weight:bold;color:#333;">' + escapeHtml(coin.label) + '</span>' +
      '</button>';
  }

  /* ── Question type A: betaal exact ───────────────────────── */
  function showBetaalQuestion(priceCents, item) {
    selectedCents = 0;
    var coins = coinsForRound(currentRound).filter(function (c) { return c.cents <= priceCents; });

    area.innerHTML = renderHUD() +
      '<div style="text-align:center;padding:8px 12px">' +
      '<p style="font-size:1.1em;margin:6px 0">Vraag ' + (questionIndex + 1) + ' van ' + QUESTIONS_PER_ROUND + '</p>' +
      '<p style="font-size:1.3em;margin:8px 0">Een <strong>' + escapeHtml(item) + '</strong> kost <strong>' + formatCents(priceCents) + '</strong>.</p>' +
      '<p style="margin:4px 0 10px">Geef het juiste bedrag!</p>' +
      '<div id="gr-total" style="font-size:1.4em;font-weight:bold;margin:10px 0;color:#1565c0">Jouw bedrag: 0 cent</div>' +
      '<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:4px;margin:10px 0">' +
        coins.map(coinHtml).join('') +
      '</div>' +
      '<div style="margin-top:10px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
        '<button class="game-btn" id="gr-reset">Wis alles</button>' +
        '<button class="game-btn" id="gr-pay" style="font-size:1.1em;padding:10px 24px">Betalen!</button>' +
      '</div>' +
      '</div>';

    refreshHUD();
    startTimer();

    function updateTotal() {
      var el = document.getElementById('gr-total');
      if (!el) return;
      var exact = selectedCents === priceCents;
      var over = selectedCents > priceCents;
      el.textContent = 'Jouw bedrag: ' + formatCents(selectedCents);
      el.style.color = exact ? '#2e7d32' : (over ? '#c62828' : '#1565c0');
    }

    area.querySelectorAll('.gr-coin').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectedCents += parseInt(btn.getAttribute('data-cents'), 10);
        updateTotal();
      });
    });

    document.getElementById('gr-reset').addEventListener('click', function () {
      selectedCents = 0;
      updateTotal();
    });

    document.getElementById('gr-pay').addEventListener('click', function () {
      if (selectedCents === priceCents) {
        stopTimer();
        playSound(660, 0.15, 'sine');
        totalScore += calcPts();
        window.RegenboogCore.updateHUDScore(CLASS_ID, totalScore);
        area.querySelectorAll('.gr-coin, #gr-reset, #gr-pay').forEach(function (b) { b.disabled = true; });
        var totalEl = document.getElementById('gr-total');
        if (totalEl) { totalEl.textContent = 'Juist!'; totalEl.style.color = '#2e7d32'; }
        setTimeout(nextQuestion, 1000);
      } else {
        totalScore = Math.max(0, totalScore - PTS_WRONG);
        window.RegenboogCore.updateHUDScore(CLASS_ID, totalScore);
        playSound(200, 0.2, 'sawtooth');
        selectedCents = 0;
        updateTotal();
        var payBtn = document.getElementById('gr-pay');
        if (payBtn) {
          payBtn.textContent = 'Probeer opnieuw';
          setTimeout(function () { if (payBtn) payBtn.textContent = 'Betalen!'; }, 800);
        }
      }
    });
  }

  /* ── Question type B: wisselgeld ─────────────────────────── */
  function showWisselgeldQuestion(priceCents, item) {
    var betaald = betaaldBedrag(priceCents);
    var correctChange = betaald - priceCents;

    var wrongs = [];
    var offsets = [-20, -10, -5, 5, 10, 15, 20, 25, 30, 50];
    shuffle(offsets);
    for (var i = 0; i < offsets.length && wrongs.length < 3; i++) {
      var candidate = correctChange + offsets[i];
      if (candidate > 0 && candidate !== correctChange) {
        var dup = false;
        for (var w = 0; w < wrongs.length; w++) {
          if (wrongs[w] === candidate) { dup = true; break; }
        }
        if (!dup) wrongs.push(candidate);
      }
    }
    while (wrongs.length < 3) {
      wrongs.push(correctChange + (wrongs.length + 1) * 5);
    }

    var options = shuffle([correctChange].concat(wrongs));

    var buttonsHtml = options.map(function (opt) {
      return '<button class="gr-option game-btn" data-cents="' + opt + '">' + formatCents(opt) + '</button>';
    }).join('');

    area.innerHTML = renderHUD() +
      '<div style="text-align:center;padding:8px 12px">' +
      '<p style="font-size:1.1em;margin:6px 0">Vraag ' + (questionIndex + 1) + ' van ' + QUESTIONS_PER_ROUND + '</p>' +
      '<p style="font-size:1.15em;margin:8px 0">Je koopt een <strong>' + escapeHtml(item) + '</strong> voor <strong>' + formatCents(priceCents) + '</strong>.</p>' +
      '<p style="font-size:1.15em;margin:6px 0">Je betaalt met <strong>' + formatCents(betaald) + '</strong>.</p>' +
      '<p style="font-size:1.2em;margin:12px 0 16px"><strong>Hoeveel wisselgeld krijg je?</strong></p>' +
      '<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:10px">' + buttonsHtml + '</div>' +
      '</div>';

    refreshHUD();
    startTimer();

    area.querySelectorAll('.gr-option').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var val = parseInt(btn.getAttribute('data-cents'), 10);
        if (val === correctChange) {
          stopTimer();
          btn.style.background = '#4caf50';
          btn.style.color = '#fff';
          playSound(660, 0.15, 'sine');
          totalScore += calcPts();
          window.RegenboogCore.updateHUDScore(CLASS_ID, totalScore);
          area.querySelectorAll('.gr-option').forEach(function (b) { b.disabled = true; });
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

  /* ── Show question dispatcher ─────────────────────────────── */
  function showQuestion() {
    var priceCents = pickRandom(pricePool(currentRound));
    var item = randomItem();
    // 0,2 → betaal exact;  1,3 → wisselgeld
    if (questionIndex % 2 === 0) {
      showBetaalQuestion(priceCents, item);
    } else {
      showWisselgeldQuestion(priceCents, item);
    }
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
        '<button class="game-btn" id="gr-next-round" style="margin-top:16px;font-size:1.1em">Volgende ronde</button>' +
        '</div>';
      document.getElementById('gr-next-round').addEventListener('click', function () {
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
      '<p style="font-size:1.2em;max-width:480px;margin:0 auto 20px">Betaal het juiste bedrag met munten en biljetten, of bereken het wisselgeld! Hoe sneller, hoe meer punten!</p>' +
      '<p style="margin-bottom:8px">3 rondes · 4 vragen per ronde</p>' +
      '<p style="margin-bottom:8px;font-size:0.9em;color:#666">' +
        'Ronde 1: tot €1 (centen) &nbsp;|&nbsp; Ronde 2: tot €5 &nbsp;|&nbsp; Ronde 3: tot €20' +
      '</p>' +
      '<button class="game-btn" id="gr-start" style="font-size:1.2em;padding:12px 36px;margin-top:12px">Start!</button>' +
      '</div>';
    document.getElementById('gr-start').addEventListener('click', function () {
      startRound();
    });
  }

  /* ── Boot ─────────────────────────────────────────────────── */
  showIntro();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
