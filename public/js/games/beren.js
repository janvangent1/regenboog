(function () {
  const CLASS_ID = 'beren';
  const TOTAL_ROUNDS = 3;
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  const GRID = 4;
  let currentRound = 1;
  let totalScore = 0;
  let targetPath = [];
  let playerPath = [];
  let honey = { r: 0, c: 0 };
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
    var steps = currentRound === 1 ? 3 + Math.floor(Math.random() * 2) : currentRound === 2 ? 4 + Math.floor(Math.random() * 2) : 5 + Math.floor(Math.random() * 2);
    var wallChance = 0.3 + currentRound * 0.05;
    var res = genPath(steps);
    targetPath = res.path;
    honey = { r: res.r, c: res.c };
    playerPath = [];
    var pathCells = res.pathCells || [{ r: 0, c: 0 }];
    for (var i = 0; i < pathCells.length; i++) {
      pathCells[i] = { r: pathCells[i].r, c: pathCells[i].c };
    }
    walls = [];
    for (var r = 0; r < GRID; r++) {
      for (var c = 0; c < GRID; c++) {
        if (r === 0 && c === 0) continue;
        if (r === honey.r && c === honey.c) continue;
        if (!onPath(pathCells, r, c) && Math.random() < wallChance) {
          walls.push({ r: r, c: c });
        }
      }
    }

    var gridHtml = '';
    for (var row = 0; row < GRID; row++) {
      for (var col = 0; col < GRID; col++) {
        var isWall = false;
        for (var w = 0; w < walls.length; w++) {
          if (walls[w].r === row && walls[w].c === col) { isWall = true; break; }
        }
        var cellClass = 'beren-cell';
        if (row === 0 && col === 0) cellClass += ' beren-start';
        else if (row === honey.r && col === honey.c) cellClass += ' beren-honey';
        else if (isWall) cellClass += ' beren-wall';
        var content = '';
        if (row === 0 && col === 0) {
          content = '<img src="/assets/images/classes/beren.png" alt="Beer" class="beren-bear">';
        } else if (row === honey.r && col === honey.c) {
          content = '<span class="beren-honey-icon" aria-hidden="true">🍯</span>';
        }
        gridHtml += '<div class="' + cellClass + '" data-r="' + row + '" data-c="' + col + '">' + content + '</div>';
      }
    }

    area.innerHTML =
      '<p class="beren-instruction">Ronde ' + currentRound + '/' + TOTAL_ROUNDS + '. Programmeer de beer: kies de juiste volgorde om bij de honing te komen. Start linksboven!</p>' +
      '<div class="beren-grid">' + gridHtml + '</div>' +
      '<p id="beren-sequence" class="beren-sequence">Jouw volgorde: (leeg)</p>' +
      '<div id="beren-buttons" class="beren-buttons"></div>' +
      '<button type="button" id="beren-run" class="beren-run">Start</button>';

    var seqEl = document.getElementById('beren-sequence');
    var btnWrap = document.getElementById('beren-buttons');

    ['omhoog', 'omlaag', 'links', 'rechts'].forEach(function (dir) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'beren-dir-btn';
      b.textContent = dir;
      b.addEventListener('click', function () {
        playerPath.push(dir);
        seqEl.textContent = 'Jouw volgorde: ' + playerPath.join(' → ');
      });
      btnWrap.appendChild(b);
    });
    var clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'beren-clear-btn';
    clearBtn.textContent = 'Wissen';
    clearBtn.addEventListener('click', function () {
      playerPath = [];
      seqEl.textContent = 'Jouw volgorde: (leeg)';
    });
    btnWrap.appendChild(clearBtn);

    document.getElementById('beren-run').addEventListener('click', function () {
      if (playerPath.length === 0) {
        alert('Kies je stappen (omhoog, omlaag, links, rechts) om bij de honing te komen.');
        return;
      }
      var r = 0, c = 0;
      var dirs = { omhoog: [-1, 0], omlaag: [1, 0], links: [0, -1], rechts: [0, 1] };
      for (var i = 0; i < playerPath.length; i++) {
        var d = dirs[playerPath[i]];
        if (d) {
          r += d[0];
          c += d[1];
        }
        if (r < 0 || r >= GRID || c < 0 || c >= GRID) break;
        var hitWall = false;
        for (var w = 0; w < walls.length; w++) {
          if (walls[w].r === r && walls[w].c === c) { hitWall = true; break; }
        }
        if (hitWall) break;
      }
      var ok = r === honey.r && c === honey.c;
      if (ok) {
        totalScore += 100;
        if (currentRound >= TOTAL_ROUNDS) {
          area.innerHTML = '<p class="game-score">Alle ' + TOTAL_ROUNDS + ' rondes goed! Score: ' + totalScore + '</p>';
          window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
            window.Leaderboard.render(leaderboardEl, CLASS_ID);
          });
        } else {
          currentRound++;
          area.innerHTML = '<p class="game-score">Ronde voltooid! Score: ' + totalScore + '</p><button type="button" class="beren-again">Volgende ronde</button>';
          area.querySelector('.beren-again').addEventListener('click', function () { run(); });
        }
      } else {
        area.innerHTML = '<p class="game-score">Fout. Score: ' + totalScore + '</p><button type="button" class="beren-again">Nog een keer</button>';
        area.querySelector('.beren-again').addEventListener('click', function () {
          currentRound = 1;
          totalScore = 0;
          run();
        });
        window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
          window.Leaderboard.render(leaderboardEl, CLASS_ID);
        });
      }
    });

    area.querySelector('.beren-bear').addEventListener('error', function () {
      this.style.display = 'none';
      this.parentNode.appendChild(document.createElement('span')).textContent = '🐻';
      this.parentNode.lastChild.className = 'beren-bear-emoji';
    });
  }

  run();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
