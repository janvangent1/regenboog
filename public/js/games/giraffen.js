(function () {
  const CLASS_ID = 'giraffen';
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  /* 5e leerjaar ≈ 10-11 jaar: groter doolhof, meer stappen */
  const GRID = 6;
  const TOTAL_ROUNDS = 3;
  let currentRound = 1;
  let totalScore = 0;
  let targetPath = [];
  let playerPath = [];
  let leaf = { r: 0, c: 0 };
  let walls = [];

  function genPath(steps) {
    var r = 0, c = 0;
    var path = [];
    var pathCells = [{ r: 0, c: 0 }];
    for (var i = 0; i < steps; i++) {
      var dir = ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)];
      if (dir === 'up' && r > 0) {
        r--;
        path.push('omhoog');
        pathCells.push({ r: r, c: c });
      } else if (dir === 'down' && r < GRID - 1) {
        r++;
        path.push('omlaag');
        pathCells.push({ r: r, c: c });
      } else if (dir === 'left' && c > 0) {
        c--;
        path.push('links');
        pathCells.push({ r: r, c: c });
      } else if (dir === 'right' && c < GRID - 1) {
        c++;
        path.push('rechts');
        pathCells.push({ r: r, c: c });
      }
    }
    return { path: path, r: r, c: c, pathCells: pathCells };
  }

  function onPath(pathCells, r, c) {
    for (var i = 0; i < pathCells.length; i++) {
      if (pathCells[i].r === r && pathCells[i].c === c) return true;
    }
    return false;
  }

  function run() {
    var steps = currentRound === 1 ? 8 + Math.floor(Math.random() * 2) : currentRound === 2 ? 10 + Math.floor(Math.random() * 2) : 11 + Math.floor(Math.random() * 3);
    var wallChance = 0.22 + currentRound * 0.04;
    var res = genPath(steps);
    targetPath = res.path;
    leaf = { r: res.r, c: res.c };
    playerPath = [];
    var pathCells = res.pathCells || [{ r: 0, c: 0 }];
    walls = [];
    for (var r = 0; r < GRID; r++) {
      for (var c = 0; c < GRID; c++) {
        if (r === 0 && c === 0) continue;
        if (r === leaf.r && c === leaf.c) continue;
        if (!onPath(pathCells, r, c) && Math.random() < wallChance) walls.push({ r: r, c: c });
      }
    }

    var gridHtml = '';
    for (var row = 0; row < GRID; row++) {
      for (var col = 0; col < GRID; col++) {
        var isWall = false;
        for (var w = 0; w < walls.length; w++) {
          if (walls[w].r === row && walls[w].c === col) { isWall = true; break; }
        }
        var cellClass = 'giraffen-cell';
        if (row === 0 && col === 0) cellClass += ' giraffen-start';
        else if (row === leaf.r && col === leaf.c) cellClass += ' giraffen-leaf';
        else if (isWall) cellClass += ' giraffen-wall';
        var content = '';
        if (row === 0 && col === 0) {
          content = '<img src="/assets/images/classes/giraffen.png" alt="Giraf" class="giraffen-giraf">';
        } else if (row === leaf.r && col === leaf.c) {
          content = '<span class="giraffen-leaf-icon" aria-hidden="true">🌿</span>';
        }
        gridHtml += '<div class="' + cellClass + '" data-r="' + row + '" data-c="' + col + '">' + content + '</div>';
      }
    }

    area.innerHTML =
      '<p class="giraffen-instruction">Ronde ' + currentRound + '/' + TOTAL_ROUNDS + '. Bereik de hoge bladeren: kies je volgorde om de bladeren te bereiken. Start linksboven!</p>' +
      '<div class="giraffen-grid">' + gridHtml + '</div>' +
      '<p id="giraffen-sequence" class="giraffen-sequence">Jouw volgorde: (leeg)</p>' +
      '<div id="giraffen-buttons" class="giraffen-buttons"></div>' +
      '<button type="button" id="giraffen-run" class="giraffen-run">Start</button>';

    var seqEl = document.getElementById('giraffen-sequence');
    var btnWrap = document.getElementById('giraffen-buttons');

    ['omhoog', 'omlaag', 'links', 'rechts'].forEach(function (dir) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'giraffen-dir-btn';
      b.textContent = dir;
      b.addEventListener('click', function () {
        playerPath.push(dir);
        seqEl.textContent = 'Jouw volgorde: ' + playerPath.join(' → ');
      });
      btnWrap.appendChild(b);
    });
    var clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'giraffen-clear-btn';
    clearBtn.textContent = 'Wissen';
    clearBtn.addEventListener('click', function () {
      playerPath = [];
      seqEl.textContent = 'Jouw volgorde: (leeg)';
    });
    btnWrap.appendChild(clearBtn);

    document.getElementById('giraffen-run').addEventListener('click', function () {
      if (playerPath.length === 0) {
        alert('Kies je stappen om de bladeren te bereiken.');
        return;
      }
      var r = 0, c = 0;
      var dirs = { omhoog: [-1, 0], omlaag: [1, 0], links: [0, -1], rechts: [0, 1] };
      for (var i = 0; i < playerPath.length; i++) {
        var d = dirs[playerPath[i]];
        if (d) { r += d[0]; c += d[1]; }
        if (r < 0 || r >= GRID || c < 0 || c >= GRID) break;
        var hitWall = false;
        for (var w = 0; w < walls.length; w++) {
          if (walls[w].r === r && walls[w].c === c) { hitWall = true; break; }
        }
        if (hitWall) break;
      }
      var ok = r === leaf.r && c === leaf.c;
      if (ok) {
        totalScore += 100;
        if (currentRound >= TOTAL_ROUNDS) {
          area.innerHTML = '<p class="game-score">Alle ' + TOTAL_ROUNDS + ' rondes goed! Score: ' + totalScore + '</p>';
          window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
            window.Leaderboard.render(leaderboardEl, CLASS_ID);
          });
        } else {
          currentRound++;
          area.innerHTML = '<p class="game-score">Ronde voltooid! Score: ' + totalScore + '</p><button type="button" class="giraffen-again">Volgende ronde</button>';
          area.querySelector('.giraffen-again').addEventListener('click', function () { run(); });
        }
      } else {
        area.innerHTML = '<p class="game-score">Fout. Score: ' + totalScore + '</p><button type="button" class="giraffen-again">Nog een keer</button>';
        area.querySelector('.giraffen-again').addEventListener('click', function () {
          currentRound = 1;
          totalScore = 0;
          run();
        });
        window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
          window.Leaderboard.render(leaderboardEl, CLASS_ID);
        });
      }
    });

    var img = area.querySelector('.giraffen-giraf');
    if (img) img.addEventListener('error', function () {
      this.style.display = 'none';
      var s = document.createElement('span');
      s.textContent = '🦒';
      s.className = 'giraffen-emoji-fallback';
      this.parentNode.appendChild(s);
    });
  }

  run();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
