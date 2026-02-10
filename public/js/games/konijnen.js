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
    
    // Gebruik consistente HUD layout (timer verborgen)
    area.innerHTML = window.RegenboogCore.createHUD(CLASS_ID, currentRound + 1, TOTAL_ROUNDS, false, true);
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
          area.innerHTML = '<p class="game-score">Alle ' + TOTAL_ROUNDS + ' rondes klaar! Totaal ' + totalScore + ' wortels.</p>';
          window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
            window.Leaderboard.render(leaderboardEl, CLASS_ID);
          });
          return;
        }
        currentRound++;
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
  startFresh();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
