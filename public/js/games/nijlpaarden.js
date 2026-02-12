(function () {
  const CLASS_ID = 'nijlpaarden';
  const TOTAL_ROUNDS = 3;
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  let round = 0;
  let correct = 0;
  let totalScore = 0;
  let startTime = 0;
  let mistakes = 0;
  let timerInterval = null;

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
        gain.gain.setValueAtTime(volume || 0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
      }
      if (ctx.state === 'suspended') ctx.resume().then(run).catch(function () {});
      else run();
    } catch (e) {}
  }

  function playCorrectSound() { playSound(660, 0.12, 'sine', 0.055); }
  function playWrongSound() { playSound(210, 0.16, 'sawtooth', 0.065); }

  // Verschillende soorten voedsel
  const FOOD_TYPES = {
    plant: { emoji: '🌿', name: 'waterplanten' },
    fruit: { emoji: '🍎', name: 'appels' },
    vegetable: { emoji: '🥕', name: 'wortels' },
    berry: { emoji: '🫐', name: 'bessen' }
  };

  function calculateLiveScore() {
    if (startTime === 0) return 0;
    const elapsed = (Date.now() - startTime) / 1000; // seconden
    // Score: basis per ronde (200/300/400), minus tijd * 5, minus fouten * 20
    // Hoe sneller en zonder fouten = hogere score
    const baseScore = round === 1 ? 200 : round === 2 ? 300 : 400;
    return Math.max(10, Math.floor(baseScore - elapsed * 5 - mistakes * 20));
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins + ':' + (secs < 10 ? '0' : '') + secs;
  }

  function updateTimerAndScore() {
    if (startTime === 0) return;
    const elapsed = (Date.now() - startTime) / 1000;
    window.RegenboogCore.updateHUDTimer(CLASS_ID, elapsed, false);
    const liveScore = calculateLiveScore();
    window.RegenboogCore.updateHUDScore(CLASS_ID, liveScore);
  }

  function startTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    timerInterval = setInterval(updateTimerAndScore, 100); // Update elke 100ms
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function newRound() {
    round++;
    startTime = Date.now();
    mistakes = 0;
    stopTimer();
    
    let count = 0;
    let items = [];
    let question = '';
    let options = [];

    if (round === 1) {
      // Ronde 1: Eenvoudig - alleen waterplanten, kleine aantallen
      const minCount = 2;
      const maxCount = 5;
      count = minCount + Math.floor(Math.random() * (maxCount - minCount + 1));
      items = Array(count).fill(FOOD_TYPES.plant);
      question = 'Hoeveel waterplanten zie je?';
      
      // Genereer opties: correct antwoord + 2 foute antwoorden
      options = [count];
      while (options.length < 3) {
        const n = minCount + Math.floor(Math.random() * (maxCount - minCount + 1));
        if (options.indexOf(n) === -1) options.push(n);
      }
    } else if (round === 2) {
      // Ronde 2: Meerdere soorten - waterplanten + fruit, grotere aantallen
      const plantCount = 3 + Math.floor(Math.random() * 4); // 3-6
      const fruitCount = 2 + Math.floor(Math.random() * 4); // 2-5
      count = plantCount + fruitCount; // Totaal 5-11
      
      items = [
        ...Array(plantCount).fill(FOOD_TYPES.plant),
        ...Array(fruitCount).fill(FOOD_TYPES.fruit)
      ];
      // Shuffle items voor random volgorde
      items.sort(() => Math.random() - 0.5);
      
      question = 'Hoeveel waterplanten en appels samen zie je?';
      
      // Genereer opties rond het juiste antwoord
      options = [count];
      const wrong1 = count + (Math.random() < 0.5 ? -2 : 2);
      const wrong2 = count + (Math.random() < 0.5 ? -1 : 1);
      if (wrong1 >= 5 && wrong1 <= 12 && wrong1 !== count) options.push(wrong1);
      if (wrong2 >= 5 && wrong2 <= 12 && wrong2 !== count && options.indexOf(wrong2) === -1) options.push(wrong2);
      while (options.length < 3) {
        const n = 5 + Math.floor(Math.random() * 8);
        if (options.indexOf(n) === -1) options.push(n);
      }
    } else {
      // Ronde 3: 3 soorten worden getoond, maar alleen 2 soorten moeten geteld worden
      const plantCount = 4 + Math.floor(Math.random() * 5); // 4-8
      const fruitCount = 3 + Math.floor(Math.random() * 4); // 3-6
      const vegCount = 3 + Math.floor(Math.random() * 4); // 3-6
      
      // Alle 3 soorten worden getoond
      items = [
        ...Array(plantCount).fill(FOOD_TYPES.plant),
        ...Array(fruitCount).fill(FOOD_TYPES.fruit),
        ...Array(vegCount).fill(FOOD_TYPES.vegetable)
      ];
      // Shuffle items voor random volgorde
      items.sort(() => Math.random() - 0.5);
      
      // Kies willekeurig welke 2 soorten geteld moeten worden
      const typesToCount = [
        ['plant', 'fruit'],
        ['plant', 'vegetable'],
        ['fruit', 'vegetable']
      ];
      const selectedTypes = typesToCount[Math.floor(Math.random() * typesToCount.length)];
      
      // Bereken count alleen voor de 2 geselecteerde soorten
      if (selectedTypes.includes('plant') && selectedTypes.includes('fruit')) {
        count = plantCount + fruitCount; // 7-14
        question = 'Hoeveel waterplanten en appels samen zie je?';
      } else if (selectedTypes.includes('plant') && selectedTypes.includes('vegetable')) {
        count = plantCount + vegCount; // 7-14
        question = 'Hoeveel waterplanten en wortels samen zie je?';
      } else {
        count = fruitCount + vegCount; // 6-12
        question = 'Hoeveel appels en wortels samen zie je?';
      }
      
      // Genereer opties rond het juiste antwoord
      options = [count];
      const wrong1 = count + (Math.random() < 0.5 ? -3 : 3);
      const wrong2 = count + (Math.random() < 0.5 ? -2 : 2);
      // Foute opties kunnen ook het totaal van alle 3 soorten zijn (om het moeilijker te maken)
      const totalAll = plantCount + fruitCount + vegCount;
      if (totalAll !== count && totalAll >= 10 && totalAll <= 20) {
        options.push(totalAll);
      }
      if (wrong1 >= 6 && wrong1 <= 16 && wrong1 !== count && options.indexOf(wrong1) === -1) options.push(wrong1);
      if (wrong2 >= 6 && wrong2 <= 16 && wrong2 !== count && options.indexOf(wrong2) === -1) options.push(wrong2);
      while (options.length < 3) {
        const n = 6 + Math.floor(Math.random() * 11);
        if (options.indexOf(n) === -1) options.push(n);
      }
    }

    // Shuffle opties
    options.sort(() => Math.random() - 0.5);

    // Toon items in een grid layout
    const itemsHtml = items.map((item, idx) => {
      const size = round === 1 ? '48px' : round === 2 ? '42px' : '36px';
      return `<span style="font-size: ${size}; display: inline-block; margin: 4px;">${item.emoji}</span>`;
    }).join('');

    // Gebruik consistente HUD layout (timer verborgen)
    const hudHtml = window.RegenboogCore.createHUD(CLASS_ID, round, TOTAL_ROUNDS, false, true);

    area.innerHTML =
      hudHtml +
      '<p style="font-size: 1.1rem; margin-bottom: 1rem;">' + question + '</p>' +
      '<div style="font-size: 36px; margin: 20px 0; padding: 20px; background: #f0f8f0; border-radius: 12px; border: 2px solid #2a9d8f; min-height: 120px; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px;">' +
      itemsHtml +
      '</div>' +
      '<div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-top: 1.5rem;">' +
      options
        .map(
          (n) =>
            '<button type="button" data-n="' +
            n +
            '" style="padding: 16px 32px; font-size: 1.5rem; font-weight: 600; border-radius: 12px; border: 3px solid #2a9d8f; background: white; color: #2a9d8f; cursor: pointer; transition: all 0.2s; min-width: 80px;">' +
            n +
            '</button>'
        )
        .join('') +
      '</div>';

    // Initialize timer
    startTimer();
    window.RegenboogCore.updateHUDRound(CLASS_ID, round);

    // Add hover effects
    area.querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('mouseenter', function() {
        this.style.background = '#2a9d8f';
        this.style.color = 'white';
        this.style.transform = 'scale(1.05)';
      });
      btn.addEventListener('mouseleave', function() {
        this.style.background = 'white';
        this.style.color = '#2a9d8f';
        this.style.transform = 'scale(1)';
      });
      btn.addEventListener('click', function () {
        const n = parseInt(btn.dataset.n, 10);
        
        if (n === count) {
          playCorrectSound();
          stopTimer();
          updateTimerAndScore(); // Final update
          correct++;
          // Score per ronde: tijd-gebaseerd
          const elapsed = (Date.now() - startTime) / 1000; // seconden
          // Basis score per ronde: ronde 1 = 200, ronde 2 = 300, ronde 3 = 400
          // Minus tijd * 5, minus fouten * 20
          const baseScore = round === 1 ? 200 : round === 2 ? 300 : 400;
          const roundScore = Math.max(10, Math.floor(baseScore - elapsed * 5 - mistakes * 20));
          totalScore += roundScore;
          
          if (round >= TOTAL_ROUNDS) {
            area.innerHTML = 
              '<div style="text-align: center; padding: 2rem;">' +
              '<h2 class="game-score">Alle rondes voltooid!</h2>' +
              '<p style="font-size: 1.5rem; margin: 1rem 0;">Je had alle ' + TOTAL_ROUNDS + ' rondes goed!</p>' +
              '<p style="font-size: 1.5rem; margin: 1rem 0;">Totaal Score: <strong>' + totalScore + '</strong></p>' +
              '</div>';
            window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
              window.Leaderboard.render(leaderboardEl, CLASS_ID);
            });
          } else {
            // Toon tussenresultaat
            area.innerHTML = 
              '<div style="text-align: center; padding: 2rem;">' +
              '<h2 class="game-score">Goed gedaan!</h2>' +
              '<p style="font-size: 1.2rem; margin: 1rem 0;">Ronde ' + round + ' voltooid. Score: ' + roundScore + '</p>' +
              '<p style="font-size: 1.2rem; margin: 1rem 0;">Totaal Score: ' + totalScore + '</p>' +
              '<button id="nijlpaarden-next" style="padding: 1rem 2rem; font-size: 1.2rem; background: linear-gradient(135deg, var(--rainbow-4), var(--rainbow-5)); color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: 600; margin-top: 1rem;">' +
              'Volgende Ronde' +
              '</button>' +
              '</div>';
            
            setTimeout(() => {
              const nextBtn = document.getElementById('nijlpaarden-next');
              if (nextBtn) {
                nextBtn.addEventListener('click', newRound);
              }
            }, 100);
          }
        } else {
          // Fout antwoord
          playWrongSound();
          mistakes++;
          updateTimerAndScore(); // Update score na fout (timer blijft lopen)
          // Wacht even zodat speler de score update ziet, dan stop timer en toon resultaat
          setTimeout(() => {
            stopTimer();
            const elapsed = (Date.now() - startTime) / 1000;
            // Bereken score tot nu toe (ook tijd-gebaseerd)
            const baseScore = round === 1 ? 200 : round === 2 ? 300 : 400;
            const roundScore = Math.max(0, Math.floor(baseScore - elapsed * 5 - mistakes * 20));
            const score = totalScore + roundScore;
            area.innerHTML =
              '<div style="text-align: center; padding: 2rem;">' +
              '<h2 class="game-score">Fout antwoord</h2>' +
              '<p style="font-size: 1.2rem; margin: 1rem 0;">Het juiste antwoord was: <strong>' + count + '</strong></p>' +
              '<p style="font-size: 1.2rem; margin: 1rem 0;">Je had ' + correct + ' van ' + round + ' rondes goed.</p>' +
              '<p style="font-size: 1.2rem; margin: 1rem 0;">Score: <strong>' + score + '</strong></p>' +
              '</div>';
            window.Leaderboard.showSubmitForm(CLASS_ID, score, function () {
              window.Leaderboard.render(leaderboardEl, CLASS_ID);
            });
          }, 500); // Korte delay om score update te zien
        }
      });
    });
  }

  function startFresh() {
    stopTimer();
    round = 0;
    correct = 0;
    totalScore = 0;
    mistakes = 0;
    startTime = 0;
    newRound();
  }

  function showIntro() {
    area.innerHTML =
      '<div style="text-align:center; margin-bottom:1rem;">' +
      '  <h3>Nijlpaarden - Tel de Dieren</h3>' +
      '  <p style="font-size:1.05rem; color:#555; margin-bottom:0.6rem;">Kijk goed en kies hoeveel nijlpaarden je ziet.</p>' +
      '  <div style="margin:1rem 0; padding:1rem; background:#eef3f8; border-radius:8px; display:inline-block; text-align:left;">' +
      '    <p style="margin:0.5rem 0;"><strong>Hoe te spelen:</strong></p>' +
      '    <p style="margin:0.5rem 0;">- Tel de nijlpaarden op het scherm</p>' +
      '    <p style="margin:0.5rem 0;">- Kies het juiste aantal</p>' +
      '    <p style="margin:0.5rem 0;">- Sneller en minder fouten geeft meer punten</p>' +
      '  </div>' +
      '  <div><button type="button" id="nijlpaarden-start" style="padding:1rem 2rem; font-size:1.1rem; background:linear-gradient(135deg, #4a5568, #2d3748); color:white; border:none; border-radius:12px; cursor:pointer; font-weight:700;">Start spel</button></div>' +
      '</div>';
    var startBtn = document.getElementById('nijlpaarden-start');
    if (startBtn) {
      startBtn.addEventListener('click', startFresh);
    }
  }

  showIntro();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
