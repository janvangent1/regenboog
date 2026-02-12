(function () {
  const CLASS_ID = 'muizen';
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  const ROUNDS_TO_WIN = 3;
  function getGridForRound(r) {
    if (r === 1) return { COLS: 4, ROWS: 2 };
    if (r === 2) return { COLS: 4, ROWS: 3 };
    return { COLS: 4, ROWS: 4 };
  }
  let cards = [];
  let flipped = [];
  let pairsFound = 0;
  let moves = 0;
  let block = false;
  let currentRound = 1;
  let totalMoves = 0;

  function playSound(frequency, duration, type, volume) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      function run() {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = type || 'sine';
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(volume || 0.045, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
      }
      if (ctx.state === 'suspended') ctx.resume().then(run).catch(function () {});
      else run();
    } catch (e) {}
  }

  function playFlipSound() { playSound(420, 0.05, 'triangle', 0.035); }
  function playMatchSound() { playSound(680, 0.12, 'sine', 0.055); }
  function playMismatchSound() { playSound(210, 0.14, 'sawtooth', 0.06); }

  /* Cheese illustrations as inline SVG (different types for matching) */
  const cheeseSvgs = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true"><path fill="#f4c430" stroke="#d4a017" stroke-width="1.5" d="M8 32 L32 8 L56 32 L32 56 Z"/><path fill="#e6b422" d="M32 14 L50 32 L32 50 L14 32 Z"/><circle cx="24" cy="26" r="3" fill="#d4a017" opacity="0.6"/><circle cx="40" cy="38" r="2.5" fill="#d4a017" opacity="0.6"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" fill="#f4c430" stroke="#d4a017" stroke-width="2"/><circle cx="32" cy="32" r="18" fill="none" stroke="#d4a017" stroke-width="1" opacity="0.5"/><path d="M20 32 L44 32 M32 20 L32 44" stroke="#d4a017" stroke-width="1" opacity="0.4"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true"><path fill="#f0b828" stroke="#c99a20" stroke-width="1.5" d="M12 12 L52 12 L52 52 L12 52 Z"/><path fill="#e6ae20" d="M18 18 L46 18 L46 46 L18 46 Z"/><circle cx="28" cy="28" r="4" fill="#c99a20" opacity="0.5"/><circle cx="42" cy="38" r="3" fill="#c99a20" opacity="0.5"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="36" rx="22" ry="18" fill="#f4c430" stroke="#d4a017" stroke-width="1.5"/><path fill="#e6b422" d="M14 36 Q32 20 50 36 Q32 52 14 36 Z"/><circle cx="26" cy="32" r="3" fill="#d4a017" opacity="0.5"/><circle cx="38" cy="34" r="2.5" fill="#d4a017" opacity="0.5"/></svg>'
  ];

  function getUsedSvgs(pairs) {
    var list = [];
    for (var i = 0; i < pairs; i++) {
      list.push(cheeseSvgs[i % cheeseSvgs.length]);
    }
    return list.flatMap(function (svg) {
      return [svg, svg];
    });
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function onCardClick(idx) {
    if (block || flipped.length >= 2) return;
    const card = cards[idx];
    if (card.matched || card.el.classList.contains('flipped')) return;
    playFlipSound();
    card.el.classList.add('flipped');
    card.el.innerHTML = card.svg;
    flipped.push({ idx, svg: card.svg });
    if (flipped.length === 2) {
      moves++;
      var movesEl = document.getElementById('muizen-moves');
      if (movesEl) movesEl.textContent = 'Zetten: ' + moves;
      block = true;
      if (flipped[0].svg === flipped[1].svg) {
        playMatchSound();
        cards[flipped[0].idx].matched = true;
        cards[flipped[1].idx].matched = true;
        pairsFound += 1;
        flipped = [];
        block = false;
        var PAIRS = (getGridForRound(currentRound).COLS * getGridForRound(currentRound).ROWS) / 2;
        if (pairsFound === PAIRS) {
          totalMoves += moves;
          if (currentRound < ROUNDS_TO_WIN) {
            showRoundDone();
          } else {
            showGameDone();
          }
        }
      } else {
        playMismatchSound();
        setTimeout(function () {
          cards[flipped[0].idx].el.classList.remove('flipped');
          cards[flipped[0].idx].el.innerHTML = '?';
          cards[flipped[1].idx].el.classList.remove('flipped');
          cards[flipped[1].idx].el.innerHTML = '?';
          flipped = [];
          block = false;
        }, 600);
      }
    }
  }

  function showRoundDone() {
    area.innerHTML =
      '<p class="game-score">Ronde ' + currentRound + ' klaar! Zetten: ' + moves + '</p>' +
      '<p>Ronde ' + currentRound + ' van ' + ROUNDS_TO_WIN + ' gewonnen.</p>' +
      '<button type="button" id="muizen-next-round" class="btn-next-round">Volgende ronde</button>';
    document.getElementById('muizen-next-round').addEventListener('click', function () {
      currentRound += 1;
      init();
    });
  }

  function showGameDone() {
    // Score: basis van 300 punten, minus 3 punten per move
    // Minimum score is altijd 10, zelfs bij veel moves
    var score = Math.max(10, 300 - totalMoves * 3);
    area.innerHTML =
      '<p class="game-score">Alle ' + ROUNDS_TO_WIN + ' rondes gewonnen!</p>' +
      '<p>Totaal zetten: ' + totalMoves + '. Score: ' + score + '</p>';
    window.Leaderboard.showSubmitForm(CLASS_ID, score, function () {
      window.Leaderboard.render(leaderboardEl, CLASS_ID);
    });
  }

  function init() {
    cards = [];
    flipped = [];
    pairsFound = 0;
    moves = 0;
    block = false;
    var gridCfg = getGridForRound(currentRound);
    var COLS = gridCfg.COLS;
    var ROWS = gridCfg.ROWS;
    var PAIRS = (COLS * ROWS) / 2;
    var usedSvgs = getUsedSvgs(PAIRS);

    area.innerHTML =
      '<p>Vind dezelfde kaas. Ronde <span id="muizen-round">' + currentRound + '</span> van ' + ROUNDS_TO_WIN + '. Zetten: <span id="muizen-moves">0</span></p>';
    var grid = document.createElement('div');
    grid.className = 'muizen-grid';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(' + COLS + ', 1fr)';
    grid.style.gap = '10px';
    grid.style.marginTop = '10px';
    var shuffled = shuffle(usedSvgs.slice());
    cards = shuffled.map(function (svg, i) {
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'memory-card muizen-card';
      el.textContent = '?';
      el.addEventListener('click', function () {
        onCardClick(i);
      });
      grid.appendChild(el);
      return { el: el, svg: svg, matched: false };
    });
    area.appendChild(grid);
  }

  function startFresh() {
    currentRound = 1;
    totalMoves = 0;
    init();
  }

  function showIntro() {
    area.innerHTML =
      '<div style="text-align:center; margin-bottom:1rem;">' +
      '  <h3>Muizen - Kaasmemory</h3>' +
      '  <p style="font-size:1.05rem; color:#555; margin-bottom:0.6rem;">Vind de juiste paren en onthoud waar de kaas zit.</p>' +
      '  <div style="margin:1rem 0; padding:1rem; background:#fff9e6; border-radius:8px; display:inline-block; text-align:left;">' +
      '    <p style="margin:0.5rem 0;"><strong>Hoe te spelen:</strong></p>' +
      '    <p style="margin:0.5rem 0;">- Draai telkens 2 kaarten om</p>' +
      '    <p style="margin:0.5rem 0;">- Vind alle paren om door te gaan</p>' +
      '    <p style="margin:0.5rem 0;">- Minder zetten geeft een hogere eindscore</p>' +
      '  </div>' +
      '  <div><button type="button" id="muizen-start" style="padding:1rem 2rem; font-size:1.1rem; background:linear-gradient(135deg, #d69e2e, #b7791f); color:white; border:none; border-radius:12px; cursor:pointer; font-weight:700;">Start spel</button></div>' +
      '</div>';
    var startBtn = document.getElementById('muizen-start');
    if (startBtn) {
      startBtn.addEventListener('click', startFresh);
    }
  }

  showIntro();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
