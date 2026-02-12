(function () {
  const CLASS_ID = 'beren';
  const TOTAL_ROUNDS = 3;
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  let gridRows = 4;
  let gridCols = 4;
  let currentRound = 1;
  let totalScore = 0;
  let targetPath = [];
  let playerPath = [];
  let honey = { r: 0, c: 0 };
  let walls = [];
  let attempts = 0;
  let startTime = 0;
  let timerInterval = null;
  let bearEl = null;
  let isAnimating = false;

  function getGridSize(round) {
    if (round === 1) return { rows: 4, cols: 4 };
    if (round === 2) return { rows: 5, cols: 5 };
    return { rows: 6, cols: 6 };
  }

  function getMinSteps(round) {
    if (round === 1) return 5;
    if (round === 2) return 9;
    return 13;
  }

  function getWallChance(round) {
    if (round === 1) return 0.38;
    if (round === 2) return 0.48;
    return 0.55;
  }

  function getMinHoneyDistance() {
    return 4;
  }

  var dirToArrow = { omhoog: '\u2191', omlaag: '\u2193', links: '\u2190', rechts: '\u2192' };
  function pathToArrows(path) {
    return path.map(function (d) { return dirToArrow[d] || d; }).join(' ');
  }

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

  function calculateLiveScore() {
    if (startTime === 0) {
      const baseScore = currentRound === 1 ? 200 : currentRound === 2 ? 300 : 400;
      return baseScore;
    }
    const elapsed = (Date.now() - startTime) / 1000;
    const baseScore = currentRound === 1 ? 200 : currentRound === 2 ? 300 : 400;
    const attemptPenalty = attempts * 30;
    return Math.max(10, Math.floor(baseScore - elapsed * 2 - attemptPenalty));
  }

  function updateLiveScore() {
    const liveScore = calculateLiveScore();
    window.RegenboogCore.updateHUDScore(CLASS_ID, totalScore + liveScore);
  }

  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    startTime = Date.now();
    timerInterval = setInterval(function () {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      window.RegenboogCore.updateHUDTimer(CLASS_ID, elapsed, false);
      updateLiveScore();
    }, 100);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function genPath(minSteps, rows, cols) {
    var r = 0, c = 0;
    var path = [];
    var pathCells = [{ r: 0, c: 0 }];
    var maxAttempts = 500;
    var tries = 0;
    while (path.length < minSteps && tries < maxAttempts) {
      tries++;
      var dir = ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)];
      if (dir === 'up' && r > 0) {
        r--;
        path.push('omhoog');
        pathCells.push({ r: r, c: c });
      } else if (dir === 'down' && r < rows - 1) {
        r++;
        path.push('omlaag');
        pathCells.push({ r: r, c: c });
      } else if (dir === 'left' && c > 0) {
        c--;
        path.push('links');
        pathCells.push({ r: r, c: c });
      } else if (dir === 'right' && c < cols - 1) {
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

  function moveBearToCell(r, c, onDone) {
    if (!bearEl) {
      if (onDone) onDone();
      return;
    }
    var cell = area.querySelector('.beren-cell[data-r="' + r + '"][data-c="' + c + '"]');
    if (!cell) {
      if (onDone) onDone();
      return;
    }
    var cellRect = cell.getBoundingClientRect();
    var gridRect = area.querySelector('.beren-grid').getBoundingClientRect();
    var left = cellRect.left - gridRect.left + cellRect.width / 2;
    var top = cellRect.top - gridRect.top + cellRect.height / 2;
    bearEl.style.position = 'absolute';
    bearEl.style.left = left + 'px';
    bearEl.style.top = top + 'px';
    bearEl.style.transform = 'translate(-50%, -50%)';
    bearEl.style.transition = 'left 0.4s ease-out, top 0.4s ease-out';
    bearEl.style.zIndex = '10';
    setTimeout(function () {
      if (onDone) onDone();
    }, 400);
  }

  function animateBearSequence(onComplete) {
    if (isAnimating) return;
    isAnimating = true;
    var r = 0, c = 0;
    var dirs = { omhoog: [-1, 0], omlaag: [1, 0], links: [0, -1], rechts: [0, 1] };
    var i = 0;
    var stuck = false;
    var reachedHoney = false;

    function step() {
      if (i >= playerPath.length) {
        reachedHoney = (r === honey.r && c === honey.c);
        isAnimating = false;
        if (onComplete) onComplete(reachedHoney, stuck);
        return;
      }
      var d = dirs[playerPath[i]];
      if (d) {
        var nr = r + d[0];
        var nc = c + d[1];
        if (nr < 0 || nr >= gridRows || nc < 0 || nc >= gridCols) {
          stuck = true;
          isAnimating = false;
          if (onComplete) onComplete(false, true);
          return;
        }
        var hitWall = false;
        for (var w = 0; w < walls.length; w++) {
          if (walls[w].r === nr && walls[w].c === nc) {
            hitWall = true;
            break;
          }
        }
        if (hitWall) {
          stuck = true;
          isAnimating = false;
          if (onComplete) onComplete(false, true);
          return;
        }
        r = nr;
        c = nc;
        moveBearToCell(r, c, function () {
          i++;
          step();
        });
      } else {
        i++;
        step();
      }
    }
    moveBearToCell(0, 0, function () {
      step();
    });
  }

  function run() {
    attempts = 0;
    startTime = 0;
    stopTimer();
    var gs = getGridSize(currentRound);
    gridRows = gs.rows;
    gridCols = gs.cols;
    var minSteps = getMinSteps(currentRound);
    var wallChance = getWallChance(currentRound);
    var minHoneyDistance = getMinHoneyDistance();
    var res = null;
    var buildTry = 0;
    while (buildTry < 60) {
      buildTry++;
      var candidate = genPath(minSteps, gridRows, gridCols);
      var distanceFromStart = Math.abs(candidate.r) + Math.abs(candidate.c);
      if (distanceFromStart >= minHoneyDistance) {
        res = candidate;
        break;
      }
    }
    if (!res) {
      // Fallback: forceer een veilige afstand in de laatste kolom/rij.
      res = genPath(minSteps, gridRows, gridCols);
      if (gridCols > 4) {
        res.r = Math.min(gridRows - 1, 1);
        res.c = gridCols - 1;
      } else {
        res.r = gridRows - 1;
        res.c = Math.min(gridCols - 1, 3);
      }
      if (res.pathCells && res.pathCells.length > 0) {
        res.pathCells[res.pathCells.length - 1] = { r: res.r, c: res.c };
      }
    }
    targetPath = res.path;
    honey = { r: res.r, c: res.c };
    playerPath = [];
    var pathCells = res.pathCells || [{ r: 0, c: 0 }];
    for (var i = 0; i < pathCells.length; i++) {
      pathCells[i] = { r: pathCells[i].r, c: pathCells[i].c };
    }
    walls = [];
    for (var r = 0; r < gridRows; r++) {
      for (var c = 0; c < gridCols; c++) {
        if (r === 0 && c === 0) continue;
        if (r === honey.r && c === honey.c) continue;
        if (!onPath(pathCells, r, c) && Math.random() < wallChance) {
          walls.push({ r: r, c: c });
        }
      }
    }

    var gridHtml = '';
    for (var row = 0; row < gridRows; row++) {
      for (var col = 0; col < gridCols; col++) {
        var isWall = false;
        for (var w = 0; w < walls.length; w++) {
          if (walls[w].r === row && walls[w].c === col) { isWall = true; break; }
        }
        var cellClass = 'beren-cell';
        if (row === 0 && col === 0) cellClass += ' beren-start';
        else if (row === honey.r && col === honey.c) cellClass += ' beren-honey';
        else if (isWall) cellClass += ' beren-wall';
        var content = '';
        if (row === honey.r && col === honey.c) {
          content = '<span class="beren-honey-icon" aria-hidden="true">🍯</span>';
        }
        gridHtml += '<div class="' + cellClass + '" data-r="' + row + '" data-c="' + col + '">' + content + '</div>';
      }
    }

    var gridStyle = 'position: relative; display: grid; grid-template-columns: repeat(' + gridCols + ', 1fr); grid-template-rows: repeat(' + gridRows + ', 1fr); width: 100%; max-width: min(320px, 90vw); aspect-ratio: ' + gridCols + '/' + gridRows + '; gap: 4px; margin: 1rem 0; padding: 8px; background: linear-gradient(180deg, #e8dcc4 0%, #d4c4a0 100%); border-radius: 12px; border: 2px solid #8b7355; box-shadow: inset 0 2px 8px rgba(0,0,0,0.08);';
    area.innerHTML =
      window.RegenboogCore.createHUD(CLASS_ID, currentRound, TOTAL_ROUNDS, true, true) +
      '<div class="beren-layout">' +
      '<p class="beren-instruction">Ronde ' + currentRound + '/' + TOTAL_ROUNDS + '. Programmeer de beer: kies de juiste volgorde om bij de honing te komen. Start linksboven!</p>' +
      '<div class="beren-grid" style="' + gridStyle + '">' + gridHtml + '</div>' +
      '<p id="beren-sequence" class="beren-sequence">Jouw volgorde: <span id="beren-sequence-arrows" class="beren-sequence-arrows">—</span></p>' +
      '<div id="beren-buttons" class="beren-buttons"></div>' +
      '<button type="button" id="beren-run" class="beren-run">Start</button>' +
      '</div>';

    window.RegenboogCore.updateHUDRound(CLASS_ID, currentRound);
    updateLiveScore();
    startTimer();

    var gridEl = area.querySelector('.beren-grid');
    bearEl = document.createElement('img');
    bearEl.src = '/assets/images/classes/beren.png';
    bearEl.alt = 'Beer';
    bearEl.className = 'beren-bear';
    bearEl.id = 'beren-bear-img';
    var cellPct = Math.floor(90 / Math.max(gridCols, gridRows));
    bearEl.style.position = 'absolute';
    bearEl.style.zIndex = '10';
    bearEl.style.width = cellPct + '%';
    bearEl.style.height = cellPct + '%';
    bearEl.style.maxWidth = '56px';
    bearEl.style.maxHeight = '56px';
    bearEl.style.objectFit = 'contain';
    bearEl.style.pointerEvents = 'none';
    gridEl.appendChild(bearEl);
    bearEl.addEventListener('error', function () {
      var emoji = document.createElement('span');
      emoji.textContent = '🐻';
      emoji.className = 'beren-bear-emoji';
      emoji.id = 'beren-bear-img';
      emoji.style.position = 'absolute';
      emoji.style.fontSize = 'min(6vw, 1.4rem)';
      emoji.style.lineHeight = '1';
      emoji.style.zIndex = '10';
      emoji.style.pointerEvents = 'none';
      gridEl.replaceChild(emoji, bearEl);
      bearEl = emoji;
      var startCell = area.querySelector('.beren-cell.beren-start');
      if (startCell) {
        var cellRect = startCell.getBoundingClientRect();
        var gridRect = gridEl.getBoundingClientRect();
        bearEl.style.left = (cellRect.left - gridRect.left + cellRect.width / 2) + 'px';
        bearEl.style.top = (cellRect.top - gridRect.top + cellRect.height / 2) + 'px';
        bearEl.style.transform = 'translate(-50%, -50%)';
      }
    });
    var startCell = area.querySelector('.beren-cell.beren-start');
    if (startCell) {
      var cellRect = startCell.getBoundingClientRect();
      var gridRect = gridEl.getBoundingClientRect();
      bearEl.style.left = (cellRect.left - gridRect.left + cellRect.width / 2) + 'px';
      bearEl.style.top = (cellRect.top - gridRect.top + cellRect.height / 2) + 'px';
      bearEl.style.transform = 'translate(-50%, -50%)';
    }

    var seqEl = document.getElementById('beren-sequence');
    var btnWrap = document.getElementById('beren-buttons');

    ['omhoog', 'omlaag', 'links', 'rechts'].forEach(function (dir) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'beren-dir-btn beren-arrow-btn';
      b.textContent = dirToArrow[dir];
      b.title = dir;
      b.setAttribute('aria-label', dir);
      b.addEventListener('click', function () {
        if (isAnimating) return;
        playerPath.push(dir);
        var arrowsEl = document.getElementById('beren-sequence-arrows');
        if (arrowsEl) arrowsEl.textContent = pathToArrows(playerPath);
      });
      btnWrap.appendChild(b);
    });
    var clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'beren-clear-btn';
    clearBtn.textContent = 'Wissen';
    clearBtn.addEventListener('click', function () {
      if (isAnimating) return;
      playerPath = [];
      var arrowsEl = document.getElementById('beren-sequence-arrows');
      if (arrowsEl) arrowsEl.textContent = '—';
    });
    btnWrap.appendChild(clearBtn);

    document.getElementById('beren-run').addEventListener('click', function () {
      if (isAnimating) return;
      if (playerPath.length === 0) {
        alert('Kies je stappen (omhoog, omlaag, links, rechts) om bij de honing te komen.');
        return;
      }
      attempts++;
      updateLiveScore();
      animateBearSequence(function (success, stuck) {
        if (success) {
          playCorrectSound();
          stopTimer();
          const roundScore = calculateLiveScore();
          totalScore += roundScore;
          if (currentRound >= TOTAL_ROUNDS) {
            area.innerHTML = '<p class="game-score">Alle ' + TOTAL_ROUNDS + ' rondes goed! Score: ' + totalScore + '</p>';
            window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
              window.Leaderboard.render(leaderboardEl, CLASS_ID);
            });
          } else {
            currentRound++;
            area.innerHTML = '<p class="game-score">Ronde voltooid! Score: ' + roundScore + '. Totaal: ' + totalScore + '</p><button type="button" class="beren-again">Volgende ronde</button>';
            area.querySelector('.beren-again').addEventListener('click', function () { run(); });
          }
        } else {
          playWrongSound();
          setTimeout(function () {
            playerPath = [];
            var arrowsEl = document.getElementById('beren-sequence-arrows');
            if (arrowsEl) arrowsEl.textContent = '—';
            if (bearEl) {
              var startCell = area.querySelector('.beren-cell.beren-start');
              var gridEl = area.querySelector('.beren-grid');
              if (startCell && gridEl) {
                var cellRect = startCell.getBoundingClientRect();
                var gridRect = gridEl.getBoundingClientRect();
                bearEl.style.left = (cellRect.left - gridRect.left + cellRect.width / 2) + 'px';
                bearEl.style.top = (cellRect.top - gridRect.top + cellRect.height / 2) + 'px';
                bearEl.style.transition = 'left 0.4s ease-out, top 0.4s ease-out';
              }
            }
            isAnimating = false;
          }, 1000);
        }
      });
    });
  }

  function showIntro() {
    area.innerHTML =
      '<div style="text-align:center; margin-bottom:1rem;">' +
      '  <h3>Beer naar de honing</h3>' +
      '  <p style="font-size:1.05rem; color:#555; margin-bottom:0.6rem;">' +
      '    Help de beer stap voor stap bij de honing te komen.' +
      '  </p>' +
      '  <div style="margin:1rem 0; padding:1rem; background:#f5f0e8; border-radius:8px; display:inline-block; text-align:left;">' +
      '    <p style="margin:0.5rem 0;"><strong>Hoe te spelen:</strong></p>' +
      '    <p style="margin:0.5rem 0;">- Klik pijltjes om een route te programmeren</p>' +
      '    <p style="margin:0.5rem 0;">- Klik Start om de route uit te voeren</p>' +
      '    <p style="margin:0.5rem 0;">- Vermijd muren en bereik de honing</p>' +
      '    <p style="margin:0.5rem 0;">- 3 rondes: grotere grid en meer uitdaging</p>' +
      '  </div>' +
      '  <div>' +
      '    <button type="button" id="beren-start" style="padding:1rem 2rem; font-size:1.1rem; background:linear-gradient(135deg, #2a9d8f, #238276); color:white; border:none; border-radius:12px; cursor:pointer; font-weight:700;">Start spel</button>' +
      '  </div>' +
      '</div>';

    var startBtn = document.getElementById('beren-start');
    if (startBtn) {
      startBtn.addEventListener('click', function () {
        currentRound = 1;
        totalScore = 0;
        run();
      });
    }
  }

  showIntro();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
