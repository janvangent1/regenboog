(function () {
  const CLASS_ID = 'vlinders';
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');

  const FLOWERS = [
    { id: 'geel', name: 'gele', color: '#f4d03f', emoji: '🌼' },
    { id: 'rood', name: 'rode', color: '#e74c3c', emoji: '🌺' },
    { id: 'blauw', name: 'blauwe', color: '#3498db', emoji: '💙' },
    { id: 'paars', name: 'paarse', color: '#9b59b6', emoji: '💜' },
    { id: 'roze', name: 'roze', color: '#f78fb3', emoji: '🌸' }
  ];

  const TOTAL_ROUNDS = 3;
  let round = 0;
  let correct = 0;

  function newRound() {
    round++;
    var numFlowers = round === 1 ? 3 : round === 2 ? 4 : 5;
    var shuffled = FLOWERS.slice().sort(function () { return Math.random() - 0.5; });
    var choices = shuffled.slice(0, numFlowers);
    var target = choices[Math.floor(Math.random() * choices.length)];

    area.innerHTML =
      '<p class="vlinders-instruction">Ronde ' + round + '/' + TOTAL_ROUNDS + '. Vlinder, vlieg naar de <strong>' + target.name + ' bloem</strong>!</p>' +
      '<div class="vlinders-arena">' +
      '<div id="vlinders-butterfly" class="vlinders-butterfly">' +
      '<img src="/assets/images/classes/vlinders.png" alt="Vlinder" class="vlinders-sprite">' +
      '</div>' +
      '<div class="vlinders-flowers">' +
      choices.map(function (f) {
        return '<button type="button" class="vlinders-flower" data-id="' + f.id + '" style="--flower-color:' + f.color + '">' +
          '<span class="vlinders-flower-emoji">' + f.emoji + '</span>' +
          '</button>';
      }).join('') +
      '</div>' +
      '</div>';

    var arena = area.querySelector('.vlinders-arena');
    var butterfly = document.getElementById('vlinders-butterfly');
    var flowers = area.querySelectorAll('.vlinders-flower');

    requestAnimationFrame(function () {
      var r = arena.getBoundingClientRect();
      butterfly.style.left = (r.width / 2 - 24) + 'px';
      butterfly.style.top = (r.height - 48 - 16) + 'px';
    });

    var img = butterfly.querySelector('img');
    if (img) img.addEventListener('error', function () {
      var s = document.createElement('span');
      s.className = 'vlinders-emoji-fallback';
      s.textContent = '🦋';
      this.parentNode.replaceChild(s, this);
    });

    flowers.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var isRight = btn.dataset.id === target.id;
        var rect = btn.getBoundingClientRect();
        var arenaRect = arena.getBoundingClientRect();
        var x = rect.left - arenaRect.left + rect.width / 2 - 24;
        var y = rect.top - arenaRect.top + rect.height / 2 - 24;
        butterfly.style.left = x + 'px';
        butterfly.style.top = y + 'px';
        butterfly.classList.add('vlinders-vlieg');

        setTimeout(function () {
          if (isRight) {
            correct++;
            if (round >= TOTAL_ROUNDS) {
              var score = correct * 20;
              area.innerHTML = '<p class="game-score">Heel goed! Score: ' + score + '</p>';
              window.Leaderboard.showSubmitForm(CLASS_ID, score, function () {
                window.Leaderboard.render(leaderboardEl, CLASS_ID);
              });
            } else {
              newRound();
            }
          } else {
            // Alleen score geven als je goed bent, niet bij fout antwoord
            var score = correct * 20;
            area.innerHTML = '<p class="game-score">Fout. Je had ' + correct + ' van ' + TOTAL_ROUNDS + ' goed. Score: ' + score + '</p>';
            window.Leaderboard.showSubmitForm(CLASS_ID, score, function () {
              window.Leaderboard.render(leaderboardEl, CLASS_ID);
            });
          }
        }, 600);
      });
    });
  }

  newRound();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
