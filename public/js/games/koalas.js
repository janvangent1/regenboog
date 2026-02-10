(function () {
  const CLASS_ID = 'koalas';
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  const TOTAL_ROUNDS = 3;
  let currentRound = 1;
  let totalScore = 0;
  let targetPath = [];
  let playerPath = [];

  function run() {
    var steps = currentRound === 1 ? 2 + Math.floor(Math.random() * 2) : currentRound === 2 ? 3 + Math.floor(Math.random() * 2) : 4;
    var repeat = currentRound === 1 ? 2 : currentRound === 2 ? 2 + Math.floor(Math.random() * 2) : 3;
    const all = ['omhoog', 'omlaag', 'links', 'rechts'].slice();
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    const single = all.slice(0, steps);
    targetPath = [];
    for (let r = 0; r < repeat; r++) {
      single.forEach(function (s) {
        targetPath.push(s);
      });
    }
    const dirLabel = { omhoog: 'omhoog', omlaag: 'omlaag', links: 'links', rechts: 'rechts' };
    playerPath = [];
    area.innerHTML =
      '<p>Ronde ' + currentRound + '/' + TOTAL_ROUNDS + '. Boom klimmen met herhaling: gebruik "herhaal ' +
      repeat +
      'x" voor dit blok: ' +
      single.map(function (d) {
        return dirLabel[d];
      }).join(', ') +
      '.</p>' +
      '<p>Dus totaal ' +
      targetPath.length +
      ' stappen in volgorde.</p>' +
      '<div id="koalas-buttons" style="display:flex;gap:8px;flex-wrap:wrap;"></div>' +
      '<p id="koalas-sequence" style="margin-top:12px;">Jouw volgorde: (leeg)</p>' +
      '<button type="button" id="koalas-run" style="padding:10px 20px;margin-top:8px;">Klim</button>';
    const seqEl = document.getElementById('koalas-sequence');
    const btnWrap = document.getElementById('koalas-buttons');
    ['omhoog', 'omlaag', 'links', 'rechts'].forEach(function (dir) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = dir;
      b.style.cssText = 'padding:8px 16px;border-radius:8px;border:2px solid #2a9d8f;';
      b.addEventListener('click', function () {
        playerPath.push(dir);
        seqEl.textContent = 'Jouw volgorde: ' + playerPath.join(', ');
      });
      btnWrap.appendChild(b);
    });
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.textContent = 'Wissen';
    clearBtn.addEventListener('click', function () {
      playerPath = [];
      seqEl.textContent = 'Jouw volgorde: (leeg)';
    });
    btnWrap.appendChild(clearBtn);
    document.getElementById('koalas-run').addEventListener('click', function () {
      if (playerPath.length !== targetPath.length) {
        alert('Kies precies ' + targetPath.length + ' stappen (herhaal ' + repeat + 'x het blok).');
        return;
      }
      let ok = true;
      for (let i = 0; i < targetPath.length; i++) {
        if (playerPath[i] !== targetPath[i]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        totalScore += 100;
        if (currentRound >= TOTAL_ROUNDS) {
          area.innerHTML = '<p class="game-score">Alle ' + TOTAL_ROUNDS + ' rondes goed! Score: ' + totalScore + '</p>';
          window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
            window.Leaderboard.render(leaderboardEl, CLASS_ID);
          });
        } else {
          currentRound++;
          area.innerHTML = '<p class="game-score">Ronde voltooid! Score: ' + totalScore + '</p><button type="button" id="koalas-next">Volgende ronde</button>';
          document.getElementById('koalas-next').addEventListener('click', function () { run(); });
        }
      } else {
        area.innerHTML = '<p class="game-score">Fout. Score: ' + totalScore + '</p><button type="button" id="koalas-again">Nog een keer</button>';
        document.getElementById('koalas-again').addEventListener('click', function () {
          currentRound = 1;
          totalScore = 0;
          run();
        });
        window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
          window.Leaderboard.render(leaderboardEl, CLASS_ID);
        });
      }
    });
  }

  run();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
