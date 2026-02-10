(function () {
  const CLASS_ID = 'olifanten';
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  const items = ['🐘', '🌿', '💧', '🪨', '🍎', '🌻', '🐘', '🌿', '💧', '🪨', '🍎', '🌻'];
  const TOTAL_ROUNDS = 3;
  let sequence = [];
  let playerStep = 0;
  let showing = true;
  let level = 1;
  let totalScore = 0;

  function shuffle(a) {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  }

  function showNext() {
    if (playerStep >= sequence.length) {
      showing = false;
      document.getElementById('olifanten-inst').textContent = 'Klik in dezelfde volgorde.';
      return;
    }
    document.getElementById('olifanten-display').textContent = sequence[playerStep];
    playerStep++;
    setTimeout(showNext, 900);
  }

  function startLevel() {
    const len = 4 + level;
    const pool = level === 1 ? items.slice(0, 4) : level === 2 ? items.slice(0, 5) : items.slice(0, 6);
    sequence = [];
    for (let i = 0; i < len; i++) {
      sequence.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    playerStep = 0;
    showing = true;
    document.getElementById('olifanten-level').textContent = 'Ronde ' + level + '/' + TOTAL_ROUNDS;
    document.getElementById('olifanten-inst').textContent = 'Onthoud de volgorde...';
    document.getElementById('olifanten-display').textContent = '?';
    document.getElementById('olifanten-btns').innerHTML = '';
    const uniq = [...new Set(sequence)];
    uniq.forEach(function (emoji) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = emoji;
      b.style.cssText = 'font-size:1.5rem;padding:12px 20px;margin:4px;border-radius:8px;';
      b.addEventListener('click', function () {
        if (showing) return;
        const expected = sequence[playerStep];
        if (emoji !== expected) {
          area.innerHTML =
            '<p class="game-score">Fout. Ronde ' + level + '. Score: ' + totalScore + '</p>';
          window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
            window.Leaderboard.render(leaderboardEl, CLASS_ID);
          });
          return;
        }
        playerStep++;
        if (playerStep >= sequence.length) {
          totalScore += level * 25;
          level++;
          if (level > TOTAL_ROUNDS) {
            area.innerHTML = '<p class="game-score">Alle ' + TOTAL_ROUNDS + ' rondes goed! Score: ' + totalScore + '</p>';
            window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
              window.Leaderboard.render(leaderboardEl, CLASS_ID);
            });
          } else {
            startLevel();
          }
        }
      });
      document.getElementById('olifanten-btns').appendChild(b);
    });
    setTimeout(showNext, 500);
  }

  area.innerHTML =
    '<p id="olifanten-level">Ronde 1/' + TOTAL_ROUNDS + '</p>' +
    '<p id="olifanten-inst">Onthoud de volgorde...</p>' +
    '<p id="olifanten-display" style="font-size:2rem;margin:12px 0;">?</p>' +
    '<div id="olifanten-btns"></div>';
  startLevel();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
