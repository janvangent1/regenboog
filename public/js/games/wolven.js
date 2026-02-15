(function () {
  const CLASS_ID = 'wolven';
  const TOTAL_ROUNDS = 1;
  const ROUND_DURATION = 180; // 3 minuten in seconden
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  
  let canvas, ctx;
  let wolfPack = []; // Array van {x, y} posities
  let direction = { x: 1, y: 0 }; // Start richting: rechts
  let nextDirection = { x: 1, y: 0 };
  let prey = null;
  let score = 0;
  let currentRound = 0;
  let totalScore = 0;
  let gameRunning = false;
  let animationId = null;
  let startTime = 0;
  let timerInterval = null;
  let gameSpeed = 150; // Milliseconden tussen bewegingen
  let lastMoveTime = 0;
  let roundEndTime = 0;
  
  // Game constants
  const GRID_SIZE = 20; // Aantal cellen per rij/kolom
  const CELL_SIZE = 30; // Pixels per cel
  const PREY_TYPES = [
    { name: 'hog', emoji: '🐗', points: 10, color: '#8B4513' },
    { name: 'deer', emoji: '🦌', points: 15, color: '#DEB887' },
    { name: 'rabbit', emoji: '🐰', points: 5, color: '#F5F5DC' },
    { name: 'bird', emoji: '🐦', points: 8, color: '#87CEEB' }
  ];
  
  const GAME_SPEED = 150; // Bewegingssnelheid
  const PREY_SPAWN_RATE = 2500; // Milliseconden tussen nieuwe prooi spawn
  
  // Wolf head icon wordt nu gebruikt (emoji 🐺)
  
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
  
  function playEatSound() {
    playSound(600, 0.2, 'sine');
  }
  
  function playGameOverSound() {
    playSound(200, 0.3, 'sawtooth');
  }
  
  function playMoveSound() {
    playSound(400, 0.05, 'sine');
  }
  
  function calculateLiveScore() {
    // Score is gebaseerd op lengte van de roedel
    // Elke wolf = 10 punten
    return wolfPack.length * 10;
  }
  
  function calculateFinalScore() {
    // Finale score is lengte van roedel * 10
    return wolfPack.length * 10;
  }
  
  function updateTimerAndScore() {
    if (startTime === 0) return;
    const now = Date.now();
    const elapsed = (now - startTime) / 1000;
    const remaining = Math.max(0, ROUND_DURATION - elapsed);
    
    // Update timer (countdown) - format as M:SS
    const mins = Math.floor(remaining / 60);
    const secs = Math.floor(remaining % 60);
    const timerEl = document.getElementById(CLASS_ID + '-timer');
    if (timerEl) {
      timerEl.textContent = 'Tijd: ' + mins + ':' + (secs < 10 ? '0' : '') + secs;
      if (remaining <= 5) {
        timerEl.style.color = '#e63946';
        timerEl.style.fontWeight = '700';
      } else {
        timerEl.style.color = '#e63946';
        timerEl.style.fontWeight = '600';
      }
    }
    
    // Update score (lengte van roedel)
    const liveScore = calculateLiveScore();
    window.RegenboogCore.updateHUDScore(CLASS_ID, liveScore);
    
    // Check if time is up
    if (remaining <= 0 && gameRunning) {
      completeRound();
    }
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
  
  function init() {
    currentRound = 0;
    totalScore = 0;
    score = 0;
    gameRunning = false;
    wolfPack = [];
    prey = null;
    lastMoveTime = 0;
    
    startRound();
  }
  
  function startRound() {
    currentRound = 1;
    score = 0;
    gameRunning = true;
    gameSpeed = GAME_SPEED;
    lastMoveTime = Date.now();
    startTime = Date.now();
    roundEndTime = startTime + (ROUND_DURATION * 1000);
    
    // Initialize wolf pack (start in het midden, 3 wolven lang)
    wolfPack = [
      { x: Math.floor(GRID_SIZE / 2), y: Math.floor(GRID_SIZE / 2) },
      { x: Math.floor(GRID_SIZE / 2) - 1, y: Math.floor(GRID_SIZE / 2) },
      { x: Math.floor(GRID_SIZE / 2) - 2, y: Math.floor(GRID_SIZE / 2) }
    ];
    
    direction = { x: 1, y: 0 }; // Start richting: rechts
    nextDirection = { x: 1, y: 0 };
    
    const hudHtml = window.RegenboogCore.createHUD(CLASS_ID, currentRound, TOTAL_ROUNDS, true, true);
    area.innerHTML = hudHtml + `
      <canvas id="wolven-canvas" style="border: 2px solid var(--border); border-radius: 12px; background: #2d5016;"></canvas>
      <div class="arrow-pad" id="wolven-arrow-pad">
        <button type="button" class="arrow-pad-btn arrow-pad-btn-up" data-dx="0" data-dy="-1" aria-label="Omhoog">↑</button>
        <button type="button" class="arrow-pad-btn arrow-pad-btn-left" data-dx="-1" data-dy="0" aria-label="Links">←</button>
        <button type="button" class="arrow-pad-btn arrow-pad-btn-down" data-dx="0" data-dy="1" aria-label="Omlaag">↓</button>
        <button type="button" class="arrow-pad-btn arrow-pad-btn-right" data-dx="1" data-dy="0" aria-label="Rechts">→</button>
      </div>
    `;
    
    // Verberg ronde informatie (1/1)
    const roundElement = document.getElementById(CLASS_ID + '-round');
    if (roundElement && roundElement.parentElement) {
      roundElement.parentElement.style.display = 'none';
    }
    
    canvas = document.getElementById('wolven-canvas');
    ctx = canvas.getContext('2d');
    
    // Set canvas size
    const containerWidth = area.offsetWidth - 40;
    const canvasSize = Math.min(600, containerWidth);
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    canvas.style.display = 'block';
    canvas.style.margin = '0 auto';
    canvas.style.width = canvasSize + 'px';
    canvas.style.height = canvasSize + 'px';

    // Lijn HUD netjes uit met het spelgrid.
    const hudEl = document.getElementById(CLASS_ID + '-hud');
    if (hudEl) {
      hudEl.style.maxWidth = canvasSize + 'px';
      hudEl.style.margin = '0 auto 1rem auto';
      hudEl.style.width = '100%';
      hudEl.style.boxSizing = 'border-box';
    }
    
    // Recalculate cell size based on actual canvas size
    const actualCellSize = Math.floor(canvasSize / GRID_SIZE);
    
    // Spawn eerste prooi
    spawnPrey();
    
    // Setup keyboard controls
    document.addEventListener('keydown', handleKeyPress);

    // Pijlknoppen voor touch/tablet (zelfde logica als toetsenbord: geen omkering)
    var arrowPad = document.getElementById('wolven-arrow-pad');
    if (arrowPad) {
      arrowPad.querySelectorAll('.arrow-pad-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (!gameRunning) return;
          var dx = parseInt(btn.getAttribute('data-dx'), 10);
          var dy = parseInt(btn.getAttribute('data-dy'), 10);
          var cur = direction;
          if (dx !== 0 && (cur.x === 0 || (cur.x === 0 && cur.y === 0))) nextDirection = { x: dx, y: 0 };
          if (dy !== 0 && (cur.y === 0 || (cur.x === 0 && cur.y === 0))) nextDirection = { x: 0, y: dy };
        });
      });
    }
    
    // Initialize HUD
    window.RegenboogCore.updateHUDRound(CLASS_ID, 1);
    window.RegenboogCore.updateHUDScore(CLASS_ID, 0);
    
    // Initialize timer display
    const timerEl = document.getElementById(CLASS_ID + '-timer');
    if (timerEl) {
      timerEl.textContent = 'Tijd: 3:00';
    }
    
    // Start timer (dit update ook de timer display)
    startTimer();
    
    // Start game loop
    gameLoop();
  }
  
  function handleKeyPress(e) {
    if (!gameRunning) return;
    
    // Prevent reverse direction (can't go back into yourself)
    // But allow any direction if current direction is (0,0) (after wall collision)
    if (e.key === 'ArrowUp' || e.key === 'Up') {
      e.preventDefault();
      if (direction.y === 0 || (direction.x === 0 && direction.y === 0)) {
        nextDirection = { x: 0, y: -1 };
      }
    } else if (e.key === 'ArrowDown' || e.key === 'Down') {
      e.preventDefault();
      if (direction.y === 0 || (direction.x === 0 && direction.y === 0)) {
        nextDirection = { x: 0, y: 1 };
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'Left') {
      e.preventDefault();
      if (direction.x === 0 || (direction.x === 0 && direction.y === 0)) {
        nextDirection = { x: -1, y: 0 };
      }
    } else if (e.key === 'ArrowRight' || e.key === 'Right') {
      e.preventDefault();
      if (direction.x === 0 || (direction.x === 0 && direction.y === 0)) {
        nextDirection = { x: 1, y: 0 };
      }
    }
  }
  
  function spawnPrey() {
    if (!gameRunning) return;
    
    let newPrey;
    let attempts = 0;
    
    // Find empty cell (not occupied by wolf pack)
    do {
      newPrey = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
        type: PREY_TYPES[Math.floor(Math.random() * PREY_TYPES.length)]
      };
      attempts++;
    } while (isCellOccupied(newPrey.x, newPrey.y) && attempts < 100);
    
    if (attempts < 100) {
      prey = newPrey;
    }
  }
  
  function isCellOccupied(x, y) {
    // Check if cell is occupied by wolf pack
    for (let segment of wolfPack) {
      if (segment.x === x && segment.y === y) {
        return true;
      }
    }
    return false;
  }
  
  function movePack() {
    // Update direction from nextDirection if set
    if (nextDirection.x !== 0 || nextDirection.y !== 0) {
      direction = { ...nextDirection };
    }
    
    // If no direction set, don't move (wait for player input)
    if (direction.x === 0 && direction.y === 0) {
      return;
    }
    
    // Calculate new head position
    const head = wolfPack[0];
    const newHead = {
      x: head.x + direction.x,
      y: head.y + direction.y
    };
    
    // Check wall collision - reset spel met nieuwe lengte (lengte - 3)
    if (newHead.x < 0 || newHead.x >= GRID_SIZE || 
        newHead.y < 0 || newHead.y >= GRID_SIZE) {
      playGameOverSound();
      
      // Bereken nieuwe lengte: huidige lengte - 3, minimum 3 (standaard start lengte)
      const currentLength = wolfPack.length;
      const newLength = Math.max(3, currentLength - 3);
      
      // Reset wolf pack to center with new length
      const centerX = Math.floor(GRID_SIZE / 2);
      const centerY = Math.floor(GRID_SIZE / 2);
      
      // Rebuild pack starting from center, going left (so head is at center)
      wolfPack = [];
      for (let i = 0; i < newLength; i++) {
        wolfPack.push({
          x: centerX - i,
          y: centerY
        });
      }
      
      // Start opnieuw vanuit centrum met een geldige richting
      // zodat het spel meteen verder loopt en niet "vast" lijkt.
      direction = { x: 1, y: 0 };
      nextDirection = { x: 1, y: 0 };
      
      // Spawn new prey (remove old one if exists)
      prey = null;
      setTimeout(() => {
        if (gameRunning) {
          spawnPrey();
        }
      }, 500);
      
      // Continue game loop - skip this move frame, wait for player input
      // Timer blijft gewoon doorgaan (niet resetten)
      return;
    }
    
    // Check self collision
    if (isCellOccupied(newHead.x, newHead.y)) {
      setTimeout(() => gameOver(), 100);
      return;
    }
    
    // Add new head
    wolfPack.unshift(newHead);
    
    // Check if prey was eaten
    if (prey && newHead.x === prey.x && newHead.y === prey.y) {
      // Prey eaten! Don't remove tail (pack grows)
      score += prey.type.points;
      playEatSound();
      
      // Remove eaten prey immediately
      prey = null;
      
      // Spawn new prey after delay
      setTimeout(() => {
        if (gameRunning) {
          spawnPrey();
        }
      }, PREY_SPAWN_RATE);
    } else {
      // Remove tail (pack stays same size)
      wolfPack.pop();
    }
  }
  
  function draw() {
    const cellSize = canvas.width / GRID_SIZE;
    
    // Clear canvas
    ctx.fillStyle = '#2d5016'; // Dark green background
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid lines (subtle)
    ctx.strokeStyle = '#3d6020';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(canvas.width, i * cellSize);
      ctx.stroke();
    }
    
    // Draw prey
    if (prey) {
      const preyX = prey.x * cellSize;
      const preyY = prey.y * cellSize;
      
      // Draw prey background
      ctx.fillStyle = prey.type.color;
      ctx.fillRect(preyX + 2, preyY + 2, cellSize - 4, cellSize - 4);
      
      // Draw prey emoji
      ctx.font = `${cellSize - 4}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(prey.type.emoji, preyX + cellSize / 2, preyY + cellSize / 2);
    }
    
    // Draw wolf pack
    wolfPack.forEach((segment, index) => {
      const x = segment.x * cellSize;
      const y = segment.y * cellSize;
      
      // Head is different - use wolf head emoji/icon
      if (index === 0) {
        // Head (leader wolf) - use wolf emoji
        ctx.fillStyle = '#555';
        ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
        
        // Draw wolf head emoji
        ctx.font = `${cellSize - 4}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🐺', x + cellSize / 2, y + cellSize / 2);
      } else {
        // Body segments (lighter gray)
        ctx.fillStyle = '#777';
        ctx.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
        
        // Simple tail pattern
        if (index === wolfPack.length - 1) {
          ctx.fillStyle = '#999';
          ctx.fillRect(x + cellSize * 0.4, y + cellSize * 0.4, cellSize * 0.2, cellSize * 0.2);
        }
      }
    });
    
    // Roedel status en score zijn nu alleen in de HUD zichtbaar
  }
  
  function gameLoop() {
    if (!gameRunning) return;
    
    const now = Date.now();
    
    // Move pack at game speed
    if (now - lastMoveTime >= gameSpeed) {
      movePack();
      lastMoveTime = now;
    }
    
    draw();
    animationId = requestAnimationFrame(gameLoop);
  }
  
  function gameOver() {
    gameRunning = false;
    stopTimer();
    document.removeEventListener('keydown', handleKeyPress);
    
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    
    playGameOverSound();
    
    const finalScore = calculateLiveScore();
    totalScore += finalScore;
    
    area.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <h2 class="game-score" style="font-size: 1.8rem; color: #e63946;">Game Over!</h2>
        <p style="font-size: 1.5rem; margin: 1rem 0;">Je roedel had ${wolfPack.length} wolven</p>
        <p style="font-size: 1.5rem; margin: 1rem 0;">Score deze ronde: <strong>${finalScore}</strong></p>
        <p style="font-size: 1.2rem; margin: 1rem 0;">Totaal Score: <strong>${totalScore}</strong></p>
        <button id="wolven-retry" style="padding: 0.75rem 1.5rem; margin-top: 1rem; font-size: 1rem; background: #555; color: white; border: none; border-radius: 8px; cursor: pointer;">
          Opnieuw proberen
        </button>
      </div>
    `;
    
    document.getElementById('wolven-retry').addEventListener('click', function() {
      currentRound = 0;
      totalScore = 0;
      init();
    });
    
    window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
      window.Leaderboard.render(leaderboardEl, CLASS_ID);
    });
  }
  
  function completeRound() {
    gameRunning = false;
    stopTimer();
    document.removeEventListener('keydown', handleKeyPress);
    
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    
    const finalScore = calculateFinalScore();
    
    // Play completion sound
    playEatSound();
    setTimeout(() => playSound(700, 0.15, 'sine'), 100);
    setTimeout(() => playSound(800, 0.2, 'sine'), 200);
    
    area.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <h2 class="game-score" style="font-size: 1.8rem; color: #555;">Tijd is om! Spel voorbij!</h2>
        <p style="font-size: 1.5rem; margin: 1rem 0;">Je roedel had <strong>${wolfPack.length}</strong> wolven</p>
        <p style="font-size: 1.5rem; margin: 1rem 0;">Eindscore: <strong>${finalScore}</strong> punten</p>
        <p style="font-size: 1rem; color: #666; margin-top: 0.5rem;">(${wolfPack.length} wolven × 10 punten = ${finalScore} punten)</p>
      </div>
    `;
    
    window.Leaderboard.showSubmitForm(CLASS_ID, finalScore, function () {
      window.Leaderboard.render(leaderboardEl, CLASS_ID);
    });
  }
  
  function startFresh() {
    currentRound = 0;
    totalScore = 0;
    init();
  }

  function showIntro() {
    area.innerHTML =
      '<div style="text-align:center; margin-bottom:1rem;">' +
      '  <h3>Wolven - Roedel Jacht</h3>' +
      '  <p style="font-size:1.05rem; color:#555; margin-bottom:0.6rem;">Stuur de roedel, verzamel prooi en groei zo lang mogelijk.</p>' +
      '  <div style="margin:1rem 0; padding:1rem; background:#eef2f7; border-radius:8px; display:inline-block; text-align:left;">' +
      '    <p style="margin:0.5rem 0;"><strong>Hoe te spelen:</strong></p>' +
      '    <p style="margin:0.5rem 0;">- Beweeg met pijltjestoetsen</p>' +
      '    <p style="margin:0.5rem 0;">- Verzamel prooi om te groeien</p>' +
      '    <p style="margin:0.5rem 0;">- Bots niet tegen muren of je eigen roedel</p>' +
      '  </div>' +
      '  <div><button type="button" id="wolven-start" style="padding:1rem 2rem; font-size:1.1rem; background:linear-gradient(135deg, #4a5568, #2d3748); color:white; border:none; border-radius:12px; cursor:pointer; font-weight:700;">Start spel</button></div>' +
      '</div>';
    var startBtn = document.getElementById('wolven-start');
    if (startBtn) {
      startBtn.addEventListener('click', startFresh);
    }
  }

  showIntro();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
