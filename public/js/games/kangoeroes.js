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

  function getKangoeroeWrapper() {
    return area.querySelector('.kangoeroe-figuur-wrapper');
  }

  // Zelfde geluiden als in andere spellen (uilen, dolfijnen)
  function playSound(frequency, duration, type) {
    try {
      var audioContext = new (window.AudioContext || window.webkitAudioContext)();
      var oscillator = audioContext.createOscillator();
      var gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = frequency;
      oscillator.type = type || 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
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
    var wrapper = getKangoeroeWrapper();
    if (!el || !wrapper) {
      if (onDone) onDone();
      return;
    }
    el.classList.add('kangoeroe-spring');
    var stones = area.querySelectorAll('.kangoeroe-steen');
    var targetStone = stones[targetIndex];
    if (!targetStone) {
      el.classList.remove('kangoeroe-spring');
      if (onDone) onDone();
      return;
    }
    var rect = targetStone.getBoundingClientRect();
    var wrapperRect = wrapper.getBoundingClientRect();
    var left = rect.left - wrapperRect.left + rect.width / 2 - 28;
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
      '<p class="kangoeroe-ronde-som">Ronde ' + round + '/' + TOTAL_ROUNDS + ' – Som ' + (questionInRound + 1) + '/' + QUESTIONS_PER_ROUND + '</p>' +
      '<p class="kangoeroe-vraag">' + question + '</p>' +
      '<div class="kangoeroe-pad">' +
      '<div class="kangoeroe-stones-row">' + stonesHtml + '</div>' +
      '<div class="kangoeroe-figuur-wrapper">' +
      '<div id="kangoeroe-figuur" class="kangoeroe-figuur">' + kangoeroeImg + '</div>' +
      '</div>' +
      '</div>';
    
    window.RegenboogCore.updateHUDRound(CLASS_ID, round);
    setTimeout(() => updateLiveScore(), 50);
    
    var kangoeroeEl = getKangoeroeEl();
    var wrapper = getKangoeroeWrapper();
    if (kangoeroeEl && wrapper) {
      requestAnimationFrame(function () {
        var firstStone = area.querySelector('.kangoeroe-steen[data-index="0"]');
        if (firstStone) {
          var r = firstStone.getBoundingClientRect();
          var wr = wrapper.getBoundingClientRect();
          kangoeroeEl.style.left = (r.left - wr.left + r.width / 2 - 28) + 'px';
        }
      });
    }
    
    var busy = false;
    area.querySelectorAll('.kangoeroe-steen').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (busy) return;
        var selectedAnswer = parseInt(btn.dataset.n, 10);
        var idx = parseInt(btn.dataset.index, 10);
        
        busy = true;
        btn.classList.add(selectedAnswer === answer ? 'kangoeroe-goed' : 'kangoeroe-fout');
        if (selectedAnswer === answer) {
          correct++;
        } else {
          mistakes++;
          updateLiveScore();
        }
        jumpToStone(idx, function () {
          if (selectedAnswer === answer) {
            playCorrectSound();
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
          } else {
            playWrongSound();
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

  function startFresh() {
    stopTimer();
    round = 0;
    questionInRound = 0;
    correct = 0;
    totalScore = 0;
    mistakes = 0;
    startTime = 0;
    newRound();
  }

  function showIntro() {
    area.innerHTML =
      '<div style="text-align:center; margin-bottom:1rem;">' +
      '  <h3>Kangoeroes - Spring Sommen</h3>' +
      '  <p style="font-size:1.05rem; color:#555; margin-bottom:0.6rem;">Kies het juiste antwoord en spring over de stenen.</p>' +
      '  <div style="margin:1rem 0; padding:1rem; background:#f5f0e8; border-radius:8px; display:inline-block; text-align:left;">' +
      '    <p style="margin:0.5rem 0;"><strong>Hoe te spelen:</strong></p>' +
      '    <p style="margin:0.5rem 0;">- Los elke som op door op een steen te klikken</p>' +
      '    <p style="margin:0.5rem 0;">- Foute antwoorden geven strafpunten</p>' +
      '    <p style="margin:0.5rem 0;">- Speel 3 rondes met telkens 5 vragen</p>' +
      '  </div>' +
      '  <div><button type="button" id="kangoeroes-start" style="padding:1rem 2rem; font-size:1.1rem; background:linear-gradient(135deg, #8b5e34, #6f4518); color:white; border:none; border-radius:12px; cursor:pointer; font-weight:700;">Start spel</button></div>' +
      '</div>';
    var startBtn = document.getElementById('kangoeroes-start');
    if (startBtn) {
      startBtn.addEventListener('click', startFresh);
    }
  }

  showIntro();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
