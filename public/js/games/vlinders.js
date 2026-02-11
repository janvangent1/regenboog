(function () {
  const CLASS_ID = 'vlinders';
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');

  const TOTAL_ROUNDS = 3;
  const WORDS_PER_ROUND = 3;
  let currentRound = 0;
  let currentWordIndex = 0; // Welk woord van de 3 we nu aan het doen zijn (0, 1, of 2)
  let wordsInRound = []; // Array van 3 woorden voor deze ronde
  let totalScore = 0;
  let roundScore = 0; // Score voor deze ronde (som van 3 woorden)
  let score = 0; // Score voor huidige woord
  let currentWord = '';
  let wordLetters = [];
  let availableLetters = [];
  let placedLetters = [];
  let startTime = 0;
  let mistakes = 0;
  let hintsUsed = 0; // Totaal hints gebruikt in hele spel
  let currentWordHintsUsed = 0; // Hints gebruikt voor huidige woord
  let timerInterval = null;
  let butterflyCursor = null;
  let running = false;
  let hintButton = null;

  // Sound functions using Web Audio API
  function playSound(frequency, duration, type = 'sine') {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = type;
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (e) {
      // Silently fail if audio not supported
    }
  }

  function playCorrectSound() {
    playSound(600, 0.2, 'sine');
  }

  function playWrongSound() {
    playSound(200, 0.3, 'sawtooth');
  }

  function playPlaceSound() {
    playSound(400, 0.15, 'sine');
  }

  function playHintSound() {
    playSound(500, 0.2, 'sine');
  }

  function playCompleteSound() {
    // Vrolijke melodie bij compleet woord
    playSound(600, 0.15, 'sine');
    setTimeout(() => playSound(700, 0.15, 'sine'), 100);
    setTimeout(() => playSound(800, 0.2, 'sine'), 200);
  }

  function calculateLiveScore() {
    if (startTime === 0) return 0;
    const elapsed = (Date.now() - startTime) / 1000;
    // Basis score per woord (minder dan per ronde omdat er 3 woorden zijn)
    const baseScore = currentRound === 1 ? 70 : currentRound === 2 ? 100 : 130;
    // Tijdstraffen: hoe langer het duurt, hoe meer punten verlies (exponentieel)
    // Na 10 seconden: -20 punten, na 20 seconden: -60 punten, na 30 seconden: -120 punten
    const timePenalty = Math.floor(elapsed * elapsed * 0.2);
    // Fouten straffen
    const mistakePenalty = mistakes * 15;
    // Hint straffen (per hint: -30 punten) - alleen voor huidige woord
    const hintPenalty = currentWordHintsUsed * 30;
    
    return Math.max(5, Math.floor(baseScore - timePenalty - mistakePenalty - hintPenalty));
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
    timerInterval = setInterval(updateTimerAndScore, 100);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function createButterflyCursor() {
    if (butterflyCursor) {
      butterflyCursor.style.display = 'block';
      return;
    }
    butterflyCursor = document.createElement('div');
    butterflyCursor.id = 'butterfly-cursor';
    butterflyCursor.style.cssText = 
      'position: fixed; width: 90px; height: 90px; pointer-events: none; z-index: 10000; ' +
      'background-image: url("/assets/images/classes/vlinders.png"); ' +
      'background-size: contain; background-repeat: no-repeat; background-position: center; ' +
      'transform: translate(-50%, -50%); will-change: transform; display: none; ' +
      'filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); transition: transform 0.1s ease-out;';
    document.body.appendChild(butterflyCursor);
  }

  function updateButterflyCursor(e) {
    if (!butterflyCursor || !running) return;
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    const rect = area.getBoundingClientRect();
    if (mouseX >= rect.left && mouseX <= rect.right && 
        mouseY >= rect.top && mouseY <= rect.bottom) {
      if (butterflyCursor.style.display !== 'block') {
        butterflyCursor.style.display = 'block';
      }
      requestAnimationFrame(function() {
        if (butterflyCursor) {
          butterflyCursor.style.left = mouseX + 'px';
          butterflyCursor.style.top = mouseY + 'px';
          // Lichte vleugel animatie
          const rotation = Math.sin(Date.now() / 100) * 5;
          butterflyCursor.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
        }
      });
    } else {
      butterflyCursor.style.display = 'none';
    }
  }

  function checkWordComplete() {
    if (placedLetters.length !== wordLetters.length) return false;
    
    const placedWord = placedLetters.map(pl => pl.letter).join('');
    return placedWord === currentWord;
  }

  function resetLetterStyle(letterEl) {
    letterEl.style.opacity = '1';
    letterEl.style.color = '#2a9d8f';
    letterEl.style.backgroundColor = '';
    letterEl.style.borderColor = '#2a9d8f';
    letterEl.style.pointerEvents = 'auto';
    letterEl.style.cursor = 'grab';
  }

  function grayOutLetter(letterEl) {
    letterEl.style.opacity = '0.5';
    letterEl.style.color = '#999';
    letterEl.style.backgroundColor = '#e9ecef';
    letterEl.style.borderColor = '#999';
    letterEl.style.pointerEvents = 'none';
    letterEl.style.cursor = 'not-allowed';
  }

  function useHint() {
    if (!running) return;
    
    // Vind eerste lege slot of verkeerde letter
    let slotIndex = -1;
    let correctLetter = '';
    
    for (let i = 0; i < wordLetters.length; i++) {
      const slot = document.querySelector(`[data-slot-index="${i}"]`);
      if (!slot) continue;
      
      const hasLetter = slot.dataset.hasLetter === 'true';
      const expectedLetter = wordLetters[i];
      
      if (!hasLetter) {
        // Lege slot gevonden
        slotIndex = i;
        correctLetter = expectedLetter;
        break;
      } else {
        // Check if wrong letter
        const placedLetter = placedLetters.find(pl => pl.slotIndex === i);
        if (placedLetter && placedLetter.letter !== expectedLetter) {
          slotIndex = i;
          correctLetter = expectedLetter;
          break;
        }
      }
    }
    
    if (slotIndex === -1) {
      // Alle letters zijn al correct geplaatst
      return;
    }
    
    // Verwijder eventuele verkeerde letter
    const slot = document.querySelector(`[data-slot-index="${slotIndex}"]`);
    if (slot.dataset.hasLetter === 'true') {
      const existingLetterId = slot.dataset.letterId;
      const existingLetterEl = document.getElementById(existingLetterId);
      if (existingLetterEl) {
        resetLetterStyle(existingLetterEl);
      }
      placedLetters = placedLetters.filter(pl => pl.slotIndex !== slotIndex);
    }
    
    // Vind de juiste letter in beschikbare letters
    const correctLetterEl = Array.from(document.querySelectorAll('.vlinders-letter'))
      .find(el => el.dataset.letter === correctLetter && el.style.opacity !== '0.5');
    
    if (!correctLetterEl) {
      // Letter niet beschikbaar (al gebruikt), maak het beschikbaar
      const usedLetterEl = Array.from(document.querySelectorAll('.vlinders-letter'))
        .find(el => el.dataset.letter === correctLetter);
      if (usedLetterEl) {
        resetLetterStyle(usedLetterEl);
      }
    }
    
    // Plaats de juiste letter
    const letterId = correctLetterEl ? correctLetterEl.id : 
      Array.from(document.querySelectorAll('.vlinders-letter'))
        .find(el => el.dataset.letter === correctLetter)?.id;
    
    if (letterId) {
      const letterEl = document.getElementById(letterId);
      if (letterEl) {
        slot.innerHTML = `<div class="vlinders-placed-letter" style="
          font-size: 2.5rem;
          font-weight: 700;
          color: #ffc107;
          text-align: center;
          line-height: 1;
          animation: vlinders-correct 0.3s ease-out;
        ">${correctLetter}</div>`;
        slot.dataset.hasLetter = 'true';
        slot.dataset.letterId = letterId;
        slot.dataset.hintUsed = 'true';
        
        grayOutLetter(letterEl);
        
        placedLetters.push({ letter: correctLetter, slotIndex, letterId, isHint: true });
        
        hintsUsed++;
        currentWordHintsUsed++;
        playHintSound();
        
        // Update progress
        const progressEl = document.getElementById('vlinders-progress');
        const placedCountEl = document.getElementById('vlinders-placed-count');
        if (progressEl && placedCountEl) {
          progressEl.style.display = 'block';
          placedCountEl.textContent = placedLetters.length;
        }
        
        // Update hint button text
        if (hintButton) {
          hintButton.textContent = `Hint (-30 punten) [${hintsUsed}x totaal]`;
        }
        
        // Check if word is complete
        if (checkWordComplete()) {
          setTimeout(() => completeWord(), 500);
        }
      }
    }
  }

  function onLetterDrop(event, slotIndex) {
    event.preventDefault();
    event.stopPropagation();
    
    const letterId = event.dataTransfer.getData('text/plain');
    if (!letterId) return;
    
    const letterEl = document.getElementById(letterId);
    if (!letterEl) return;

    const letter = letterEl.dataset.letter;
    const slot = document.querySelector(`[data-slot-index="${slotIndex}"]`);
    
    if (!slot) return;

    // Check if slot already has a letter
    if (slot.dataset.hasLetter === 'true') {
      // Remove existing letter
      const existingLetterId = slot.dataset.letterId;
      const existingLetterEl = document.getElementById(existingLetterId);
      if (existingLetterEl) {
        resetLetterStyle(existingLetterEl);
      }
      // Remove from placedLetters
      placedLetters = placedLetters.filter(pl => pl.slotIndex !== slotIndex);
      
      // Update progress
      const placedCountEl = document.getElementById('vlinders-placed-count');
      if (placedCountEl) {
        placedCountEl.textContent = placedLetters.length;
      }
    }

    // Place new letter
    const isCorrect = letter === wordLetters[slotIndex];
    const color = isCorrect ? '#2a9d8f' : '#e63946';
    
    slot.innerHTML = `<div class="vlinders-placed-letter" style="
      font-size: 2.5rem;
      font-weight: 700;
      color: ${color};
      text-align: center;
      line-height: 1;
      animation: vlinders-correct 0.3s ease-out;
    ">${letter}</div>`;
    slot.dataset.hasLetter = 'true';
    slot.dataset.letterId = letterId;
    
    // Make dragged letter gray and disabled
    grayOutLetter(letterEl);
    
    // Add to placedLetters
    placedLetters.push({ letter, slotIndex, letterId, isHint: false });
    
    // Update progress
    const progressEl = document.getElementById('vlinders-progress');
    const placedCountEl = document.getElementById('vlinders-placed-count');
    if (progressEl && placedCountEl) {
      progressEl.style.display = 'block';
      placedCountEl.textContent = placedLetters.length;
    }
    
    if (isCorrect) {
      playPlaceSound();
    } else {
      mistakes++;
      playWrongSound();
    }
    
    // Check if word is complete
    if (checkWordComplete()) {
      completeWord();
    }
  }

  function completeWord() {
    stopTimer();
    const elapsed = (Date.now() - startTime) / 1000;
    const wordScore = calculateLiveScore();
    roundScore += wordScore;
    playCompleteSound();
    
    // Show success animation
    document.querySelectorAll('.vlinders-word-slot').forEach(slot => {
      slot.style.animation = 'vlinders-correct 0.5s ease-out';
    });
    
    setTimeout(() => {
      currentWordIndex++;
      
      // Check if we've completed all 3 words in this round
      if (currentWordIndex >= WORDS_PER_ROUND) {
        // All words in this round completed
        totalScore += roundScore;
        
        if (currentRound >= TOTAL_ROUNDS) {
          // Game complete - all 3 rounds done
          if (butterflyCursor) butterflyCursor.style.display = 'none';
          document.removeEventListener('mousemove', updateButterflyCursor);
          area.style.cursor = 'default';
          
          area.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
              <h2 class="game-score" style="font-size: 1.8rem; color: #2a9d8f;">Geweldig! Alle ${TOTAL_ROUNDS * WORDS_PER_ROUND} dieren namen gemaakt!</h2>
              <p style="font-size: 1.5rem; margin: 1rem 0;">Totaal Score: <strong>${totalScore}</strong></p>
              ${hintsUsed > 0 ? `<p style="font-size: 1rem; color: #856404; margin-top: 0.5rem;">Hints gebruikt: ${hintsUsed}</p>` : ''}
            </div>
          `;
          window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
            window.Leaderboard.render(leaderboardEl, CLASS_ID);
          });
        } else {
          // Next round
          area.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
              <h2 class="game-score" style="font-size: 1.5rem; color: #2a9d8f;">Ronde ${currentRound} voltooid!</h2>
              <p style="font-size: 1.2rem; margin: 1rem 0;">Score deze ronde: <strong>${roundScore}</strong></p>
              <p style="font-size: 1.2rem; margin: 1rem 0;">Totaal Score: <strong>${totalScore}</strong></p>
              <p style="font-size: 1rem; color: #666; margin-top: 1rem;">Klaar voor ronde ${currentRound + 1}...</p>
            </div>
          `;
          setTimeout(() => {
            currentRound++;
            currentWordIndex = 0;
            roundScore = 0;
            loadWordsForRound();
          }, 2000);
        }
      } else {
        // Next word in same round
        area.innerHTML = `
          <div style="text-align: center; padding: 2rem;">
            <h2 class="game-score" style="font-size: 1.3rem; color: #2a9d8f;">Goed gedaan! Woord ${currentWordIndex} van ${WORDS_PER_ROUND} voltooid.</h2>
            <p style="font-size: 1rem; margin: 1rem 0;">Score dit woord: <strong>${wordScore}</strong></p>
            <p style="font-size: 1rem; margin: 1rem 0;">Ronde score: <strong>${roundScore}</strong></p>
          </div>
        `;
        setTimeout(() => {
          startNextWord();
        }, 1500);
      }
    }, 1500);
  }

  function loadWordsForRound() {
    // Show loading
    area.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <p style="font-size: 1.2rem;">Dieren laden voor ronde ${currentRound}...</p>
      </div>
    `;
    
    // Fetch 3 words from backend
    fetch(`/api/vlinders/word/${currentRound}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (!data.words || !Array.isArray(data.words) || data.words.length === 0) {
          throw new Error('Ongeldige data ontvangen van server');
        }
        wordsInRound = data.words;
        currentWordIndex = 0;
        roundScore = 0;
        startNextWord();
      })
      .catch(error => {
        console.error('Error loading words:', error);
        area.innerHTML = `
          <div style="text-align: center; padding: 2rem;">
            <p style="font-size: 1.2rem; color: #e63946;">Fout bij laden van dieren. Probeer opnieuw.</p>
            <p style="font-size: 0.9rem; color: #666; margin-top: 0.5rem;">Fout: ${error.message}</p>
            <button onclick="window.location.reload()" style="padding: 0.75rem 1.5rem; margin-top: 1rem; font-size: 1rem; background: #2a9d8f; color: white; border: none; border-radius: 8px; cursor: pointer;">
              Opnieuw proberen
            </button>
          </div>
        `;
      });
  }

  function startNextWord() {
    if (currentWordIndex >= wordsInRound.length) {
      return; // Should not happen, but safety check
    }
    
    const wordData = wordsInRound[currentWordIndex];
    currentWord = wordData.word;
    wordLetters = currentWord.split('');
    availableLetters = wordData.letters;
    
    // Reset voor nieuw woord (maar hintsUsed blijft behouden over alle woorden)
    score = 0;
    mistakes = 0;
    currentWordHintsUsed = 0; // Hints voor dit specifieke woord
    startTime = Date.now();
    placedLetters = [];
    
    startRound();
  }

  function startRound() {
    running = true;
    
    // Create HUD
    const hudHtml = window.RegenboogCore.createHUD(CLASS_ID, currentRound, TOTAL_ROUNDS, true, true);
    
    area.innerHTML = hudHtml + `
      <div style="text-align: center; margin-bottom: 1.5rem;">
        <h2 style="font-size: 1.5rem; color: var(--text); margin-bottom: 0.5rem;">
          Maak de dier naam! (${currentWordIndex + 1}/${WORDS_PER_ROUND})
        </h2>
        <p style="font-size: 1rem; color: #666; margin-bottom: 1rem;">
          Sleep de letters naar de juiste plek om de naam van het dier te maken.
        </p>
        <div style="
          display: inline-block;
          padding: 0.75rem 1.5rem;
          background: linear-gradient(180deg, #fff3cd 0%, #ffe69c 100%);
          border: 2px solid #ffc107;
          border-radius: 12px;
          margin-top: 0.5rem;
        ">
          <p style="font-size: 0.95rem; color: #856404; margin: 0; font-weight: 600;">
            Het dier heeft ${wordLetters.length} letters
          </p>
        </div>
        ${currentWordIndex > 0 ? `
          <div style="margin-top: 0.5rem;">
            <p style="font-size: 0.9rem; color: #2a9d8f;">Ronde score tot nu toe: <strong>${roundScore}</strong></p>
          </div>
        ` : ''}
      </div>
      
      <div class="vlinders-word-display" style="
        display: flex;
        justify-content: center;
        gap: 12px;
        margin-bottom: 2rem;
        flex-wrap: wrap;
      ">
        ${wordLetters.map((letter, index) => `
          <div 
            data-slot-index="${index}"
            data-has-letter="false"
            class="vlinders-word-slot"
            ondrop="window.vlindersOnDrop(event, ${index}); return false;"
            ondragover="event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect='move'; return false;"
            style="
              width: 70px;
              height: 70px;
              border: 3px dashed #81c784;
              border-radius: 12px;
              background: linear-gradient(180deg, #fff 0%, #f1f8e9 100%);
              display: flex;
              align-items: center;
              justify-content: center;
              transition: all 0.2s;
              cursor: pointer;
            "
            onmouseenter="this.style.borderColor='#2a9d8f'; this.style.transform='scale(1.05)';"
            onmouseleave="this.style.borderColor='#81c784'; this.style.transform='scale(1)';"
          >
            <span style="font-size: 1.2rem; color: #999;">_</span>
          </div>
        `).join('')}
      </div>
      
      <div style="text-align: center; margin-bottom: 1rem;">
        <p style="font-size: 1rem; color: #666; margin-bottom: 0.5rem;">
          Beschikbare letters:
        </p>
        <div class="vlinders-letters-container" style="
          display: flex;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
          padding: 1rem;
          background: linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%);
          border-radius: 12px;
          border: 2px solid #dee2e6;
        ">
          ${availableLetters.map((letter, index) => `
            <div
              id="letter-${currentRound}-${index}"
              data-letter="${letter}"
              draggable="true"
              ondragstart="window.vlindersOnDragStart(event)"
              ondragend="window.vlindersOnDragEnd(event)"
              class="vlinders-letter"
              style="
                width: 60px;
                height: 60px;
                border: 3px solid #2a9d8f;
                border-radius: 12px;
                background: linear-gradient(180deg, #fff 0%, #e8f5e9 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 2rem;
                font-weight: 700;
                color: #2a9d8f;
                cursor: grab;
                transition: all 0.2s;
                user-select: none;
              "
              onmouseenter="if(this.style.opacity !== '0.5') { this.style.transform='scale(1.1)'; this.style.boxShadow='0 4px 12px rgba(42,157,143,0.3)'; }"
              onmouseleave="if(this.style.opacity !== '0.5') { this.style.transform='scale(1)'; this.style.boxShadow='none'; }"
            >
              ${letter}
            </div>
          `).join('')}
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 1rem;">
        <button id="vlinders-hint-btn" style="
          padding: 0.75rem 1.5rem;
          font-size: 1rem;
          background: linear-gradient(180deg, #ffc107 0%, #ff9800 100%);
          color: #856404;
          border: 2px solid #ffc107;
          border-radius: 12px;
          cursor: pointer;
          font-weight: 600;
          margin-bottom: 1rem;
          transition: all 0.2s;
        "
        onmouseenter="this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 12px rgba(255,193,7,0.4)';"
        onmouseleave="this.style.transform='scale(1)'; this.style.boxShadow='none';"
        >
          💡 Hint (-30 punten)
        </button>
        <p id="vlinders-hint" style="font-size: 0.9rem; color: #999; font-style: italic; margin-top: 0.5rem;">
          Tip: Sleep een letter naar een vakje om de dier naam te maken. Klik op Hint als je hulp nodig hebt.
        </p>
        <div id="vlinders-progress" style="
          margin-top: 1rem;
          padding: 0.5rem;
          background: #e8f5e9;
          border-radius: 8px;
          display: none;
        ">
          <p style="font-size: 0.9rem; color: #2a9d8f; margin: 0;">
            Geplaatst: <span id="vlinders-placed-count">0</span> / ${wordLetters.length} letters
          </p>
        </div>
      </div>
    `;
    
    area.style.position = 'relative';
    area.style.minHeight = '500px';
    area.style.cursor = 'none';
    
    window.RegenboogCore.updateHUDRound(CLASS_ID, currentRound);
    window.RegenboogCore.updateHUDScore(CLASS_ID, 0);
    
    // Setup hint button
    hintButton = document.getElementById('vlinders-hint-btn');
    if (hintButton) {
      hintButton.addEventListener('click', useHint);
    }
    
    startTimer();
    
    // Setup butterfly cursor
    createButterflyCursor();
    document.addEventListener('mousemove', updateButterflyCursor);
  }

  // Expose functions to window for inline event handlers
  window.vlindersOnDrop = function(event, slotIndex) {
    onLetterDrop(event, slotIndex);
  };

  window.vlindersOnDragStart = function(event) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', event.target.id);
    event.target.style.opacity = '0.5';
  };

  window.vlindersOnDragEnd = function(event) {
    // Only reset if letter is not grayed out (not placed)
    if (event.target.style.opacity !== '0.5') {
      event.target.style.opacity = '1';
    }
  };

  // Add CSS animations
  if (!document.getElementById('vlinders-word-styles')) {
    const style = document.createElement('style');
    style.id = 'vlinders-word-styles';
    style.textContent = `
      @keyframes vlinders-correct {
        0% { transform: scale(1); }
        50% { transform: scale(1.15); }
        100% { transform: scale(1); }
      }
      .vlinders-word-slot[data-has-letter="true"] {
        border-color: #2a9d8f !important;
        border-style: solid !important;
        background: linear-gradient(180deg, #d4edda 0%, #c3e6cb 100%) !important;
      }
      .vlinders-word-slot[data-hint-used="true"] {
        border-color: #ffc107 !important;
        background: linear-gradient(180deg, #fff3cd 0%, #ffe69c 100%) !important;
      }
      .vlinders-letter:active {
        cursor: grabbing !important;
        transform: scale(0.95) !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Initialize
  currentRound = 1;
  currentWordIndex = 0;
  totalScore = 0;
  roundScore = 0;
  wordsInRound = [];
  loadWordsForRound();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
