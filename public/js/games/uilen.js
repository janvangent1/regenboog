(function () {
  const CLASS_ID = 'uilen';
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  const TOTAL_ROUNDS = 3;
  const pairs = ['🦉', '🦇', '🐺', '🦊', '🐻', '🐸', '🐱', '🐶', '🦁', '🐯', '🐨', '🦄', '🐷', '🐮', '🐴'];
  
  function getPairsForRound(r) {
    // Ronde 1: 2x3 = 6 kaarten = 3 paren
    // Ronde 2: 4x4 = 16 kaarten = 8 paren
    // Ronde 3: 4x5 = 20 kaarten = 10 paren
    if (r === 1) {
      return pairs.slice(0, 3); // 3 paren voor 2x3 grid
    } else if (r === 2) {
      return pairs.slice(0, 8); // 8 paren voor 4x4 grid
    } else {
      return pairs.slice(0, 10); // 10 paren voor 4x5 grid
    }
  }
  
  function getGridSizeForRound(r) {
    if (r === 1) return { cols: 2, rows: 3, total: 6 }; // 2x3 = 6 kaarten (3 paren)
    if (r === 2) return { cols: 4, rows: 4, total: 16 }; // 4x4 = 16 kaarten (8 paren)
    return { cols: 4, rows: 5, total: 20 }; // 4x5 = 20 kaarten (10 paren)
  }
  
  let cards = [];
  let flipped = [];
  let moves = 0;
  let block = false;
  let currentRound = 1;
  let totalScore = 0;
  let pairsFound = 0;

  function shuffle(a) {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  }

  // Sound functions
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

  function playMatchSound() {
    playSound(600, 0.2, 'sine');
  }

  function playMismatchSound() {
    playSound(200, 0.3, 'sawtooth');
  }

  function calculateLiveScore() {
    const baseScore = currentRound === 1 ? 200 : currentRound === 2 ? 300 : 400;
    // Score: basis minus moves * penalty
    // Dezelfde formule als de eindscore
    const score = Math.max(10, Math.floor(baseScore - moves * 4));
    return score;
  }
  
  function calculateFinalScore() {
    const baseScore = currentRound === 1 ? 200 : currentRound === 2 ? 300 : 400;
    return Math.max(10, Math.floor(baseScore - moves * 4));
  }

  function updateLiveScore() {
    const liveScore = calculateLiveScore();
    window.RegenboogCore.updateHUDScore(CLASS_ID, liveScore);
  }

  function onCardClick(idx) {
    if (block || flipped.length >= 2) return;
    const card = cards[idx];
    if (card.matched || card.el.classList.contains('flipped')) return;
    
    // Flip animation
    card.el.classList.add('flipped');
    card.el.textContent = card.emoji;
    card.el.style.transform = 'rotateY(180deg)';
    card.el.style.background = '#fff'; // Reset background when flipped
    
    flipped.push({ idx, emoji: card.emoji });
    
    if (flipped.length === 2) {
      moves++;
      block = true;
      
      // Update moves display
      const movesEl = document.getElementById('uilen-moves');
      if (movesEl) {
        movesEl.textContent = moves;
      }
      
      // Update live score
      updateLiveScore();
      
      if (flipped[0].emoji === flipped[1].emoji) {
        // Match found!
        playMatchSound();
        cards[flipped[0].idx].matched = true;
        cards[flipped[1].idx].matched = true;
        
        // Success animation
        cards[flipped[0].idx].el.classList.add('uilen-match');
        cards[flipped[1].idx].el.classList.add('uilen-match');
        cards[flipped[0].idx].el.style.animation = 'uilen-success 0.5s ease-out';
        cards[flipped[1].idx].el.style.animation = 'uilen-success 0.5s ease-out';
        cards[flipped[0].idx].el.style.background = '#d4edda'; // Set matched background
        cards[flipped[1].idx].el.style.background = '#d4edda'; // Set matched background
        
        pairsFound++;
        flipped = [];
        block = false;
        
        const used = getPairsForRound(currentRound);
        const gridSize = getGridSizeForRound(currentRound);
        const totalPairsNeeded = Math.floor(gridSize.total / 2);
        
        if (pairsFound >= totalPairsNeeded) {
          // Round complete
          setTimeout(() => {
            const roundScore = calculateFinalScore();
            totalScore += roundScore;
            
            if (currentRound >= TOTAL_ROUNDS) {
              area.innerHTML = '<p class="game-score">Alle ' + TOTAL_ROUNDS + ' rondes! Score: ' + totalScore + '</p>';
              window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
                window.Leaderboard.render(leaderboardEl, CLASS_ID);
              });
            } else {
              currentRound++;
              area.innerHTML =
                '<p class="game-score">Ronde klaar! Score: ' + roundScore + '. Totaal: ' + totalScore + '</p>' +
                '<button type="button" id="uilen-next">Volgende ronde</button>';
              document.getElementById('uilen-next').addEventListener('click', init);
            }
          }, 500);
        }
      } else {
        // Mismatch
        playMismatchSound();
        
        // Shake animation for wrong cards
        cards[flipped[0].idx].el.style.animation = 'uilen-shake 0.5s ease-in-out';
        cards[flipped[1].idx].el.style.animation = 'uilen-shake 0.5s ease-in-out';
        
        setTimeout(function () {
          cards[flipped[0].idx].el.classList.remove('flipped');
          cards[flipped[0].idx].el.textContent = '?';
          cards[flipped[0].idx].el.style.transform = 'rotateY(0deg)';
          cards[flipped[0].idx].el.style.animation = '';
          cards[flipped[0].idx].el.style.background = '#f5f0fa'; // Reset background
          
          cards[flipped[1].idx].el.classList.remove('flipped');
          cards[flipped[1].idx].el.textContent = '?';
          cards[flipped[1].idx].el.style.transform = 'rotateY(0deg)';
          cards[flipped[1].idx].el.style.animation = '';
          cards[flipped[1].idx].el.style.background = '#f5f0fa'; // Reset background
          
          flipped = [];
          block = false;
        }, 1000);
      }
    }
  }

  function init() {
    cards = [];
    flipped = [];
    moves = 0;
    block = false;
    pairsFound = 0;
    
    const used = getPairsForRound(currentRound);
    const gridSize = getGridSizeForRound(currentRound);
    
    // Create pairs - we need gridSize.total cards (always even)
    const totalCards = gridSize.total;
    const pairsNeeded = totalCards / 2; // Always even, so this is always an integer
    
    // Create flat array with pairs
    let flat = [];
    for (let i = 0; i < pairsNeeded; i++) {
      flat.push(used[i], used[i]); // Add pair
    }
    
    // Shuffle
    flat = shuffle(flat);
    
    // Create HUD
    const hudHtml = window.RegenboogCore.createHUD(CLASS_ID, currentRound, TOTAL_ROUNDS, false, true);
    
    area.innerHTML = 
      hudHtml +
      '<p style="font-size: 1.1rem; margin-bottom: 1rem;">Ronde ' + currentRound + '/' + TOTAL_ROUNDS + '. Vind dezelfde nachtdieren. Zetten: <span id="uilen-moves">0</span></p>';
    
    // Initialize score
    updateLiveScore();
    
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(' + gridSize.cols + ', 1fr)';
    grid.style.gap = '8px';
    grid.style.marginTop = '8px';
    grid.className = 'uilen-grid';
    
    flat.forEach(function (emoji, i) {
      const el = document.createElement('button');
      el.type = 'button';
      el.textContent = '?';
      el.style.cssText =
        'min-height:64px;font-size:28px;border:2px solid #6a4c93;border-radius:8px;background:#f5f0fa;cursor:pointer;transition:transform 0.3s ease, background-color 0.2s ease;perspective:1000px;';
      el.style.position = 'relative';
      el.style.transformStyle = 'preserve-3d';
      
      el.addEventListener('mouseenter', function() {
        if (!this.classList.contains('flipped') && !this.classList.contains('uilen-match')) {
          this.style.background = '#e8d5f2';
          this.style.transform = 'scale(1.05) rotateY(0deg)';
        }
      });
      
      el.addEventListener('mouseleave', function() {
        // Only reset if not flipped or matched
        if (!this.classList.contains('flipped') && !this.classList.contains('uilen-match')) {
          this.style.background = '#f5f0fa';
          this.style.transform = 'rotateY(0deg)';
        }
      });
      
      el.addEventListener('click', function () {
        onCardClick(i);
      });
      
      grid.appendChild(el);
      cards.push({ el, emoji, matched: false });
    });
    
    area.appendChild(grid);
    
    // Update moves display
    const movesEl = document.getElementById('uilen-moves');
    if (movesEl) {
      movesEl.textContent = moves;
    }
  }

  init();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
