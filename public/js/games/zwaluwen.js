(function () {
  const CLASS_ID = 'zwaluwen';
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  const TOTAL_ROUNDS = 3;
  const ROUND_DURATIONS_MS = [15000, 12000, 10000];
  const SPAWN_INTERVALS_MS = [900, 750, 600];
  const BUG_LIFETIMES_MS = [2200, 2000, 1800];
  const BUGS = ['🦟', '🐛', '🪲', '✨'];
  let score = 0;
  let totalScore = 0;
  let currentRound = 0;
  let timerId = null;
  let spawnId = null;
  let startTime = null;

  function startGame() {
    score = 0;
    var duration = ROUND_DURATIONS_MS[currentRound];
    var durationSec = Math.ceil(duration / 1000);
    // Gebruik consistente HUD layout (timer verborgen)
    const hudHtml = window.RegenboogCore.createHUD(CLASS_ID, currentRound + 1, TOTAL_ROUNDS, false, true);
    
    area.innerHTML =
      '<p class="zwaluwen-instruction">Ronde ' + (currentRound + 1) + '/' + TOTAL_ROUNDS + '. Vang zoveel mogelijk vliegjes!</p>' +
      hudHtml +
      '<div class="zwaluwen-arena">' +
      '<div class="zwaluwen-bird">' +
      '<img src="/assets/images/classes/zwaluwen.png" alt="Zwaluw" class="zwaluwen-sprite">' +
      '</div>' +
      '<div id="zwaluwen-bugs" class="zwaluwen-bugs"></div>' +
      '</div>';
    
    window.RegenboogCore.updateHUDRound(CLASS_ID, currentRound + 1);

    var bugsContainer = document.getElementById('zwaluwen-bugs');
    startTime = Date.now();

    var img = area.querySelector('.zwaluwen-sprite');
    if (img) img.addEventListener('error', function () {
      var s = document.createElement('span');
      s.className = 'zwaluwen-emoji-fallback';
      s.textContent = '🐦';
      this.parentNode.replaceChild(s, this);
    });

    function addBug() {
      var bug = document.createElement('button');
      bug.type = 'button';
      bug.className = 'zwaluwen-bug';
      bug.textContent = BUGS[Math.floor(Math.random() * BUGS.length)];
      bug.style.left = (10 + Math.random() * 80) + '%';
      bug.style.top = (15 + Math.random() * 65) + '%';
      bug.addEventListener('click', function () {
        if (bug.parentNode) {
          score++;
          window.RegenboogCore.updateHUDScore(CLASS_ID, score);
          bug.classList.add('zwaluwen-caught');
          setTimeout(function () { if (bug.parentNode) bug.remove(); }, 150);
        }
      });
      bugsContainer.appendChild(bug);
      var bugLifetime = BUG_LIFETIMES_MS[currentRound];
      setTimeout(function () {
        if (bug.parentNode && !bug.classList.contains('zwaluwen-caught')) {
          bug.classList.add('zwaluwen-missed');
          setTimeout(function () { if (bug.parentNode) bug.remove(); }, 300);
        }
      }, bugLifetime);
    }

    function tick() {
      var left = Math.ceil((duration - (Date.now() - startTime)) / 1000);
      window.RegenboogCore.updateHUDTimer(CLASS_ID, left, true);
      if (left <= 0) {
        clearInterval(timerId);
        clearInterval(spawnId);
        totalScore += score;
        if (currentRound + 1 >= TOTAL_ROUNDS) {
          area.innerHTML =
            '<p class="game-score">Alle ' + TOTAL_ROUNDS + ' rondes! Totaal <strong>' + totalScore + '</strong> vliegjes.</p>' +
            '<button type="button" class="zwaluwen-again">Nog een keer</button>';
          area.querySelector('.zwaluwen-again').addEventListener('click', function () {
            totalScore = 0;
            currentRound = 0;
            startGame();
          });
          window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
            window.Leaderboard.render(leaderboardEl, CLASS_ID);
          });
        } else {
          currentRound++;
          area.innerHTML =
            '<p class="game-score">Ronde klaar! ' + score + ' vliegjes. Totaal: ' + totalScore + '</p>' +
            '<button type="button" id="zwaluwen-next">Volgende ronde</button>';
          document.getElementById('zwaluwen-next').addEventListener('click', startGame);
        }
      }
    }

    addBug();
    var spawnInterval = SPAWN_INTERVALS_MS[currentRound];
    spawnId = setInterval(addBug, spawnInterval);
    timerId = setInterval(tick, 200);
  }

  startGame();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
