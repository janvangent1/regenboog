(function () {
  const CLASS_ID = 'pinguins';
  const TOTAL_ROUNDS = 3;
  const ROUND_DURATIONS_MS = [22000, 18000, 15000];
  const FALL_SPEEDS = [4, 6, 8]; // Sneller vallen in ronde 2 en 3
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  let score = 0;
  let totalScore = 0;
  let currentRound = 0;
  let endTime;
  let timerId;
  let running = false;

  function spawnFish() {
    if (!running || Date.now() >= endTime) return;
    var speed = FALL_SPEEDS[currentRound] || 4;
    const fish = document.createElement('button');
    fish.type = 'button';
    fish.innerHTML = '🐟';
    fish.style.cssText =
      'position:absolute;left:' +
      Math.random() * (area.offsetWidth - 50) +
      'px;top:0;font-size:40px;border:none;background:transparent;cursor:none;padding:0;transition:top 0.1s linear;';
    area.appendChild(fish);
    let top = 0;
    const fall = setInterval(function () {
      if (!running || !fish.parentNode) {
        clearInterval(fall);
        return;
      }
      top += speed;
      fish.style.top = top + 'px';
      if (top > area.offsetHeight - 40) {
        clearInterval(fall);
        fish.remove();
      }
    }, 50);
    fish.addEventListener('click', function () {
      score++;
      window.RegenboogCore.updateHUDScore(CLASS_ID, score);
      clearInterval(fall);
      fish.remove();
    });
  }

  function spawnBadItem() {
    if (!running || Date.now() >= endTime) return;
    var speed = FALL_SPEEDS[currentRound] || 4;
    const badItem = document.createElement('button');
    badItem.type = 'button';
    badItem.innerHTML = '👟';
    badItem.className = 'pinguins-bad-item';
    badItem.style.cssText =
      'position:absolute;left:' +
      Math.random() * (area.offsetWidth - 50) +
      'px;top:0;font-size:40px;border:none;background:transparent;cursor:none;padding:0;transition:top 0.1s linear;opacity:0.9;';
    area.appendChild(badItem);
    let top = 0;
    const fall = setInterval(function () {
      if (!running || !badItem.parentNode) {
        clearInterval(fall);
        return;
      }
      top += speed;
      badItem.style.top = top + 'px';
      if (top > area.offsetHeight - 40) {
        clearInterval(fall);
        badItem.remove();
      }
    }, 50);
    badItem.addEventListener('click', function () {
      score = Math.max(0, score - 1);
      window.RegenboogCore.updateHUDScore(CLASS_ID, score);
      badItem.style.animation = 'shake 0.3s';
      setTimeout(function() {
        clearInterval(fall);
        badItem.remove();
      }, 300);
    });
  }

  let penguinCursor = null;
  let mouseX = 0;
  let mouseY = 0;

  function createPenguinCursor() {
    if (penguinCursor) {
      penguinCursor.style.display = 'block';
      return;
    }
    penguinCursor = document.createElement('div');
    penguinCursor.id = 'penguin-cursor';
    penguinCursor.style.cssText = 
      'position: fixed; width: 80px; height: 80px; pointer-events: none; z-index: 10000; ' +
      'background-image: url("/assets/images/classes/pinguins.png"); ' +
      'background-size: contain; background-repeat: no-repeat; background-position: center; ' +
      'transform: translate(-50%, -50%); will-change: transform; display: none; ' +
      'filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));';
    document.body.appendChild(penguinCursor);
  }

  function updatePenguinCursor(e) {
    if (!penguinCursor || !running) return;
    mouseX = e.clientX;
    mouseY = e.clientY;
    const rect = area.getBoundingClientRect();
    if (mouseX >= rect.left && mouseX <= rect.right && 
        mouseY >= rect.top && mouseY <= rect.bottom) {
      if (penguinCursor.style.display !== 'block') {
        penguinCursor.style.display = 'block';
      }
      requestAnimationFrame(function() {
        if (penguinCursor) {
          penguinCursor.style.left = mouseX + 'px';
          penguinCursor.style.top = mouseY + 'px';
        }
      });
    } else {
      penguinCursor.style.display = 'none';
    }
  }

  function start() {
    area.innerHTML = '';
    score = 0;
    running = true;
    var duration = ROUND_DURATIONS_MS[currentRound];
    endTime = Date.now() + duration;
    area.style.position = 'relative';
    area.style.minHeight = '320px';
    area.style.overflow = 'hidden';
    area.style.cursor = 'none';
    
    createPenguinCursor();
    document.addEventListener('mousemove', updatePenguinCursor);
    
    // Gebruik consistente HUD layout (timer verborgen)
    area.innerHTML = window.RegenboogCore.createHUD(CLASS_ID, currentRound + 1, TOTAL_ROUNDS, false, true);
    
    window.RegenboogCore.updateHUDRound(CLASS_ID, currentRound + 1);
    
    function tick() {
      const left = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      window.RegenboogCore.updateHUDTimer(CLASS_ID, left, true);
      window.RegenboogCore.updateHUDScore(CLASS_ID, score);
        if (left <= 0) {
        clearInterval(timerId);
        running = false;
        document.removeEventListener('mousemove', updatePenguinCursor);
        if (penguinCursor) {
          penguinCursor.style.display = 'none';
        }
        area.style.cursor = '';
        totalScore += score;
        if (currentRound + 1 >= TOTAL_ROUNDS) {
          area.innerHTML = '<p class="game-score">Alle ' + TOTAL_ROUNDS + ' rondes klaar! Totaal ' + totalScore + ' vissen.</p>';
          window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
            window.Leaderboard.render(leaderboardEl, CLASS_ID);
          });
          return;
        }
        currentRound++;
        area.innerHTML =
          '<p class="game-score">Ronde klaar! ' + score + ' vissen. Totaal: ' + totalScore + '</p>' +
          '<button type="button" id="pinguins-next">Volgende ronde</button>';
        document.getElementById('pinguins-next').addEventListener('click', function() {
          if (penguinCursor) penguinCursor.style.display = 'none';
          area.style.cursor = '';
          document.removeEventListener('mousemove', updatePenguinCursor);
          start();
        });
      }
    }
    tick();
    timerId = setInterval(tick, 500);
    // Snellere spawn intervals per ronde: ronde 1 = 800ms, ronde 2 = 550ms, ronde 3 = 400ms
    var spawnInterval = currentRound === 0 ? 800 : currentRound === 1 ? 550 : 400;
    var badItemChance = 0.25; // 25% kans op een slecht item
    var randomVariation = currentRound === 0 ? 400 : currentRound === 1 ? 300 : 200; // Minder variatie in latere rondes
    function spawn() {
      if (Math.random() < badItemChance) {
        spawnBadItem();
      } else {
        spawnFish();
      }
      if (running) setTimeout(spawn, spawnInterval + Math.random() * randomVariation);
    }
    spawn();
  }

  function startFresh() {
    totalScore = 0;
    currentRound = 0;
    start();
  }
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', function() {
    document.removeEventListener('mousemove', updatePenguinCursor);
    if (penguinCursor && penguinCursor.parentNode) {
      penguinCursor.parentNode.removeChild(penguinCursor);
    }
  });
  
  startFresh();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
