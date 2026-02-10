(function () {
  const CLASS_ID = 'leeuwen';
  const TOTAL_ROUNDS = 3;
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  let gridRows = 5;
  let gridCols = 5;
  let currentRound = 1;
  let totalScore = 0;
  let targetPath = [];
  let playerPath = [];
  let prey = { r: 0, c: 0 };
  let walls = [];
  let attempts = 0;
  let startTime = 0;
  let timerInterval = null;
  let lionEl = null;
  let isAnimating = false;

  function getGridSize(round) {
    if (round === 1) return { rows: 5, cols: 5 };
    if (round === 2) return { rows: 6, cols: 6 };
    return { rows: 7, cols: 7 };
  }

  function getMinSteps(round) {
    if (round === 1) return 6;
    if (round === 2) return 11;
    return 16;
  }

  function getWallChance(round) {
    if (round === 1) return 0.42;
    if (round === 2) return 0.52;
    return 0.58;
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
      var baseScore = currentRound === 1 ? 250 : currentRound === 2 ? 350 : 450;
      return baseScore;
    }
    var elapsed = (Date.now() - startTime) / 1000;
    var baseScore = currentRound === 1 ? 250 : currentRound === 2 ? 350 : 450;
    var attemptPenalty = attempts * 35;
    return Math.max(10, Math.floor(baseScore - elapsed * 2 - attemptPenalty));
  }

  function updateLiveScore() {
    var liveScore = calculateLiveScore();
    window.RegenboogCore.updateHUDScore(CLASS_ID, totalScore + liveScore);
  }

  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    startTime = Date.now();
    timerInterval = setInterval(function () {
      var elapsed = Math.floor((Date.now() - startTime) / 1000);
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
    var maxAttempts = 600;
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
    if (r === 0 && c === 0 && path.length > 0 && cols > 1) {
      path.push('rechts');
      c = 1;
      pathCells.push({ r: r, c: c });
    }
    return { path: path, r: r, c: c, pathCells: pathCells };
  }

  function onPath(pathCells, r, c) {
    for (var i = 0; i < pathCells.length; i++) {
      if (pathCells[i].r === r && pathCells[i].c === c) return true;
    }
    return false;
  }

  function moveLionToCell(r, c, onDone) {
    if (!lionEl) {
      if (onDone) onDone();
      return;
    }
    var cell = area.querySelector('.leeuwen-cell[data-r="' + r + '"][data-c="' + c + '"]');
    if (!cell) {
      if (onDone) onDone();
      return;
    }
    var cellRect = cell.getBoundingClientRect();
    var gridRect = area.querySelector('.leeuwen-grid').getBoundingClientRect();
    var left = cellRect.left - gridRect.left + cellRect.width / 2;
    var top = cellRect.top - gridRect.top + cellRect.height / 2;
    lionEl.style.position = 'absolute';
    lionEl.style.left = left + 'px';
    lionEl.style.top = top + 'px';
    lionEl.style.transform = 'translate(-50%, -50%)';
    lionEl.style.transition = 'left 0.4s ease-out, top 0.4s ease-out';
    lionEl.style.zIndex = '10';
    setTimeout(function () {
      if (onDone) onDone();
    }, 400);
  }

  function animateLionSequence(onComplete) {
    if (isAnimating) return;
    isAnimating = true;
    var r = 0, c = 0;
    var dirs = { omhoog: [-1, 0], omlaag: [1, 0], links: [0, -1], rechts: [0, 1] };
    var i = 0;
    var stuck = false;
    var reachedPrey = false;

    function step() {
      if (i >= playerPath.length) {
        reachedPrey = (r === prey.r && c === prey.c);
        isAnimating = false;
        if (onComplete) onComplete(reachedPrey, stuck);
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
        moveLionToCell(r, c, function () {
          i++;
          step();
        });
      } else {
        i++;
        step();
      }
    }
    moveLionToCell(0, 0, function () {
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
    var res = genPath(minSteps, gridRows, gridCols);
    targetPath = res.path;
    prey = { r: res.r, c: res.c };
    playerPath = [];
    var pathCells = res.pathCells || [{ r: 0, c: 0 }];
    for (var i = 0; i < pathCells.length; i++) {
      pathCells[i] = { r: pathCells[i].r, c: pathCells[i].c };
    }
    walls = [];
    for (var r = 0; r < gridRows; r++) {
      for (var c = 0; c < gridCols; c++) {
        if (r === 0 && c === 0) continue;
        if (r === prey.r && c === prey.c) continue;
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
        var cellClass = 'leeuwen-cell';
        if (row === 0 && col === 0) cellClass += ' leeuwen-start';
        else if (row === prey.r && col === prey.c) cellClass += ' leeuwen-prooi';
        else if (isWall) cellClass += ' leeuwen-wall';
        var content = '';
        if (row === prey.r && col === prey.c) {
          content = '<span class="leeuwen-prooi-icon" aria-hidden="true">🦌</span>';
        }
        gridHtml += '<div class="' + cellClass + '" data-r="' + row + '" data-c="' + col + '">' + content + '</div>';
      }
    }

    var gridStyle = 'position: relative; display: grid; grid-template-columns: repeat(' + gridCols + ', 1fr); grid-template-rows: repeat(' + gridRows + ', 1fr); width: 100%; max-width: min(360px, 92vw); aspect-ratio: ' + gridCols + '/' + gridRows + '; gap: 4px; margin: 1rem 0; padding: 8px; background: linear-gradient(180deg, #e8dcb4 0%, #d4c494 100%); border-radius: 12px; border: 2px solid #b8860b; box-shadow: inset 0 2px 8px rgba(0,0,0,0.08);';
    area.innerHTML =
      window.RegenboogCore.createHUD(CLASS_ID, currentRound, TOTAL_ROUNDS, true, true) +
      '<p class="leeuwen-instruction">Ronde ' + currentRound + '/' + TOTAL_ROUNDS + '. Plan de jacht: kies de juiste volgorde om de prooi te bereiken. Leeuw start linksboven!</p>' +
      '<div class="leeuwen-grid" style="' + gridStyle + '">' + gridHtml + '</div>' +
      '<p id="leeuwen-sequence" class="leeuwen-sequence">Jouw volgorde: <span id="leeuwen-sequence-arrows" class="leeuwen-sequence-arrows">—</span></p>' +
      '<div id="leeuwen-buttons" class="leeuwen-buttons"></div>' +
      '<button type="button" id="leeuwen-run" class="leeuwen-run">Start jacht</button>';

    window.RegenboogCore.updateHUDRound(CLASS_ID, currentRound);
    updateLiveScore();
    startTimer();

    var gridEl = area.querySelector('.leeuwen-grid');
    lionEl = document.createElement('img');
    lionEl.src = '/assets/images/classes/leeuwen.png';
    lionEl.alt = 'Leeuw';
    lionEl.className = 'leeuwen-lion';
    lionEl.id = 'leeuwen-lion-img';
    var cellPct = Math.floor(90 / Math.max(gridCols, gridRows));
    lionEl.style.position = 'absolute';
    lionEl.style.zIndex = '10';
    lionEl.style.width = cellPct + '%';
    lionEl.style.height = cellPct + '%';
    lionEl.style.maxWidth = '52px';
    lionEl.style.maxHeight = '52px';
    lionEl.style.objectFit = 'contain';
    lionEl.style.pointerEvents = 'none';
    gridEl.appendChild(lionEl);
    lionEl.addEventListener('error', function () {
      var emoji = document.createElement('span');
      emoji.textContent = '🦁';
      emoji.className = 'leeuwen-lion-emoji';
      emoji.id = 'leeuwen-lion-img';
      emoji.style.position = 'absolute';
      emoji.style.fontSize = 'min(5vw, 1.2rem)';
      emoji.style.lineHeight = '1';
      emoji.style.zIndex = '10';
      emoji.style.pointerEvents = 'none';
      gridEl.replaceChild(emoji, lionEl);
      lionEl = emoji;
      var startCell = area.querySelector('.leeuwen-cell.leeuwen-start');
      if (startCell) {
        var cellRect = startCell.getBoundingClientRect();
        var gridRect = gridEl.getBoundingClientRect();
        lionEl.style.left = (cellRect.left - gridRect.left + cellRect.width / 2) + 'px';
        lionEl.style.top = (cellRect.top - gridRect.top + cellRect.height / 2) + 'px';
        lionEl.style.transform = 'translate(-50%, -50%)';
      }
    });
    var startCell = area.querySelector('.leeuwen-cell.leeuwen-start');
    if (startCell) {
      var cellRect = startCell.getBoundingClientRect();
      var gridRect = gridEl.getBoundingClientRect();
      lionEl.style.left = (cellRect.left - gridRect.left + cellRect.width / 2) + 'px';
      lionEl.style.top = (cellRect.top - gridRect.top + cellRect.height / 2) + 'px';
      lionEl.style.transform = 'translate(-50%, -50%)';
    }

    var seqEl = document.getElementById('leeuwen-sequence');
    var btnWrap = document.getElementById('leeuwen-buttons');

    ['omhoog', 'omlaag', 'links', 'rechts'].forEach(function (dir) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'leeuwen-dir-btn leeuwen-arrow-btn';
      b.textContent = dirToArrow[dir];
      b.title = dir;
      b.setAttribute('aria-label', dir);
      b.addEventListener('click', function () {
        if (isAnimating) return;
        playerPath.push(dir);
        var arrowsEl = document.getElementById('leeuwen-sequence-arrows');
        if (arrowsEl) arrowsEl.textContent = pathToArrows(playerPath);
      });
      btnWrap.appendChild(b);
    });
    var clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'leeuwen-clear-btn';
    clearBtn.textContent = 'Wissen';
    clearBtn.addEventListener('click', function () {
      if (isAnimating) return;
      playerPath = [];
      var arrowsEl = document.getElementById('leeuwen-sequence-arrows');
      if (arrowsEl) arrowsEl.textContent = '—';
    });
    btnWrap.appendChild(clearBtn);

    document.getElementById('leeuwen-run').addEventListener('click', function () {
      if (isAnimating) return;
      if (playerPath.length === 0) {
        alert('Kies je stappen (pijltjes) om de prooi te bereiken.');
        return;
      }
      attempts++;
      updateLiveScore();
      animateLionSequence(function (success, stuck) {
        if (success) {
          playCorrectSound();
          stopTimer();
          var roundScore = calculateLiveScore();
          totalScore += roundScore;
          if (currentRound >= TOTAL_ROUNDS) {
            area.innerHTML = '<p class="game-score">Alle ' + TOTAL_ROUNDS + ' rondes goed! Score: ' + totalScore + '</p>';
            window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
              window.Leaderboard.render(leaderboardEl, CLASS_ID);
            });
          } else {
            currentRound++;
            area.innerHTML = '<p class="game-score">Ronde voltooid! Score: ' + roundScore + '. Totaal: ' + totalScore + '</p><button type="button" class="leeuwen-again">Volgende ronde</button>';
            area.querySelector('.leeuwen-again').addEventListener('click', function () { run(); });
          }
        } else {
          playWrongSound();
          setTimeout(function () {
            playerPath = [];
            var arrowsEl = document.getElementById('leeuwen-sequence-arrows');
            if (arrowsEl) arrowsEl.textContent = '—';
            if (lionEl) {
              var startCell = area.querySelector('.leeuwen-cell.leeuwen-start');
              var gridEl = area.querySelector('.leeuwen-grid');
              if (startCell && gridEl) {
                var cellRect = startCell.getBoundingClientRect();
                var gridRect = gridEl.getBoundingClientRect();
                lionEl.style.left = (cellRect.left - gridRect.left + cellRect.width / 2) + 'px';
                lionEl.style.top = (cellRect.top - gridRect.top + cellRect.height / 2) + 'px';
                lionEl.style.transition = 'left 0.4s ease-out, top 0.4s ease-out';
              }
            }
            isAnimating = false;
          }, 1000);
        }
      });
    });
  }

  run();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
