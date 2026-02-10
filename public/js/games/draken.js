(function () {
  const CLASS_ID = 'draken';
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  const ROUNDS = 3;
  const TARGETS_PER_ROUND = [4, 5, 6];
  let round = 0;
  let score = 0;
  let fireballEl = null;
  let dragonEl = null;
  let arenaEl = null;
  let roundStartTime = 0;
  let timerInterval = null;

  var dragonImg = '<img src="/assets/images/classes/draken.png" alt="Draak" class="draken-dragon-sprite">';

  function playSound(frequency, duration, type) {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      function play() {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = frequency;
        osc.type = type || 'sine';
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
      }
      if (ctx.state === 'suspended') ctx.resume().then(play).catch(function () {});
      else play();
    } catch (e) {}
  }
  function playCorrectSound() {
    playSound(600, 0.2, 'sine');
  }
  function playWrongSound() {
    playSound(200, 0.3, 'sawtooth');
  }

  function getRect(el) {
    var r = el.getBoundingClientRect();
    var a = arenaEl.getBoundingClientRect();
    return { left: r.left - a.left, top: r.top - a.top, width: r.width, height: r.height };
  }

  function shootAtTarget(targetEl, onHit) {
    if (!dragonEl || !arenaEl || !targetEl) return;
    if (!fireballEl) {
      fireballEl = document.createElement('div');
      fireballEl.className = 'draken-vuur';
      fireballEl.setAttribute('aria-hidden', 'true');
      arenaEl.appendChild(fireballEl);
    }
    var dragonRect = getRect(dragonEl);
    var targetRect = getRect(targetEl);
    var startX = dragonRect.left + dragonRect.width / 2 - 14;
    var startY = dragonRect.top - 10;
    var endX = targetRect.left + targetRect.width / 2 - 14;
    var endY = targetRect.top + targetRect.height / 2 - 14;
    fireballEl.style.left = startX + 'px';
    fireballEl.style.top = startY + 'px';
    fireballEl.style.transform = 'scale(1)';
    fireballEl.style.opacity = '1';
    fireballEl.classList.remove('draken-vuur-vlieg');
    targetEl.style.pointerEvents = 'none';
    void fireballEl.offsetWidth;
    fireballEl.classList.add('draken-vuur-vlieg');
    fireballEl.style.left = endX + 'px';
    fireballEl.style.top = endY + 'px';
    fireballEl.addEventListener('transitionend', function done() {
      fireballEl.removeEventListener('transitionend', done);
      targetEl.classList.add('draken-target-getroffen');
      fireballEl.style.transform = 'scale(0)';
      setTimeout(function () {
        targetEl.remove();
        if (onHit) onHit();
      }, 200);
    }, { once: true });
  }

  var moveAnimationId = null;

  function startMoveAnimation() {
    function tick() {
      var arena = area.querySelector('.draken-arena');
      if (!arena) {
        moveAnimationId = null;
        return;
      }
      var moving = arena.querySelectorAll('.draken-target');
      moving.forEach(function (el) {
        if (el.classList.contains('draken-target-getroffen')) return;
        var left = parseFloat(el.style.left) || 50;
        var top = parseFloat(el.style.top) || 25;
        var vx = parseFloat(el.dataset.vx) || 0.15;
        var vy = parseFloat(el.dataset.vy) || 0.08;
        left += vx;
        top += vy;
        if (left < 6) { left = 6; vx = -vx; }
        if (left > 88) { left = 88; vx = -vx; }
        if (top < 5) { top = 5; vy = -vy; }
        if (top > 42) { top = 42; vy = -vy; }
        el.style.left = left + '%';
        el.style.top = top + '%';
        el.dataset.vx = vx;
        el.dataset.vy = vy;
      });
      moveAnimationId = requestAnimationFrame(tick);
    }
    moveAnimationId = requestAnimationFrame(tick);
  }

  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    roundStartTime = Date.now();
    timerInterval = setInterval(function () {
      var elapsed = Math.floor((Date.now() - roundStartTime) / 1000);
      window.RegenboogCore.updateHUDTimer(CLASS_ID, elapsed, false);
    }, 100);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function calculateScoreForHit() {
    var elapsed = (Date.now() - roundStartTime) / 1000;
    var baseScore = round === 1 ? 15 : round === 2 ? 20 : 25;
    var timePenalty = Math.floor(elapsed * 0.5);
    return Math.max(5, baseScore - timePenalty);
  }

  function startRound() {
    if (moveAnimationId != null) {
      cancelAnimationFrame(moveAnimationId);
      moveAnimationId = null;
    }
    stopTimer();
    round++;
    var numGood = TARGETS_PER_ROUND[Math.min(round - 1, TARGETS_PER_ROUND.length - 1)];
    var numForbidden = round === 1 ? 1 : round === 2 ? 3 : 4;
    var baseSpeed = round === 1 ? 0.12 : round === 2 ? 0.18 : 0.24;
    var speedVariation = round === 1 ? 0.08 : round === 2 ? 0.12 : 0.16;
    var targetsContainer = document.createElement('div');
    targetsContainer.className = 'draken-targets';
    var allTargets = [];
    for (var i = 0; i < numGood + numForbidden; i++) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'draken-target';
      btn.dataset.id = String(i);
      btn.dataset.forbidden = i < numGood ? '0' : '1';
      if (i >= numGood) btn.classList.add('draken-forbidden');
      var left = 8 + Math.random() * 78;
      var top = 5 + Math.random() * 38;
      btn.style.left = left + '%';
      btn.style.top = top + '%';
      btn.dataset.vx = (Math.random() < 0.5 ? baseSpeed : -baseSpeed) + (Math.random() * speedVariation - speedVariation / 2);
      btn.dataset.vy = (Math.random() < 0.5 ? baseSpeed * 0.5 : -baseSpeed * 0.5) + (Math.random() * speedVariation * 0.5 - speedVariation / 4);
      targetsContainer.appendChild(btn);
      allTargets.push(btn);
    }
    area.innerHTML =
      window.RegenboogCore.createHUD(CLASS_ID, round, ROUNDS, true, true) +
      '<div class="draken-arena">' +
      '<div class="draken-dragon" aria-hidden="true">' + dragonImg + '</div>' +
      '<div class="draken-vuur" aria-hidden="true"></div>' +
      '</div>' +
      '<p class="draken-hint">Schiet de <strong>rode</strong> doelen. Niet de <strong>groene</strong>! Alle doelen bewegen.</p>';
    window.RegenboogCore.updateHUDScore(CLASS_ID, score);
    window.RegenboogCore.updateHUDRound(CLASS_ID, round);
    startTimer();
    arenaEl = area.querySelector('.draken-arena');
    arenaEl.appendChild(targetsContainer);
    dragonEl = area.querySelector('.draken-dragon');
    fireballEl = area.querySelector('.draken-vuur');
    var goodRemaining = numGood;
    var targets = area.querySelectorAll('.draken-target');
    startMoveAnimation();
    targets.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.classList.contains('draken-target-getroffen')) return;
        var isForbidden = btn.classList.contains('draken-forbidden');
        shootAtTarget(btn, function () {
          if (isForbidden) {
            playWrongSound();
            score = Math.max(0, score - 20);
            window.RegenboogCore.updateHUDScore(CLASS_ID, score);
          } else {
            playCorrectSound();
            var points = calculateScoreForHit();
            score += points;
            window.RegenboogCore.updateHUDScore(CLASS_ID, score);
            goodRemaining--;
            if (goodRemaining <= 0) {
              stopTimer();
              if (moveAnimationId != null) {
                cancelAnimationFrame(moveAnimationId);
                moveAnimationId = null;
              }
              if (round >= ROUNDS) {
                area.innerHTML = '<p class="game-score">Alle doelen vernietigd! Score: ' + score + '</p>';
                window.Leaderboard.showSubmitForm(CLASS_ID, score, function () {
                  window.Leaderboard.render(leaderboardEl, CLASS_ID);
                });
              } else {
                startRound();
              }
            }
          }
        });
      });
    });
  }

  score = 0;
  round = 0;
  startRound();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
