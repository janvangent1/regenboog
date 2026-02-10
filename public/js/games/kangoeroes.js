(function () {
  const CLASS_ID = 'kangoeroes';
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  const TOTAL_ROUNDS = 3;
  const QUESTIONS_PER_ROUND = 5;
  const PENALTY_PER_MISTAKE = 20; // strafpunten per fout
  let round = 0;
  let questionInRound = 0; // 0 t/m 4: welke van de 5 sommen
  let correct = 0;
  let totalScore = 0;
  let startTime = 0;
  let mistakes = 0;
  let timerInterval = null;

  var kangoeroeImg = '<img src="/assets/images/classes/kangoeroes.png" alt="Kangoeroe" class="kangoeroe-sprite">';

  function getKangoeroeEl() {
    return document.getElementById('kangoeroe-figuur');
  }

  function calculateLiveScore() {
    if (startTime === 0) {
      // Return base score if timer hasn't started yet
      const baseScore = round === 1 ? 200 : round === 2 ? 300 : 400;
      return baseScore;
    }
    const elapsed = (Date.now() - startTime) / 1000;
    const baseScore = round === 1 ? 200 : round === 2 ? 300 : 400;
    return Math.max(10, Math.floor(baseScore - elapsed * 5 - mistakes * PENALTY_PER_MISTAKE));
  }

  function updateLiveScore() {
    const liveScore = calculateLiveScore();
    window.RegenboogCore.updateHUDScore(CLASS_ID, liveScore);
  }

  function startTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    startTime = Date.now();
    timerInterval = setInterval(updateLiveScore, 100);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function generateQuestion() {
    let question = '';
    let answer = 0;
    let options = [];

    if (round === 1) {
      // Ronde 1: Eenvoudige rekensommen tot 10 (optellen en aftrekken)
      const operation = Math.random() < 0.5 ? 'add' : 'subtract';
      
      if (operation === 'add') {
        const a = 1 + Math.floor(Math.random() * 5); // 1-5
        const b = 1 + Math.floor(Math.random() * (10 - a)); // Zorg dat som <= 10
        answer = a + b;
        question = a + ' + ' + b + ' = ?';
      } else {
        const a = 2 + Math.floor(Math.random() * 9); // 2-10
        const b = 1 + Math.floor(Math.random() * (a - 1)); // Zorg dat verschil > 0
        answer = a - b;
        question = a + ' - ' + b + ' = ?';
      }
      
      // Genereer 3 opties: correct antwoord + 2 foute
      options = [answer];
      while (options.length < 3) {
        const wrong = answer + (Math.random() < 0.5 ? -2 : 2) + Math.floor(Math.random() * 3) - 1;
        if (wrong >= 0 && wrong <= 10 && options.indexOf(wrong) === -1) {
          options.push(wrong);
        } else {
          // Fallback: random getal tussen 0-10
          const fallback = Math.floor(Math.random() * 11);
          if (options.indexOf(fallback) === -1) {
            options.push(fallback);
          }
        }
      }
    } else if (round === 2) {
      // Ronde 2: Eenvoudige maaltafels (1x1 t/m 5x5)
      const table = 1 + Math.floor(Math.random() * 5); // 1-5
      const multiplier = 1 + Math.floor(Math.random() * 5); // 1-5
      answer = table * multiplier;
      question = table + ' × ' + multiplier + ' = ?';
      
      // Genereer 3 opties: correct antwoord + 2 foute
      options = [answer];
      while (options.length < 3) {
        // Foute opties kunnen dichtbij het juiste antwoord zijn
        const wrong = answer + (Math.random() < 0.5 ? -table : table);
        if (wrong > 0 && wrong <= 25 && options.indexOf(wrong) === -1) {
          options.push(wrong);
        } else {
          // Fallback: random getal tussen 1-25
          const fallback = 1 + Math.floor(Math.random() * 25);
          if (options.indexOf(fallback) === -1) {
            options.push(fallback);
          }
        }
      }
    } else {
      // Ronde 3: Maaltafels met grotere getallen (6x6 t/m 10x10)
      const table = 6 + Math.floor(Math.random() * 5); // 6-10
      const multiplier = 6 + Math.floor(Math.random() * 5); // 6-10
      answer = table * multiplier;
      question = table + ' × ' + multiplier + ' = ?';
      
      // Genereer 3 opties: correct antwoord + 2 foute
      options = [answer];
      while (options.length < 3) {
        // Foute opties kunnen dichtbij het juiste antwoord zijn
        const wrong = answer + (Math.random() < 0.5 ? -table : table);
        if (wrong > 0 && wrong <= 100 && options.indexOf(wrong) === -1) {
          options.push(wrong);
        } else {
          // Fallback: random getal tussen 36-100
          const fallback = 36 + Math.floor(Math.random() * 65);
          if (options.indexOf(fallback) === -1) {
            options.push(fallback);
          }
        }
      }
    }

    // Shuffle opties
    options.sort(() => Math.random() - 0.5);
    
    return { question, answer, options };
  }

  function jumpToStone(targetIndex, onDone) {
    var el = getKangoeroeEl();
    if (!el) {
        if (onDone) onDone();
        return;
    }
    el.classList.add('kangoeroe-spring');
    var stones = area.querySelectorAll('.kangoeroe-steen');
    var targetStone = stones[targetIndex];
    if (!targetStone) {
        if (onDone) onDone();
        return;
    }
    var rect = targetStone.getBoundingClientRect();
    var container = area.querySelector('.kangoeroe-pad');
    var containerRect = container.getBoundingClientRect();
    var left = rect.left - containerRect.left + rect.width / 2 - 28;
    el.style.left = left + 'px';
    setTimeout(function () {
      el.classList.remove('kangoeroe-spring');
      if (onDone) onDone();
    }, 550);
  }

  function showQuestion() {
    const { question, answer, options } = generateQuestion();
    
    var stonesHtml = '';
    options.forEach((option, index) => {
      stonesHtml +=
        '<button type="button" class="kangoeroe-steen" data-n="' + option + '" data-index="' + index + '">' + option + '</button>';
    });
    
    area.innerHTML =
      window.RegenboogCore.createHUD(CLASS_ID, round, TOTAL_ROUNDS, false, true) +
      '<p class="kangoeroe-vraag" style="font-size: 1.3rem; margin-bottom: 1.5rem;">Ronde ' + round + '/' + TOTAL_ROUNDS + ' – Som ' + (questionInRound + 1) + '/' + QUESTIONS_PER_ROUND + '. ' + question + '</p>' +
      '<div class="kangoeroe-pad">' +
      '<div id="kangoeroe-figuur" class="kangoeroe-figuur">' + kangoeroeImg + '</div>' +
      stonesHtml +
      '</div>';
    
    window.RegenboogCore.updateHUDRound(CLASS_ID, round);
    setTimeout(() => updateLiveScore(), 50);
    
    var pad = area.querySelector('.kangoeroe-pad');
    var kangoeroeEl = getKangoeroeEl();
    if (kangoeroeEl && pad) {
      requestAnimationFrame(function () {
        var firstStone = area.querySelector('.kangoeroe-steen[data-index="0"]');
        if (firstStone) {
          var r = firstStone.getBoundingClientRect();
          var cr = pad.getBoundingClientRect();
          kangoeroeEl.style.left = (r.left - cr.left + r.width / 2 - 28) + 'px';
        }
      });
    }
    
    var busy = false;
    area.querySelectorAll('.kangoeroe-steen').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (busy) return;
        var selectedAnswer = parseInt(btn.dataset.n, 10);
        var idx = parseInt(btn.dataset.index, 10);
        
        if (selectedAnswer === answer) {
          busy = true;
          correct++;
          btn.classList.add('kangoeroe-goed');
          jumpToStone(idx, function () {
            questionInRound++;
            if (questionInRound < QUESTIONS_PER_ROUND) {
              showQuestion();
            } else {
              stopTimer();
              const roundScore = calculateLiveScore();
              totalScore += roundScore;
              if (round >= TOTAL_ROUNDS) {
                area.innerHTML = '<p class="game-score">Goed gedaan! Alle ' + (TOTAL_ROUNDS * QUESTIONS_PER_ROUND) + ' sommen goed. Totaal Score: ' + totalScore + '</p>';
                window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
                  window.Leaderboard.render(leaderboardEl, CLASS_ID);
                });
              } else {
                round++;
                questionInRound = 0;
                newRound();
              }
            }
          });
        } else {
          mistakes++;
          updateLiveScore();
          busy = true;
          btn.classList.add('kangoeroe-fout');
          // Korte feedback: strafpunten, daarna nieuwe som
          setTimeout(function () {
            area.innerHTML =
              window.RegenboogCore.createHUD(CLASS_ID, round, TOTAL_ROUNDS, false, true) +
              '<p class="kangoeroe-vraag" style="font-size: 1.3rem; margin-bottom: 1rem;">Fout! Het juiste antwoord was <strong>' + answer + '</strong>. −' + PENALTY_PER_MISTAKE + ' punten.</p>' +
              '<p style="color: #666;">Nieuwe som...</p>';
            window.RegenboogCore.updateHUDScore(CLASS_ID, calculateLiveScore());
            window.RegenboogCore.updateHUDRound(CLASS_ID, round);
            setTimeout(showQuestion, 1200);
          }, 500);
        }
      });
    });
  }

  function newRound() {
    mistakes = 0;
    questionInRound = 0;
    if (round === 0) round = 1;
    stopTimer();
    startTimer();
    showQuestion();
  }

  newRound();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
