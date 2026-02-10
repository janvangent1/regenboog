(function () {
  const CLASS_ID = 'zebras';
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  /* 5e leerjaar ≈ 10-11 jaar: patroonlogica met langere reeksen en lastigere patronen */
  const ROUNDS_TO_WIN = 3;
  let round = 0;
  let correct = 0;

  function nextInPattern(pat) {
    var n = pat.length;
    if (n < 3) return null;
    var d = pat[1] - pat[0];
    var isLinear = true;
    for (var i = 2; i < n; i++) {
      if (pat[i] - pat[i - 1] !== d) { isLinear = false; break; }
    }
    if (isLinear) return pat[n - 1] + d;

    var ratio = n >= 2 && pat[0] !== 0 ? pat[1] / pat[0] : null;
    if (ratio !== null && ratio === Math.floor(ratio)) {
      var isGeometric = true;
      for (var j = 2; j < n; j++) {
        if (pat[j] / pat[j - 1] !== ratio) { isGeometric = false; break; }
      }
      if (isGeometric) return pat[n - 1] * ratio;
    }

    if (n >= 4) {
      var fib = true;
      for (var k = 2; k < n; k++) {
        if (pat[k] !== pat[k - 1] + pat[k - 2]) { fib = false; break; }
      }
      if (fib) return pat[n - 1] + pat[n - 2];
    }

    if (n >= 3) {
      var squares = true;
      for (var s = 0; s < n; s++) {
        if (pat[s] !== (s + 1) * (s + 1)) { squares = false; break; }
      }
      if (squares) return (n + 1) * (n + 1);
    }
    return null;
  }

  function buildPattern() {
    var easy = [
      { type: 'linear', step: 2, len: 4 },
      { type: 'linear', step: 3, len: 4 },
    ];
    var medium = [
      { type: 'linear', step: 2, len: 5 },
      { type: 'linear', step: 5, len: 5 },
      { type: 'geometric', ratio: 2, len: 4 },
    ];
    var hard = [
      { type: 'linear', step: 5, len: 5 },
      { type: 'geometric', ratio: 2, len: 5 },
      { type: 'geometric', ratio: 3, len: 4 },
      { type: 'squares', len: 4 },
      { type: 'fib', len: 5 },
      { type: 'double', len: 5 },
    ];
    var pool = round === 1 ? easy : round === 2 ? medium : hard;
    var t = pool[Math.floor(Math.random() * pool.length)];
    var pat = [];
    if (t.type === 'linear') {
      var start = 1 + Math.floor(Math.random() * 5);
      for (var i = 0; i < t.len; i++) pat.push(start + i * t.step);
    } else if (t.type === 'geometric') {
      var s = 1 + Math.floor(Math.random() * 2);
      for (var j = 0; j < t.len; j++) pat.push(s * Math.pow(t.ratio, j));
    } else if (t.type === 'squares') {
      for (var k = 1; k <= t.len; k++) pat.push(k * k);
    } else if (t.type === 'fib') {
      pat = [1, 1];
      for (var f = 2; f < t.len; f++) pat.push(pat[f - 1] + pat[f - 2]);
    } else if (t.type === 'double') {
      var v = 1 + Math.floor(Math.random() * 3);
      for (var d = 0; d < t.len; d++) {
        pat.push(v);
        v *= 2;
      }
    }
    return pat;
  }

  function newRound() {
    round++;
    var pat = buildPattern();
    var next = nextInPattern(pat);
    if (next === null) {
      newRound();
      return;
    }
    var wrongPool = [next + 1, next - 1, next + 2, next - 2, next * 2, next + 3, next - 3];
    var wrongs = [];
    for (var i = 0; i < wrongPool.length; i++) {
      var x = wrongPool[i];
      if (x !== next && x > 0 && x <= 200 && wrongs.indexOf(x) === -1) wrongs.push(x);
    }
    var options = [next];
    while (options.length < 4 && wrongs.length > 0) {
      var w = wrongs.splice(Math.floor(Math.random() * wrongs.length), 1)[0];
      options.push(w);
    }
    while (options.length < 4) {
      var r = next + (Math.floor(Math.random() * 7) - 3);
      if (r !== next && r > 0 && options.indexOf(r) === -1) options.push(r);
    }
    options.sort(function (a, b) { return Math.random() - 0.5; });

    area.innerHTML =
      '<p class="zebras-instruction">Ronde ' + round + '/' + ROUNDS_TO_WIN + '. Welk getal komt hierna in het patroon?</p>' +
      '<p class="zebras-sequence">' + pat.join(', ') + ', <strong>?</strong></p>' +
      '<div class="zebras-buttons">' +
      options.map(function (n) {
        return '<button type="button" class="zebras-btn" data-n="' + n + '">' + n + '</button>';
      }).join('') +
      '</div>';

    area.querySelectorAll('.zebras-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var n = parseInt(btn.dataset.n, 10);
        if (n === next) {
          correct++;
          if (round >= ROUNDS_TO_WIN) {
            var score = correct * 15;
            area.innerHTML = '<p class="game-score">Goed! Score: ' + score + '</p>';
            window.Leaderboard.showSubmitForm(CLASS_ID, score, function () {
              window.Leaderboard.render(leaderboardEl, CLASS_ID);
            });
          } else {
            newRound();
          }
        } else {
          // Alleen score geven voor correcte antwoorden tot nu toe
          var score = correct * 15;
          area.innerHTML = '<p class="game-score">Fout. Je had ' + correct + ' van ' + ROUNDS_TO_WIN + ' goed. Score: ' + score + '</p>';
          window.Leaderboard.showSubmitForm(CLASS_ID, score, function () {
            window.Leaderboard.render(leaderboardEl, CLASS_ID);
          });
        }
      });
    });
  }

  newRound();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
