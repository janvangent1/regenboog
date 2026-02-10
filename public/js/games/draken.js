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

  var dragonImg = '<img src="/assets/images/classes/draken.png" alt="Draak" class="draken-dragon-sprite">';

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

  function startRound() {
    round++;
    var numTargets = TARGETS_PER_ROUND[Math.min(round - 1, TARGETS_PER_ROUND.length - 1)];
    var targetsContainer = document.createElement('div');
    targetsContainer.className = 'draken-targets';
    for (var i = 0; i < numTargets; i++) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'draken-target';
      btn.dataset.id = String(i);
      btn.style.left = (8 + Math.random() * 78) + '%';
      btn.style.top = (5 + Math.random() * 38) + '%';
      targetsContainer.appendChild(btn);
    }
    area.innerHTML =
      '<p class="draken-score">Score: ' + score + ' \u00A0|\u00A0 Ronde ' + round + '/' + ROUNDS + '</p>' +
      '<div class="draken-arena">' +
      '<div class="draken-dragon" aria-hidden="true">' + dragonImg + '</div>' +
      '<div class="draken-vuur" aria-hidden="true"></div>' +
      '</div>' +
      '<p class="draken-hint">Klik op een doelwit – de draak schiet een vuurbal!</p>';
    arenaEl = area.querySelector('.draken-arena');
    arenaEl.appendChild(targetsContainer);
    dragonEl = area.querySelector('.draken-dragon');
    fireballEl = area.querySelector('.draken-vuur');
    var targets = area.querySelectorAll('.draken-target');
    var remaining = targets.length;
    targets.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.classList.contains('draken-target-getroffen')) return;
        shootAtTarget(btn, function () {
          score += 10;
          var scoreEl = area.querySelector('.draken-score');
          if (scoreEl) scoreEl.textContent = 'Score: ' + score + ' \u00A0|\u00A0 Ronde ' + round + '/' + ROUNDS;
          remaining--;
          if (remaining <= 0) {
            if (round >= ROUNDS) {
              area.innerHTML = '<p class="game-score">Alle doelen vernietigd! Score: ' + score + '</p>';
              window.Leaderboard.showSubmitForm(CLASS_ID, score, function () {
                window.Leaderboard.render(leaderboardEl, CLASS_ID);
              });
            } else {
              startRound();
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
