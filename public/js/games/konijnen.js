(function () {
  const CLASS_ID = 'konijnen';
  const TOTAL_ROUNDS = 3;
  const ROUND_DURATIONS_MS = [20000, 18000, 15000];
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  let score = 0;
  let totalScore = 0;
  let currentRound = 0;
  let endTime;
  let timerId;
  let running = false;

  function playSound(frequency, duration, type, volume) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      function run() {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = type || 'sine';
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(volume || 0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
      }
      if (ctx.state === 'suspended') ctx.resume().then(run).catch(function () {});
      else run();
    } catch (e) {}
  }

  function playCollectSound() { playSound(740, 0.08, 'triangle', 0.06); }
  function playRoundDoneSound() { playSound(560, 0.14, 'sine', 0.06); }


  const CARROT_SIZE = 88;
  const CARROT_PADDING = 12;

  function spawnCarrot() {
    if (!running || Date.now() >= endTime) return;
    const carrot = document.createElement('button');
    carrot.type = 'button';
    carrot.className = 'carrot-btn';
    carrot.innerHTML = '🥕';
    carrot.style.cssText =
      'position:absolute;left:' +
      Math.random() * Math.max(0, area.offsetWidth - CARROT_SIZE - CARROT_PADDING * 2) +
      'px;top:' +
      Math.random() * Math.max(0, area.offsetHeight - CARROT_SIZE - CARROT_PADDING * 2) +
      'px;width:' + CARROT_SIZE + 'px;height:' + CARROT_SIZE + 'px;font-size:72px;line-height:1;border:none;background:transparent;cursor:pointer;padding:' + CARROT_PADDING + 'px;display:flex;align-items:center;justify-content:center;';
    carrot.addEventListener('click', function () {
      score++;
      window.RegenboogCore.updateHUDScore(CLASS_ID, score);
      playCollectSound();
      carrot.remove();
      spawnCarrot();
    });
    area.appendChild(carrot);
  }

  function start() {
    area.innerHTML = '';
    score = 0;
    running = true;
    var duration = ROUND_DURATIONS_MS[currentRound];
    endTime = Date.now() + duration;
    
    // Gebruik consistente HUD layout met timer
    area.innerHTML = window.RegenboogCore.createHUD(CLASS_ID, currentRound + 1, TOTAL_ROUNDS, true, true);
    area.style.position = 'relative';
    area.style.minHeight = '340px';
    
    window.RegenboogCore.updateHUDRound(CLASS_ID, currentRound + 1);

    function tick() {
      const left = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      window.RegenboogCore.updateHUDTimer(CLASS_ID, left, true);
      window.RegenboogCore.updateHUDScore(CLASS_ID, score);
      if (left <= 0) {
        clearInterval(timerId);
        running = false;
        area.querySelectorAll('.carrot-btn').forEach((b) => b.remove());
        totalScore += score;
        if (currentRound + 1 >= TOTAL_ROUNDS) {
          playRoundDoneSound();
          area.innerHTML = '<p class="game-score">Alle ' + TOTAL_ROUNDS + ' rondes klaar! Totaal ' + totalScore + ' wortels.</p>';
          window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
            window.Leaderboard.render(leaderboardEl, CLASS_ID);
          });
          return;
        }
        currentRound++;
        playRoundDoneSound();
        area.innerHTML =
          '<p class="game-score">Ronde klaar! ' + score + ' wortels. Totaal: ' + totalScore + '</p>' +
          '<button type="button" id="konijnen-next">Volgende ronde</button>';
        document.getElementById('konijnen-next').addEventListener('click', start);
      }
    }
    tick();
    timerId = setInterval(tick, 500);
    spawnCarrot();
  }

  function startFresh() {
    totalScore = 0;
    currentRound = 0;
    start();
  }

  function showIntro() {
    area.innerHTML =
      '<div style="text-align:center; margin-bottom:1rem;">' +
      '  <h3>Konijnen - Wortel Vangst</h3>' +
      '  <p style="font-size:1.05rem; color:#555; margin-bottom:0.6rem;">Klik zo snel mogelijk op de wortels en haal een hoge score.</p>' +
      '  <div style="margin:1rem 0; padding:1rem; background:#f5f0e8; border-radius:8px; display:inline-block; text-align:left;">' +
      '    <p style="margin:0.5rem 0;"><strong>Hoe te spelen:</strong></p>' +
      '    <p style="margin:0.5rem 0;">- Klik op elke wortel die verschijnt</p>' +
      '    <p style="margin:0.5rem 0;">- Werk zo snel mogelijk voor meer punten</p>' +
      '    <p style="margin:0.5rem 0;">- Speel 3 rondes met oplopende moeilijkheid</p>' +
      '  </div>' +
      '  <div><button type="button" id="konijnen-start" style="padding:1rem 2rem; font-size:1.1rem; background:linear-gradient(135deg, #6fbf73, #4d9f55); color:white; border:none; border-radius:12px; cursor:pointer; font-weight:700;">Start spel</button></div>' +
      '</div>';
    var startBtn = document.getElementById('konijnen-start');
    if (startBtn) {
      startBtn.addEventListener('click', startFresh);
    }
  }

  showIntro();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
