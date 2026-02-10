(function () {
  const CLASS_ID = 'leeuwen';
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  const GRID = 5;
  const TOTAL_ROUNDS = 3;
  let currentRound = 1;
  let totalScore = 0;
  let targetPath = [];
  let playerPath = [];
  let prey = { r: 0, c: 0 };
  let walls = [];

  function genPath(steps) {
    var r = 0, c = 0;
    var path = [];
    var pathCells = [{ r: 0, c: 0 }];
    /* Build exactly `steps` moves (only count when we actually move) */
    while (path.length < steps) {
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
    /* Prooi mag niet op start (0,0) staan, anders is hij niet zichtbaar */
    if (r === 0 && c === 0 && path.length > 0) {
      if (GRID > 1) {
        path.push('rechts');
        c = 1;
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
    var steps = currentRound === 1 ? 5 + Math.floor(Math.random() * 2) : currentRound === 2 ? 6 + Math.floor(Math.random() * 2) : 7 + Math.floor(Math.random() * 2);
    var wallChance = 0.25 + currentRound * 0.05;
    var res = genPath(steps);
    targetPath = res.path;
    prey = { r: res.r, c: res.c };
    playerPath = [];
    var pathCells = res.pathCells || [{ r: 0, c: 0 }];
    for (var i = 0; i < pathCells.length; i++) {
      pathCells[i] = { r: pathCells[i].r, c: pathCells[i].c };
    }
    walls = [];
    for (var r = 0; r < GRID; r++) {
      for (var c = 0; c < GRID; c++) {
        if (r === 0 && c === 0) continue;
        if (r === prey.r && c === prey.c) continue;
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
        var cellClass = 'leeuwen-cell';
        if (row === 0 && col === 0) cellClass += ' leeuwen-start';
        else if (row === prey.r && col === prey.c) cellClass += ' leeuwen-prooi';
        else if (isWall) cellClass += ' leeuwen-wall';
        var content = '';
        if (row === 0 && col === 0) {
          content = '<img src="/assets/images/classes/leeuwen.png" alt="Leeuw" class="leeuwen-lion">';
        } else if (row === prey.r && col === prey.c) {
          content = '<span class="leeuwen-prooi-icon" aria-hidden="true">🦌</span>';
        }
        gridHtml += '<div class="' + cellClass + '" data-r="' + row + '" data-c="' + col + '">' + content + '</div>';
      }
    }

    area.innerHTML =
      '<p class="leeuwen-instruction">Ronde ' + currentRound + '/' + TOTAL_ROUNDS + '. Plan de jacht: kies de juiste volgorde om de prooi te bereiken. Leeuw start linksboven!</p>' +
      '<div class="leeuwen-grid">' + gridHtml + '</div>' +
      '<p id="leeuwen-sequence" class="leeuwen-sequence">Jouw volgorde: (leeg)</p>' +
      '<div id="leeuwen-buttons" class="leeuwen-buttons"></div>' +
      '<button type="button" id="leeuwen-run" class="leeuwen-run">Start jacht</button>';

    var seqEl = document.getElementById('leeuwen-sequence');
    var btnWrap = document.getElementById('leeuwen-buttons');

    ['omhoog', 'omlaag', 'links', 'rechts'].forEach(function (dir) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'leeuwen-dir-btn';
      b.textContent = dir;
      b.addEventListener('click', function () {
        playerPath.push(dir);
        seqEl.textContent = 'Jouw volgorde: ' + playerPath.join(' → ');
      });
      btnWrap.appendChild(b);
    });
    var clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'leeuwen-clear-btn';
    clearBtn.textContent = 'Wissen';
    clearBtn.addEventListener('click', function () {
      playerPath = [];
      seqEl.textContent = 'Jouw volgorde: (leeg)';
    });
    btnWrap.appendChild(clearBtn);

    document.getElementById('leeuwen-run').addEventListener('click', function () {
      if (playerPath.length === 0) {
        alert('Kies je stappen om de prooi te bereiken.');
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
      var ok = r === prey.r && c === prey.c;
      if (ok) {
        totalScore += 100;
        if (currentRound >= TOTAL_ROUNDS) {
          area.innerHTML = '<p class="game-score">Alle ' + TOTAL_ROUNDS + ' rondes goed! Score: ' + totalScore + '</p>';
          window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
            window.Leaderboard.render(leaderboardEl, CLASS_ID);
          });
        } else {
          currentRound++;
          area.innerHTML = '<p class="game-score">Ronde voltooid! Score: ' + totalScore + '</p><button type="button" class="leeuwen-again">Volgende ronde</button>';
          area.querySelector('.leeuwen-again').addEventListener('click', function () { run(); });
        }
      } else {
        area.innerHTML = '<p class="game-score">Fout. Score: ' + totalScore + '</p><button type="button" class="leeuwen-again">Nog een keer</button>';
        area.querySelector('.leeuwen-again').addEventListener('click', function () {
          currentRound = 1;
          totalScore = 0;
          run();
        });
        window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
          window.Leaderboard.render(leaderboardEl, CLASS_ID);
        });
      }
    });

    var lionImg = area.querySelector('.leeuwen-lion');
    if (lionImg) {
      lionImg.addEventListener('error', function () {
        this.style.display = 'none';
        var s = document.createElement('span');
        s.textContent = '🦁';
        s.className = 'leeuwen-lion-emoji';
        this.parentNode.appendChild(s);
      });
    }
  }

  run();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
