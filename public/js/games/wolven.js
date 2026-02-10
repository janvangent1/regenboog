(function () {
  const CLASS_ID = 'wolven';
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  const GRID = 5;
  const TOTAL_ROUNDS = 3;
  let currentRound = 1;
  let totalScore = 0;
  let targetPath = [];
  let playerPath = [];
  let goal = { r: 0, c: 0 };

  function genPath(steps) {
    let r = 0,
      c = 0;
    const path = [];
    /* Build exactly `steps` moves so the path always reaches a cell away from start */
    while (path.length < steps) {
      const dir = ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)];
      if (dir === 'up' && r > 0) {
        r--;
        path.push('omhoog');
      } else if (dir === 'down' && r < GRID - 1) {
        r++;
        path.push('omlaag');
      } else if (dir === 'left' && c > 0) {
        c--;
        path.push('links');
      } else if (dir === 'right' && c < GRID - 1) {
        c++;
        path.push('rechts');
      }
    }
    /* Doel mag niet op start (0,0) staan, anders is het niet zichtbaar */
    if (r === 0 && c === 0 && path.length > 0 && GRID > 1) {
      path.push('rechts');
      c = 1;
    }
    return { path, r, c };
  }

  function run() {
    var steps = currentRound === 1 ? 5 + Math.floor(Math.random() * 2) : currentRound === 2 ? 6 + Math.floor(Math.random() * 2) : 7 + Math.floor(Math.random() * 2);
    const res = genPath(steps);
    targetPath = res.path;
    goal = { r: res.r, c: res.c };
    playerPath = [];
    area.innerHTML =
      '<p>Ronde ' + currentRound + '/' + TOTAL_ROUNDS + '. Roedel logica: kies je volgorde om het doel te bereiken.</p>' +
      '<p>Doel op rij ' +
      (goal.r + 1) +
      ', kolom ' +
      (goal.c + 1) +
      '.</p>' +
      '<div id="wolven-buttons" style="display:flex;gap:8px;flex-wrap:wrap;"></div>' +
      '<p id="wolven-sequence" style="margin-top:12px;">Jouw volgorde: (leeg)</p>' +
      '<button type="button" id="wolven-run" style="padding:10px 20px;margin-top:8px;">Run</button>';
    const seqEl = document.getElementById('wolven-sequence');
    const btnWrap = document.getElementById('wolven-buttons');
    ['omhoog', 'omlaag', 'links', 'rechts'].forEach(function (dir) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = dir;
      b.style.cssText = 'padding:8px 16px;border-radius:8px;border:2px solid #555;';
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
    document.getElementById('wolven-run').addEventListener('click', function () {
      if (playerPath.length === 0) {
        alert('Kies je stappen om het doel te bereiken.');
        return;
      }
      let r = 0, c = 0;
      const dirs = { omhoog: [-1,0], omlaag: [1,0], links: [0,-1], rechts: [0,1] };
      for (let i = 0; i < playerPath.length; i++) {
        const d = dirs[playerPath[i]];
        if (d) {
          const nr = r + d[0];
          const nc = c + d[1];
          /* Check boundaries - stop if out of bounds */
          if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) break;
          r = nr;
          c = nc;
        }
      }
      const ok = r === goal.r && c === goal.c;
      if (ok) {
        totalScore += 100;
        if (currentRound >= TOTAL_ROUNDS) {
          area.innerHTML = '<p class="game-score">Alle ' + TOTAL_ROUNDS + ' rondes goed! Score: ' + totalScore + '</p>';
          window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
            window.Leaderboard.render(leaderboardEl, CLASS_ID);
          });
        } else {
          currentRound++;
          area.innerHTML = '<p class="game-score">Ronde voltooid! Score: ' + totalScore + '</p><button type="button" id="wolven-next">Volgende ronde</button>';
          document.getElementById('wolven-next').addEventListener('click', function () { run(); });
        }
      } else {
        area.innerHTML = '<p class="game-score">Fout. Score: ' + totalScore + '</p><button type="button" id="wolven-again">Nog een keer</button>';
        document.getElementById('wolven-again').addEventListener('click', function () {
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
