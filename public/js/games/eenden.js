(function () {
  const CLASS_ID = 'eenden';
  const TOTAL_ROUNDS = 3;
  const ITEMS_PER_COLOR = [2, 3, 4];
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  const colors = ['rood', 'blauw', 'geel', 'groen'];
  const colorHex = { rood: '#e63946', blauw: '#457b9d', geel: '#e9c46a', groen: '#2a9d8f' };
  let items = [];
  let score = 0;
  let total = 0;
  let currentRound = 0;
  let totalScore = 0;
  let startTime = 0;
  let mistakes = 0;
  let shuffleInterval = null;
  let dropZones = [];
  let timerInterval = null;

  function shuffleArray(array) {
    const shuffled = array.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function calculateLiveScore() {
    if (startTime === 0) return 0;
    const elapsed = (Date.now() - startTime) / 1000; // seconden
    return Math.max(10, Math.floor(500 - elapsed * 5 - mistakes * 20));
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
    timerInterval = setInterval(updateTimerAndScore, 100); // Update elke 100ms voor vloeiende timer
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function shuffleDuckPositions() {
    if (currentRound < 1 || !dropZones.length) return; // Alleen in ronde 2 en 3
    const parent = dropZones[0].parentNode;
    if (!parent) return;
    
    // Stap 1: Wobble animatie vlak voor het wisselen (waarschuwing)
    dropZones.forEach(zone => {
      zone.classList.add('eenden-shuffling');
    });
    
    // Stap 2: Na wobble, fade-out animatie
    setTimeout(() => {
      dropZones.forEach(zone => {
        zone.classList.remove('eenden-shuffling');
        zone.classList.add('eenden-fade-out');
      });
      
      // Stap 3: Na fade-out, shuffle en fade-in
      setTimeout(() => {
        // Shuffle de dropZones array
        const shuffled = shuffleArray(dropZones.slice());
        
        // Herordenen door elementen één voor één te verplaatsen met insertBefore
        shuffled.forEach((zone, index) => {
          zone.classList.remove('eenden-fade-out');
          zone.classList.add('eenden-fade-in');
          
          // Verwijder zone uit huidige positie als die er is
          if (zone.parentNode === parent) {
            parent.removeChild(zone);
          }
          
          // Voeg zone toe op de nieuwe positie
          if (index === 0) {
            // Eerste element: voeg toe aan het begin
            parent.insertBefore(zone, parent.firstChild);
          } else {
            // Andere elementen: voeg toe na het vorige element
            const prevZone = shuffled[index - 1];
            if (prevZone && prevZone.parentNode === parent) {
              parent.insertBefore(zone, prevZone.nextSibling);
            } else {
              parent.appendChild(zone);
            }
          }
        });
        
        // Update de dropZones array naar nieuwe volgorde
        dropZones = shuffled;
        
        // Stap 4: Verwijder fade-in class na animatie
        setTimeout(() => {
          dropZones.forEach(zone => {
            zone.classList.remove('eenden-fade-in');
          });
        }, 300);
      }, 300); // Wacht tot fade-out klaar is
    }, 500); // Wacht tot wobble klaar is
  }

  function init() {
    startTime = Date.now();
    mistakes = 0;
    if (shuffleInterval) {
      clearInterval(shuffleInterval);
      shuffleInterval = null;
    }
    stopTimer();
    
    var perColor = ITEMS_PER_COLOR[currentRound];
    var instruction = currentRound >= 1 
      ? 'Ronde ' + (currentRound + 1) + '/' + TOTAL_ROUNDS + '. Sleep elk voorwerp naar de eend met dezelfde kleur. De eenden verschuiven!'
      : 'Ronde ' + (currentRound + 1) + '/' + TOTAL_ROUNDS + '. Sleep elk voorwerp naar de eend met dezelfde kleur.';
    area.innerHTML = '<p>' + instruction + '</p>';
    
    // Gebruik consistente HUD layout (timer verborgen)
    const hudHtml = window.RegenboogCore.createHUD(CLASS_ID, currentRound + 1, TOTAL_ROUNDS, false, true);
    area.innerHTML = hudHtml + area.innerHTML;
    
    startTimer();
    window.RegenboogCore.updateHUDRound(CLASS_ID, currentRound + 1);
    
    const dropZone = document.createElement('div');
    dropZone.style.display = 'flex';
    dropZone.style.flexWrap = 'wrap';
    dropZone.style.gap = '12px';
    dropZone.style.marginTop = '12px';
    dropZone.id = 'eenden-drop-zone'; // ID toevoegen voor debugging
    dropZones = [];
    
    // Shuffle de kleuren voor random volgorde
    const shuffledColors = shuffleArray(colors.slice());
    
    shuffledColors.forEach(function (c, idx) {
      const zone = document.createElement('div');
      zone.dataset.color = c;
      zone.style.cssText =
        'min-width:100px;min-height:80px;border:3px dashed ' +
        colorHex[c] +
        ';border-radius:12px;padding:8px;text-align:center;transition:transform 0.3s ease;';
      // Geen order property bij init - we gebruiken alleen DOM volgorde
      zone.innerHTML = '<span style="font-size:40px">🦆</span><br><span style="color:' + colorHex[c] + '">' + c + '</span>';
      zone.ondragover = function (e) {
        e.preventDefault();
        zone.style.background = '#f0f0f0';
      };
      zone.ondragleave = function () {
        zone.style.background = '';
      };
      zone.ondrop = function (e) {
        e.preventDefault();
        zone.style.background = '';
        const id = e.dataTransfer.getData('text');
        const item = items.find((x) => x.id === id);
        if (item && item.color === c) {
          item.el.remove();
          score++;
          document.getElementById('eenden-score').textContent = 'Goed: ' + score + ' / ' + total;
          updateTimerAndScore(); // Update score na goede actie
          if (score === total) {
            stopTimer();
            const elapsed = (Date.now() - startTime) / 1000; // seconden
            // Score: basis van 500, minus tijd (max 60 sec), minus fouten * 20
            // Hoe sneller en zonder fouten = hogere score
            var roundScore = Math.max(10, Math.floor(500 - elapsed * 5 - mistakes * 20));
            totalScore += roundScore;
            if (currentRound + 1 >= TOTAL_ROUNDS) {
              area.innerHTML = '<p class="game-score">Alle ' + TOTAL_ROUNDS + ' rondes goed! Score: ' + totalScore + '</p>';
              window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
                window.Leaderboard.render(leaderboardEl, CLASS_ID);
              });
            } else {
              currentRound++;
              area.innerHTML =
                '<p class="game-score">Ronde klaar! Score: ' + roundScore + '. Totaal: ' + totalScore + '</p>' +
                '<button type="button" id="eenden-next">Volgende ronde</button>';
              document.getElementById('eenden-next').addEventListener('click', init);
            }
            if (shuffleInterval) {
              clearInterval(shuffleInterval);
              shuffleInterval = null;
            }
          }
        } else {
          // Fout antwoord - straf
          mistakes++;
          updateTimerAndScore(); // Update score na fout
          zone.style.animation = 'shake 0.3s';
          setTimeout(function() {
            zone.style.animation = '';
          }, 300);
        }
      };
      dropZone.appendChild(zone);
      dropZones.push(zone);
    });
    area.appendChild(dropZone);
    
    // In ronde 2 en 3: laat eenden elke 3-4 seconden verschuiven
    if (currentRound >= 1) {
      shuffleInterval = setInterval(shuffleDuckPositions, 3000 + Math.random() * 1000);
    }
    const scoreEl = document.createElement('div');
    scoreEl.id = 'eenden-score';
    scoreEl.className = 'game-score';
    scoreEl.textContent = 'Goed: 0 / 0';
    area.appendChild(scoreEl);
    const itemBox = document.createElement('div');
    itemBox.style.display = 'flex';
    itemBox.style.flexWrap = 'wrap';
    itemBox.style.gap = '8px';
    itemBox.style.marginTop = '12px';
    items = [];
    score = 0;
    total = colors.length * perColor;
    
    // Maak alle items eerst
    const allItems = [];
    colors.forEach(function (c) {
      for (let i = 0; i < perColor; i++) {
        const id = c + '-' + i;
        allItems.push({ id, color: c });
      }
    });
    
    // Shuffle de items voor random volgorde
    const shuffledItems = shuffleArray(allItems);
    
    shuffledItems.forEach(function (itemData) {
      const el = document.createElement('div');
      el.draggable = true;
      el.dataset.color = itemData.color;
      el.style.cssText =
        'width:50px;height:50px;border-radius:50%;background:' +
        colorHex[itemData.color] +
        ';cursor:grab;';
      el.id = itemData.id;
      el.ondragstart = function (e) {
        e.dataTransfer.setData('text', itemData.id);
      };
      itemBox.appendChild(el);
      items.push({ id: itemData.id, color: itemData.color, el });
    });
    area.appendChild(itemBox);
  }

  init();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
