(function () {
  const CLASS_ID = 'egels';
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  const GRID = 5;
  const TOTAL_ROUNDS = 3;
  let currentRound = 1;
  let totalScore = 0;
  let targetPath = [];
  let playerPath = [];
  let apple = { r: 0, c: 0 };
  let obstacles = [];

  function genPath(steps, numObstacles) {
    let r = 0,
      c = 0;
    const path = [];
    const used = { '0,0': true };
    for (let i = 0; i < steps; i++) {
      const dirs = ['up', 'down', 'left', 'right'];
      dirs.sort(function () {
        return Math.random() - 0.5;
      });
      for (let d = 0; d < dirs.length; d++) {
        const dir = dirs[d];
        let nr = r,
          nc = c;
        if (dir === 'up') nr--;
        else if (dir === 'down') nr++;
        else if (dir === 'left') nc--;
        else nc++;
        if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID && !used[nr + ',' + nc]) {
          used[nr + ',' + nc] = true;
          r = nr;
          c = nc;
          path.push(dir === 'up' ? 'omhoog' : dir === 'down' ? 'omlaag' : dir === 'left' ? 'links' : 'rechts');
          break;
        }
      }
    }
    obstacles = [];
    for (let i = 0; i < GRID * GRID; i++) {
      const rr = Math.floor(Math.random() * GRID);
      const cc = Math.floor(Math.random() * GRID);
      if ((rr !== 0 || cc !== 0) && (rr !== r || cc !== c) && obstacles.length < numObstacles) {
        obstacles.push(rr + ',' + cc);
      }
    }
    return { path, r, c };
  }

  function run() {
    var steps = currentRound === 1 ? 5 + Math.floor(Math.random() * 2) : currentRound === 2 ? 6 + Math.floor(Math.random() * 2) : 7 + Math.floor(Math.random() * 2);
    var numObstacles = currentRound;
    const res = genPath(steps, numObstacles);
    targetPath = res.path;
    apple = { r: res.r, c: res.c };
    playerPath = [];
    area.innerHTML =
      '<p>Ronde ' + currentRound + '/' + TOTAL_ROUNDS + '. Verzamel de appel en vermijd obstakels. Plan je route (start linksboven).</p>' +
      '<p>Appel op rij ' +
      (apple.r + 1) +
      ', kolom ' +
      (apple.c + 1) +
      '.</p>' +
      '<div id="egels-buttons" style="display:flex;gap:8px;flex-wrap:wrap;"></div>' +
      '<p id="egels-sequence" style="margin-top:12px;">Jouw volgorde: (leeg)</p>' +
      '<button type="button" id="egels-run" style="padding:10px 20px;margin-top:8px;">Start</button>';
    const seqEl = document.getElementById('egels-sequence');
    const btnWrap = document.getElementById('egels-buttons');
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
    document.getElementById('egels-run').addEventListener('click', function () {
      if (playerPath.length === 0) {
        alert('Kies je stappen om de appel te bereiken.');
        return;
      }
      let r = 0, c = 0;
      const dirs = { omhoog: [-1,0], omlaag: [1,0], links: [0,-1], rechts: [0,1] };
      for (let i = 0; i < playerPath.length; i++) {
        const d = dirs[playerPath[i]];
        if (d) { r += d[0]; c += d[1]; }
      }
      const ok = r === apple.r && c === apple.c;
      if (ok) {
        totalScore += 100;
        if (currentRound >= TOTAL_ROUNDS) {
          area.innerHTML = '<p class="game-score">Alle ' + TOTAL_ROUNDS + ' rondes goed! Score: ' + totalScore + '</p>';
          window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
            window.Leaderboard.render(leaderboardEl, CLASS_ID);
          });
        } else {
          currentRound++;
          area.innerHTML = '<p class="game-score">Ronde voltooid! Score: ' + totalScore + '</p><button type="button" id="egels-next">Volgende ronde</button>';
          document.getElementById('egels-next').addEventListener('click', function () { run(); });
        }
      } else {
        area.innerHTML = '<p class="game-score">Fout. Score: ' + totalScore + '</p><button type="button" id="egels-again">Nog een keer</button>';
        document.getElementById('egels-again').addEventListener('click', function () {
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
