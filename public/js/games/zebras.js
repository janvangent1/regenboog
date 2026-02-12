(function () {
  const CLASS_ID = 'zebras';
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  const TOTAL_ROUNDS = 3;
  const ROUND_BASE_SCORE = [130, 170, 220];
  const FIRST_HINT_PENALTY = 15;
  const SECOND_HINT_PENALTY = 30;
  const THIRD_HINT_PENALTY = 35;
  const FOURTH_HINT_PENALTY = 40;
  const WRONG_PENALTY = 18;
  const MIN_ROUND_SCORE = 20;

  let currentRound = 1;
  let totalScore = 0;
  let currentQuestion = null;
  let roundStartTime = 0;
  let timerInterval = null;
  let hintStageThisRound = 0; // 0 none, 1 pattern hint, 2/3/4 elimination hints
  let hintPenaltyThisRound = 0;
  let wrongGuessesThisRound = 0;
  let answered = false;
  let lastPatternLabel = null; // voorkomt hetzelfde patroon twee keer na elkaar

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
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
      }
      if (ctx.state === 'suspended') ctx.resume().then(play).catch(function () {});
      else play();
    } catch (e) {}
  }

  function playCorrectSound() { playSound(620, 0.2, 'sine'); }
  function playWrongSound() { playSound(220, 0.25, 'sawtooth'); }
  function playHintSound() { playSound(470, 0.2, 'triangle'); }

  function shuffle(arr) {
    var copy = arr.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function buildArithmetic(start, step, len) {
    var seq = [];
    for (var i = 0; i < len; i++) seq.push(start + i * step);
    return { seq: seq, next: start + len * step };
  }

  function buildAlternatingAdd(start, a, b, len) {
    var seq = [start];
    for (var i = 1; i < len; i++) {
      var add = i % 2 === 1 ? a : b;
      seq.push(seq[i - 1] + add);
    }
    var nextAdd = len % 2 === 1 ? a : b;
    return { seq: seq, next: seq[seq.length - 1] + nextAdd };
  }

  function buildRepeatingDiff(start, diffs, len) {
    var seq = [start];
    for (var i = 1; i < len; i++) {
      var d = diffs[(i - 1) % diffs.length];
      seq.push(seq[i - 1] + d);
    }
    var nextDiff = diffs[(len - 1) % diffs.length];
    return { seq: seq, next: seq[seq.length - 1] + nextDiff };
  }

  function buildGeometric(start, ratio, len) {
    var seq = [];
    for (var i = 0; i < len; i++) seq.push(start * Math.pow(ratio, i));
    return { seq: seq, next: seq[seq.length - 1] * ratio };
  }

  function isQuestionValid(seq, next) {
    if (!seq || !seq.length) return false;
    if (!Number.isFinite(next)) return false;
    if (next <= 0 || next > 999) return false;
    for (var i = 0; i < seq.length; i++) {
      if (!Number.isFinite(seq[i]) || seq[i] <= 0 || seq[i] > 999) return false;
    }
    return true;
  }

  function createQuestion(round) {
    // Ronde 1: alleen heel eenvoudige patronen (korte reeks, kleine getallen, +2 t/m +4)
    var round1Generators = [
      function () {
        var step = randInt(2, 3);
        var start = randInt(2, 10);
        var g = buildArithmetic(start, step, 4);
        return { seq: g.seq, next: g.next, hint: 'Elke stap tel je ' + step + ' bij.', label: '+' + step };
      },
      function () {
        var step = 4;
        var start = randInt(2, 8);
        var g = buildArithmetic(start, step, 4);
        return { seq: g.seq, next: g.next, hint: 'Elke stap tel je 4 bij.', label: '+4' };
      },
      function () {
        var start = randInt(3, 12);
        var g = buildAlternatingAdd(start, 1, 2, 4);
        return { seq: g.seq, next: g.next, hint: 'Om en om: +1, dan +2.', label: '+1,+2' };
      }
    ];

    var easyGenerators = [
      function () {
        var step = randInt(2, 4);
        var start = randInt(2, 18);
        var g = buildArithmetic(start, step, 5);
        return { seq: g.seq, next: g.next, hint: 'Elke stap tel je ' + step + ' bij.', label: '+' + step };
      },
      function () {
        var step = randInt(5, 10);
        var start = randInt(5, 40);
        var g = buildArithmetic(start, step, 4);
        return { seq: g.seq, next: g.next, hint: 'Dit zijn sprongen van ' + step + '.', label: 'sprongen van ' + step };
      },
      function () {
        var start = randInt(3, 18);
        var g = buildAlternatingAdd(start, 1, 2, 6);
        return { seq: g.seq, next: g.next, hint: 'Om en om: +1, dan +2.', label: '+1,+2' };
      },
      function () {
        var start = randInt(2, 16);
        var g = buildAlternatingAdd(start, 2, 3, 6);
        return { seq: g.seq, next: g.next, hint: 'Om en om: +2, dan +3.', label: '+2,+3' };
      },
      function () {
        var start = randInt(1, 10);
        var g = buildRepeatingDiff(start, [2, 2, 4], 7);
        return { seq: g.seq, next: g.next, hint: 'Het verschil herhaalt: +2, +2, +4.', label: 'herhaal +2,+2,+4' };
      },
      function () {
        var start = randInt(4, 20);
        var g = buildRepeatingDiff(start, [3, 1, 3], 7);
        return { seq: g.seq, next: g.next, hint: 'Het verschil herhaalt: +3, +1, +3.', label: 'herhaal +3,+1,+3' };
      },
      function () {
        var base = randInt(2, 6);
        var seq = [];
        for (var i = 1; i <= 5; i++) seq.push(base * i);
        return { seq: seq, next: base * 6, hint: 'Dit zijn veelvouden van ' + base + '.', label: 'veelvouden van ' + base };
      },
      function () {
        var start = randInt(1, 4);
        var g = buildGeometric(start, 2, 5);
        return { seq: g.seq, next: g.next, hint: 'Elk getal is het dubbele van het vorige.', label: 'x2' };
      },
      function () {
        var start = randInt(1, 4);
        var seq = [start];
        for (var i = 1; i < 6; i++) seq.push(seq[i - 1] + i);
        return { seq: seq, next: seq[seq.length - 1] + 6, hint: 'Je telt telkens 1 meer bij: +1, +2, +3 ...', label: 'groeiende stappen' };
      },
      function () {
        var start = randInt(12, 40);
        var step = randInt(2, 4);
        var g = buildArithmetic(start, -step, 5);
        return { seq: g.seq, next: g.next, hint: 'Het patroon daalt telkens met ' + step + '.', label: '-' + step };
      }
    ];

    var mediumGenerators = [
      function () {
        var step = randInt(6, 12);
        var start = randInt(6, 45);
        var g = buildArithmetic(start, step, 5);
        return { seq: g.seq, next: g.next, hint: 'Elke stap tel je ' + step + ' bij.', label: '+' + step };
      },
      function () {
        var start = randInt(1, 4);
        var g = buildGeometric(start, 2, 6);
        return { seq: g.seq, next: g.next, hint: 'Elk getal is het dubbele van het vorige.', label: 'x2' };
      },
      function () {
        var start = randInt(2, 12);
        var g = buildAlternatingAdd(start, 2, 4, 7);
        return { seq: g.seq, next: g.next, hint: 'Om en om: +2, dan +4.', label: '+2,+4' };
      },
      function () {
        var start = randInt(2, 10);
        var g = buildAlternatingAdd(start, 3, 5, 7);
        return { seq: g.seq, next: g.next, hint: 'Om en om: +3, dan +5.', label: '+3,+5' };
      },
      function () {
        var start = randInt(2, 12);
        var g = buildRepeatingDiff(start, [2, 4, 6], 7);
        return { seq: g.seq, next: g.next, hint: 'Het verschil herhaalt: +2, +4, +6.', label: 'herhaal +2,+4,+6' };
      },
      function () {
        var start = randInt(3, 18);
        var g = buildRepeatingDiff(start, [5, 2], 8);
        return { seq: g.seq, next: g.next, hint: 'Het verschil herhaalt: +5, +2.', label: 'herhaal +5,+2' };
      },
      function () {
        var start = randInt(45, 90);
        var step = randInt(3, 6);
        var g = buildArithmetic(start, -step, 6);
        return { seq: g.seq, next: g.next, hint: 'Het patroon daalt telkens met ' + step + '.', label: '-' + step };
      },
      function () {
        var a = randInt(2, 5);
        var b = randInt(2, 7);
        var seq = [a, b];
        while (seq.length < 6) seq.push(seq[seq.length - 1] + seq[seq.length - 2]);
        return { seq: seq, next: seq[seq.length - 1] + seq[seq.length - 2], hint: 'Elk getal is de som van de vorige twee.', label: 'som vorige 2' };
      },
      function () {
        var start = randInt(1, 8);
        var seq = [start];
        for (var i = 1; i < 6; i++) seq.push(seq[i - 1] * 2 + 1);
        return { seq: seq, next: seq[seq.length - 1] * 2 + 1, hint: 'Eerst x2, daarna +1.', label: 'x2 +1' };
      },
      function () {
        var start = randInt(2, 9);
        var seq = [];
        for (var i = 0; i < 6; i++) seq.push(start + i * i);
        return { seq: seq, next: start + 36, hint: 'Je telt kwadraten op: +0, +1, +4, +9 ...', label: 'start + n²' };
      }
    ];

    var hardGenerators = [
      function () {
        var start = randInt(1, 3);
        var g = buildGeometric(start, 3, 5);
        return { seq: g.seq, next: g.next, hint: 'Elk getal is 3 keer het vorige.', label: 'x3' };
      },
      function () {
        var start = randInt(3, 7);
        var g = buildGeometric(start, 2, 6);
        return { seq: g.seq, next: g.next, hint: 'Elk getal is het dubbele van het vorige.', label: 'x2 (grote start)' };
      },
      function () {
        var a = randInt(2, 6);
        var b = randInt(a + 1, a + 6);
        var seq = [a, b];
        while (seq.length < 7) seq.push(seq[seq.length - 1] + seq[seq.length - 2]);
        return { seq: seq, next: seq[seq.length - 1] + seq[seq.length - 2], hint: 'Elk getal is de som van de vorige twee.', label: 'fibonacci-achtig' };
      },
      function () {
        var seq = [];
        for (var i = 2; i <= 7; i++) seq.push(i * i);
        return { seq: seq, next: 64, hint: 'Dit zijn opeenvolgende kwadraten.', label: 'kwadraten' };
      },
      function () {
        var seq = [];
        for (var i = 1; i <= 5; i++) seq.push(i * i * i);
        return { seq: seq, next: 216, hint: 'Dit zijn derdemachten: 1³, 2³, 3³ ...', label: 'kubussen' };
      },
      function () {
        var start = randInt(3, 12);
        var g = buildRepeatingDiff(start, [3, 6, 3, 6], 8);
        return { seq: g.seq, next: g.next, hint: 'Het verschil wisselt: +3, +6, +3, +6 ...', label: '+3,+6' };
      },
      function () {
        var start = randInt(2, 6);
        var seq = [start];
        for (var i = 1; i < 6; i++) {
          if (i % 2 === 1) seq.push(seq[i - 1] * 2);
          else seq.push(seq[i - 1] + 3);
        }
        var next = 6 % 2 === 1 ? seq[seq.length - 1] * 2 : seq[seq.length - 1] + 3;
        return { seq: seq, next: next, hint: 'Wissel steeds: x2, dan +3.', label: 'x2,+3 afwisselend' };
      },
      function () {
        var start = randInt(10, 30);
        var seq = [start];
        var add = 2;
        while (seq.length < 7) {
          seq.push(seq[seq.length - 1] + add);
          add++;
        }
        return { seq: seq, next: seq[seq.length - 1] + add, hint: 'De sprongen groeien: +2, +3, +4 ...', label: 'groeiende sprongen' };
      },
      function () {
        var start = randInt(20, 45);
        var seq = [start];
        for (var i = 1; i < 7; i++) {
          if (i % 2 === 1) seq.push(seq[i - 1] - 4);
          else seq.push(seq[i - 1] + 9);
        }
        var next = 7 % 2 === 1 ? seq[seq.length - 1] - 4 : seq[seq.length - 1] + 9;
        return { seq: seq, next: next, hint: 'Wissel: -4, daarna +9.', label: '-4,+9' };
      },
      function () {
        var base = randInt(2, 4);
        var seq = [];
        for (var i = 1; i <= 6; i++) seq.push(base * i * i);
        return { seq: seq, next: base * 49, hint: 'Het zijn kwadraten, telkens vermenigvuldigd met ' + base + '.', label: base + ' x n²' };
      },
      function () {
        var start = randInt(2, 8);
        var seq = [start];
        for (var i = 1; i < 6; i++) seq.push(seq[i - 1] * 3 - 1);
        return { seq: seq, next: seq[seq.length - 1] * 3 - 1, hint: 'Steeds x3 en dan -1.', label: 'x3 -1' };
      },
      function () {
        var start = randInt(12, 35);
        var g = buildArithmetic(start, -randInt(5, 8), 6);
        return { seq: g.seq, next: g.next, hint: 'Het patroon daalt met een vaste, grotere stap.', label: 'dalend (grote stap)' };
      }
    ];

    var pool = round === 1 ? round1Generators : (round === 2 ? mediumGenerators : hardGenerators);
    var picked = null;
    for (var tries = 0; tries < 60; tries++) {
      var make = pool[Math.floor(Math.random() * pool.length)];
      var candidate = make();
      if (candidate && isQuestionValid(candidate.seq, candidate.next)) {
        if (lastPatternLabel !== null && candidate.label === lastPatternLabel) continue;
        picked = candidate;
        break;
      }
    }
    if (!picked) {
      picked = { seq: [2, 4, 6, 8], next: 10, hint: 'Elke stap tel je 2 bij.', label: '+2' };
      if (lastPatternLabel === '+2') {
        picked = { seq: [3, 6, 9, 12], next: 15, hint: 'Elke stap tel je 3 bij.', label: '+3' };
      }
    }
    lastPatternLabel = picked.label;

    var next = picked.next;
    var wrongPool = [
      next - 1, next + 1, next - 2, next + 2,
      Math.max(1, next - 5), next + 5,
      Math.max(1, Math.floor(next / 2)), next * 2, next + 10,
      Math.max(1, next - 10), Math.max(1, Math.floor(next * 0.75))
    ];
    var wrongs = [];
    for (var i = 0; i < wrongPool.length; i++) {
      var candidate = wrongPool[i];
      if (candidate > 0 && candidate <= 999 && candidate !== next && wrongs.indexOf(candidate) === -1) wrongs.push(candidate);
    }

    var options = [next];
    while (options.length < 4 && wrongs.length > 0) {
      var idx = Math.floor(Math.random() * wrongs.length);
      options.push(wrongs.splice(idx, 1)[0]);
    }
    while (options.length < 4) {
      var fallback = next + (Math.floor(Math.random() * 9) - 4);
      if (fallback > 0 && fallback !== next && options.indexOf(fallback) === -1) options.push(fallback);
    }

    return {
      pattern: picked.seq,
      answer: next,
      options: shuffle(options),
      hintText: picked.hint,
      patternLabel: picked.label
    };
  }

  function calculateLiveRoundScore() {
    var base = ROUND_BASE_SCORE[currentRound - 1] || 130;
    var elapsedSec = roundStartTime ? (Date.now() - roundStartTime) / 1000 : 0;
    var timePenalty = Math.floor(elapsedSec * 2);
    var hintPenalty = hintPenaltyThisRound;
    var wrongPenalty = wrongGuessesThisRound * WRONG_PENALTY;
    return Math.max(MIN_ROUND_SCORE, Math.floor(base - timePenalty - hintPenalty - wrongPenalty));
  }

  function updateHud() {
    var elapsedSec = roundStartTime ? Math.floor((Date.now() - roundStartTime) / 1000) : 0;
    window.RegenboogCore.updateHUDTimer(CLASS_ID, elapsedSec, false);
    var liveTotal = answered ? totalScore : totalScore + calculateLiveRoundScore();
    window.RegenboogCore.updateHUDScore(CLASS_ID, liveTotal);
    window.RegenboogCore.updateHUDRound(CLASS_ID, currentRound);
  }

  function startRoundTimer() {
    stopRoundTimer();
    roundStartTime = Date.now();
    timerInterval = setInterval(updateHud, 150);
  }

  function stopRoundTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function setFeedback(message, className) {
    var feedbackEl = document.getElementById('zebras-feedback');
    if (!feedbackEl) return;
    feedbackEl.textContent = message;
    feedbackEl.className = 'zebras-feedback ' + (className || '');
  }

  function disableOptionButtons() {
    area.querySelectorAll('.zebras-option').forEach(function (btn) {
      btn.disabled = true;
    });
  }

  function finishGame() {
    stopRoundTimer();
    area.innerHTML =
      '<p class="game-score">Knap gedaan! Eindscore: ' + totalScore + '</p>' +
      '<p class="zebras-end-note">Je hebt alle patronen van de zebra\'s opgelost.</p>';
    window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
      window.Leaderboard.render(leaderboardEl, CLASS_ID);
    });
  }

  function goToNextRound() {
    if (currentRound >= TOTAL_ROUNDS) {
      finishGame();
      return;
    }
    currentRound++;
    renderRound();
  }

  function useHint() {
    if (answered || hintStageThisRound >= 4) return;
    playHintSound();
    var hintBtn = document.getElementById('zebras-hint-btn');

    if (hintStageThisRound === 0) {
      hintStageThisRound = 1;
      hintPenaltyThisRound += FIRST_HINT_PENALTY;
      setFeedback('Hint 1 (-' + FIRST_HINT_PENALTY + '): ' + currentQuestion.hintText, 'zebras-feedback-hint');
      if (hintBtn) {
        hintBtn.textContent = 'Hint 2 (-' + SECOND_HINT_PENALTY + ')';
      }
      updateHud();
      return;
    }

    var eliminationPenalty = hintStageThisRound === 1
      ? SECOND_HINT_PENALTY
      : (hintStageThisRound === 2 ? THIRD_HINT_PENALTY : FOURTH_HINT_PENALTY);
    var nextHintNumber = hintStageThisRound + 1;

    var wrongButtons = [];
    area.querySelectorAll('.zebras-option').forEach(function (btn) {
      var value = parseInt(btn.dataset.value, 10);
      if (!btn.disabled && value !== currentQuestion.answer) wrongButtons.push(btn);
    });

    if (wrongButtons.length === 0) {
      if (hintBtn) {
        hintBtn.disabled = true;
        hintBtn.textContent = 'Geen hints meer';
      }
      setFeedback('Er zijn geen foute opties meer om weg te halen.', 'zebras-feedback-hint');
      updateHud();
      return;
    }

    hintStageThisRound = nextHintNumber;
    hintPenaltyThisRound += eliminationPenalty;
    var removeBtn = wrongButtons[Math.floor(Math.random() * wrongButtons.length)];
    removeBtn.disabled = true;
    removeBtn.classList.add('zebras-option-disabled');
    removeBtn.textContent = '—';

    setFeedback(
      'Hint ' + nextHintNumber + ' (-' + eliminationPenalty + '): 1 fout antwoord is weggehaald.',
      'zebras-feedback-hint'
    );

    if (hintBtn) {
      if (hintStageThisRound === 2) {
        hintBtn.textContent = 'Hint 3 (-' + THIRD_HINT_PENALTY + ')';
      } else if (hintStageThisRound === 3) {
        hintBtn.textContent = 'Hint 4 (-' + FOURTH_HINT_PENALTY + ')';
      } else {
        hintBtn.disabled = true;
        hintBtn.textContent = 'Geen hints meer';
      }
    }
    updateHud();
  }

  function submitAnswer(value, buttonEl) {
    if (answered) return;
    if (value === currentQuestion.answer) {
      answered = true;
      playCorrectSound();
      buttonEl.classList.add('zebras-option-correct');
      disableOptionButtons();
      stopRoundTimer();
      var roundScore = calculateLiveRoundScore();
      totalScore += roundScore;
      updateHud();

      setFeedback('Goed gezien! +' + roundScore + ' punten', 'zebras-feedback-success');
      var nextBtn = document.getElementById('zebras-next-btn');
      if (nextBtn) {
        if (currentRound >= TOTAL_ROUNDS) {
          nextBtn.style.display = 'none';
          setTimeout(function () { finishGame(); }, 1200);
        } else {
          nextBtn.style.display = 'inline-block';
          nextBtn.textContent = 'Volgende ronde';
        }
      }
      return;
    }

    wrongGuessesThisRound++;
    playWrongSound();
    buttonEl.classList.add('zebras-option-wrong');
    setTimeout(function () {
      buttonEl.classList.remove('zebras-option-wrong');
    }, 360);
    setFeedback('Niet juist, probeer opnieuw. (-' + WRONG_PENALTY + ' bij score)', 'zebras-feedback-error');
    updateHud();
  }

  function attachInputHandlers() {
    area.querySelectorAll('.zebras-option').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        var value = parseInt(btn.dataset.value, 10);
        submitAnswer(value, btn);
      });
    });

    var hintBtn = document.getElementById('zebras-hint-btn');
    if (hintBtn) hintBtn.addEventListener('click', useHint);

    var nextBtn = document.getElementById('zebras-next-btn');
    if (nextBtn) nextBtn.addEventListener('click', goToNextRound);

    document.addEventListener('keydown', onKeydown);
  }

  function onKeydown(e) {
    if (!area.querySelector('.zebras-layout') || answered) return;
    if ((e.key === 'h' || e.key === 'H') && hintStageThisRound < 4) {
      var hintBtn = document.getElementById('zebras-hint-btn');
      if (hintBtn && !hintBtn.disabled) hintBtn.click();
    }
  }

  function renderRound() {
    document.removeEventListener('keydown', onKeydown);
    answered = false;
    hintStageThisRound = 0;
    hintPenaltyThisRound = 0;
    wrongGuessesThisRound = 0;
    currentQuestion = createQuestion(currentRound);

    var hudHtml = window.RegenboogCore.createHUD(CLASS_ID, currentRound, TOTAL_ROUNDS, true, true);
    var sequenceHtml = currentQuestion.pattern.map(function (n) {
      return '<span class="zebras-seq-chip">' + n + '</span>';
    }).join('');

    area.innerHTML =
      hudHtml +
      '<div class="zebras-layout">' +
      '  <div class="zebras-theme-banner">' +
      '    <div class="zebras-theme-badge">' +
      '      <img class="zebras-theme-icon" src="/assets/images/classes/zebras.png" alt="Zebra">' +
      '      <span class="zebras-theme-title">Zebra Safari Patronen</span>' +
      '    </div>' +
      '  </div>' +
      '  <p class="zebras-instruction">Vul het volgende getal in de rij in.</p>' +
      '  <div class="zebras-sequence-wrap">' +
      sequenceHtml +
      '    <span class="zebras-seq-chip zebras-seq-missing">?</span>' +
      '  </div>' +
      '  <div class="zebras-options" id="zebras-options">' +
      currentQuestion.options.map(function (n, idx) {
        return '<button type="button" class="zebras-option" data-value="' + n + '"><span>' + n + '</span></button>';
      }).join('') +
      '  </div>' +
      '  <div class="zebras-actions">' +
      '    <button type="button" class="zebras-hint-btn" id="zebras-hint-btn">Hint 1 (-' + FIRST_HINT_PENALTY + ')</button>' +
      '    <button type="button" class="zebras-next-btn" id="zebras-next-btn" style="display:none;">Volgende ronde</button>' +
      '  </div>' +
      '  <p id="zebras-feedback" class="zebras-feedback">Kies het juiste volgende getal.</p>' +
      '</div>';

    startRoundTimer();
    updateHud();
    attachInputHandlers();
  }

  function showIntro() {
    area.innerHTML =
      '<div style="text-align:center; margin-bottom:1rem;">' +
      '  <h3>Zebra Safari Patronen</h3>' +
      '  <p style="font-size:1.05rem; color:#555; margin-bottom:0.6rem;">Ontdek het patroon en kies het volgende getal.</p>' +
      '  <div style="margin:1rem 0; padding:1rem; background:#f2f2f2; border-radius:8px; display:inline-block; text-align:left;">' +
      '    <p style="margin:0.5rem 0;"><strong>Hoe te spelen:</strong></p>' +
      '    <p style="margin:0.5rem 0;">- Kies het juiste volgende getal</p>' +
      '    <p style="margin:0.5rem 0;">- Gebruik hints als je vastzit (kost punten)</p>' +
      '    <p style="margin:0.5rem 0;">- Speel 3 rondes met moeilijkere patronen</p>' +
      '  </div>' +
      '  <div><button type="button" id="zebras-start" style="padding:1rem 2rem; font-size:1.1rem; background:linear-gradient(135deg, #333, #111); color:white; border:none; border-radius:12px; cursor:pointer; font-weight:700;">Start spel</button></div>' +
      '</div>';
    var startBtn = document.getElementById('zebras-start');
    if (startBtn) {
      startBtn.addEventListener('click', function () {
        currentRound = 1;
        totalScore = 0;
        renderRound();
      });
    }
  }

  showIntro();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
