(function () {
  const CLASS_ID = 'dolfijnen';
  const TOTAL_ROUNDS = 3;
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  
  let canvas, ctx;
  let dolphinY = 0;
  let mouseY = 0;
  let score = 0;
  let currentRound = 0;
  let totalScore = 0;
  let gameRunning = false;
  let animationId = null;
  let obstacles = [];
  let hoops = [];
  let fishes = [];
  let lastSpawnTime = 0;
  let startTime = 0;
  let roundDuration = 30; // seconden
  let dolphinImage = null;
  let scorePopups = []; // Voor punten popups
  
  // Game constants
  const DOLPHIN_WIDTH = 80;
  const DOLPHIN_HEIGHT = 60;
  const DOLPHIN_X = 50;
  const OBSTACLE_WIDTH_BASE = 40;
  const OBSTACLE_HEIGHT_BASE = 40;
  const HOOP_WIDTH = 60;
  const HOOP_HEIGHT = 80;
  const FISH_WIDTH = 30;
  const FISH_HEIGHT = 30;
  const SPEED_BASE = 3;
  const SPEEDS = [3, 5, 7]; // Sneller per ronde - meer verschil tussen rondes
  const OBSTACLE_SIZES = [
    { width: 40, height: 40 }, // Ronde 1
    { width: 50, height: 50 }, // Ronde 2
    { width: 60, height: 60 }  // Ronde 3
  ];
  
  // Load dolphin image
  function loadDolphinImage() {
    dolphinImage = new Image();
    dolphinImage.src = '/assets/images/classes/dolfijnen.png';
    dolphinImage.onerror = function() {
      dolphinImage = null; // Fallback naar getekende dolfijn
    };
  }
  
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
  
  function playHoopSound() {
    playSound(800, 0.2, 'sine');
  }
  
  function playFishSound() {
    playSound(600, 0.15, 'sine');
  }
  
  function playObstacleSound() {
    playSound(200, 0.3, 'sawtooth');
  }
  
  function init() {
    currentRound = 0;
    totalScore = 0;
    score = 0;
    gameRunning = false;
    obstacles = [];
    hoops = [];
    fishes = [];
    lastSpawnTime = 0;
    
    area.innerHTML = `
      <div style="text-align: center; margin-bottom: 1rem;">
        <h3>Ronde ${currentRound + 1}/${TOTAL_ROUNDS}</h3>
        <p>Beweeg je cursor op/neer om de dolfijn te besturen. Zwem door hoepels, eet visjes en vermijd obstakels!</p>
        <div style="margin: 1rem 0;">
          <div style="display: inline-block; margin: 0 1rem;">
            <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #00FF00; border-radius: 50%; margin-right: 0.5rem; vertical-align: middle;"></div>
            Hoepel = +10 punten
          </div>
          <div style="display: inline-block; margin: 0 1rem;">
            <span style="font-size: 2rem;">🐟</span> Vis = +5 punten
          </div>
          <div style="display: inline-block; margin: 0 1rem;">
            <span style="font-size: 2rem;">🪨</span> Obstakel = -20 punten
          </div>
        </div>
        <button id="dolfijnen-start" style="padding: 1rem 2rem; font-size: 1.2rem; background: linear-gradient(135deg, var(--rainbow-4), var(--rainbow-5)); color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: 600;">
          Start Spel
        </button>
      </div>
      <div id="dolfijnen-hud-container" style="display: none; margin-bottom: 0.5rem;"></div>
      <canvas id="dolfijnen-canvas" style="border: 2px solid var(--border); border-radius: 12px; background: linear-gradient(180deg, #87CEEB 0%, #4682B4 100%); display: none; cursor: none;"></canvas>
    `;
    
    document.getElementById('dolfijnen-start').addEventListener('click', startRound);
  }
  
  // Expose startRound to window for onclick handler
  window.dolfijnenStartRound = function() {
    startRound();
  };
  
  function startRound() {
    currentRound++;
    score = 0;
    gameRunning = true;
    obstacles = [];
    hoops = [];
    fishes = [];
    scorePopups = [];
    lastSpawnTime = Date.now();
    startTime = Date.now();
    
    canvas = document.getElementById('dolfijnen-canvas');
    if (!canvas) {
      // Canvas might not exist if we're starting a new round
      const hudHtml = window.RegenboogCore.createHUD(CLASS_ID, currentRound, TOTAL_ROUNDS, false, true);
      area.innerHTML = hudHtml + `
        <canvas id="dolfijnen-canvas" style="border: 2px solid var(--border); border-radius: 12px; background: linear-gradient(180deg, #87CEEB 0%, #4682B4 100%); cursor: none;"></canvas>
      `;
      canvas = document.getElementById('dolfijnen-canvas');
    }
    
    ctx = canvas.getContext('2d');
    
    // Set canvas size
    const containerWidth = area.offsetWidth - 40;
    canvas.width = Math.min(800, containerWidth);
    canvas.height = 500;
    canvas.style.display = 'block';
    canvas.style.width = canvas.width + 'px';
    canvas.style.height = canvas.height + 'px';
    
    const hudContainer = document.getElementById('dolfijnen-hud-container');
    if (hudContainer) {
      hudContainer.innerHTML = window.RegenboogCore.createHUD(CLASS_ID, currentRound, TOTAL_ROUNDS, false, true);
      hudContainer.style.display = 'block';
    } else {
      // Als container niet bestaat, voeg HUD toe voor canvas
      const hudHtml = window.RegenboogCore.createHUD(CLASS_ID, currentRound, TOTAL_ROUNDS, false, true);
      if (canvas && canvas.parentNode) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = hudHtml;
        canvas.parentNode.insertBefore(tempDiv.firstChild, canvas);
      }
    }
    const startBtn = document.getElementById('dolfijnen-start');
    if (startBtn) {
      startBtn.style.display = 'none';
    }
    window.RegenboogCore.updateHUDRound(CLASS_ID, currentRound);
    
    // Initialize dolphin position
    dolphinY = canvas.height / 2;
    mouseY = dolphinY;
    
    // Load dolphin image if not already loaded
    if (!dolphinImage) {
      loadDolphinImage();
    }
    
    // Mouse/touch tracking
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('touchmove', handleTouchMove);
    
    // Start game loop
    gameLoop();
  }
  
  function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouseY = e.clientY - rect.top;
  }
  
  function handleTouchMove(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    mouseY = touch.clientY - rect.top;
  }
  
  function spawnObjects() {
    const now = Date.now();
    const speed = SPEEDS[currentRound - 1] || SPEEDS[0];
    // Moeilijker per ronde: sneller spawnen (minder tijd tussen spawns)
    const spawnIntervals = [1800, 1200, 800]; // Sneller spawnen per ronde
    const spawnInterval = spawnIntervals[currentRound - 1] || spawnIntervals[0];
    
    if (now - lastSpawnTime > spawnInterval) {
      const rand = Math.random();
      const y = Math.random() * (canvas.height - 100) + 50;
      
      // Moeilijker per ronde: meer obstakels, minder hoepels en visjes
      // In ronde 2 en 3: meer obstakels en grotere obstakels
      let hoopChance, fishChance, obstacleChance;
      if (currentRound === 1) {
        hoopChance = 0.4;
        fishChance = 0.35;
        obstacleChance = 0.25;
      } else if (currentRound === 2) {
        hoopChance = 0.3;
        fishChance = 0.25;
        obstacleChance = 0.45; // Meer obstakels
      } else {
        hoopChance = 0.25;
        fishChance = 0.2;
        obstacleChance = 0.55; // Nog meer obstakels
      }
      
      if (rand < hoopChance) {
        // Spawn hoop
        hoops.push({
          x: canvas.width,
          y: y,
          width: HOOP_WIDTH,
          height: HOOP_HEIGHT,
          passed: false
        });
      } else if (rand < hoopChance + fishChance) {
        // Spawn fish
        fishes.push({
          x: canvas.width,
          y: y,
          width: FISH_WIDTH,
          height: FISH_HEIGHT,
          collected: false
        });
      } else {
        // Spawn obstacle - groter per ronde
        const obstacleSize = OBSTACLE_SIZES[currentRound - 1] || OBSTACLE_SIZES[0];
        obstacles.push({
          x: canvas.width,
          y: y,
          width: obstacleSize.width,
          height: obstacleSize.height,
          hit: false
        });
        
        // In ronde 2 en 3: soms 2 obstakels tegelijk spawnen (extra moeilijkheid)
        if (currentRound >= 2 && Math.random() < 0.3) {
          const y2 = Math.random() * (canvas.height - 100) + 50;
          obstacles.push({
            x: canvas.width + 30, // Iets achter het eerste
            y: y2,
            width: obstacleSize.width,
            height: obstacleSize.height,
            hit: false
          });
        }
      }
      
      lastSpawnTime = now;
    }
  }
  
  function updateDolphin() {
    // Smooth movement towards mouse
    const targetY = Math.max(DOLPHIN_HEIGHT / 2, Math.min(canvas.height - DOLPHIN_HEIGHT / 2, mouseY));
    dolphinY += (targetY - dolphinY) * 0.15;
  }
  
  function updateObjects() {
    const speed = SPEEDS[currentRound - 1] || SPEEDS[0];
    
    // Update obstacles
    obstacles.forEach((obs, idx) => {
      obs.x -= speed;
      
      // Check collision
      if (!obs.hit && 
          obs.x < DOLPHIN_X + DOLPHIN_WIDTH &&
          obs.x + obs.width > DOLPHIN_X &&
          obs.y < dolphinY + DOLPHIN_HEIGHT / 2 &&
          obs.y + obs.height > dolphinY - DOLPHIN_HEIGHT / 2) {
        obs.hit = true;
        score = Math.max(0, score - 20);
        updateScore();
        playObstacleSound();
        // Add score popup
        addScorePopup(obs.x + obs.width / 2, obs.y + obs.height / 2, '-20', '#e63946');
      }
    });
    
    // Update hoops
    hoops.forEach((hoop, idx) => {
      hoop.x -= speed;
      
      // Check if passed through
      if (!hoop.passed && hoop.x + hoop.width < DOLPHIN_X) {
        const dolphinCenterY = dolphinY;
        if (dolphinCenterY >= hoop.y && dolphinCenterY <= hoop.y + hoop.height) {
          hoop.passed = true;
          score += 10;
          updateScore();
          playHoopSound();
          // Add score popup at hoop position
          addScorePopup(hoop.x + hoop.width / 2, hoop.y + hoop.height / 2, '+10', '#00FF00');
        }
      }
    });
    
    // Update fishes
    fishes.forEach((fish, idx) => {
      fish.x -= speed;
      
      // Check collection
      if (!fish.collected &&
          fish.x < DOLPHIN_X + DOLPHIN_WIDTH &&
          fish.x + fish.width > DOLPHIN_X &&
          fish.y < dolphinY + DOLPHIN_HEIGHT / 2 &&
          fish.y + fish.height > dolphinY - DOLPHIN_HEIGHT / 2) {
        fish.collected = true;
        score += 5;
        updateScore();
        playFishSound();
        // Add score popup at fish position
        addScorePopup(fish.x + fish.width / 2, fish.y + fish.height / 2, '+5', '#FFD700');
      }
    });
    
    // Remove off-screen objects
    obstacles = obstacles.filter(obs => obs.x + obs.width > 0);
    hoops = hoops.filter(hoop => hoop.x + hoop.width > 0);
    fishes = fishes.filter(fish => fish.x + fish.width > 0);
  }
  
  function updateScore() {
    window.RegenboogCore.updateHUDScore(CLASS_ID, score);
  }
  
  function updateTimer() {
    const elapsed = (Date.now() - startTime) / 1000;
    const remaining = Math.max(0, Math.ceil(roundDuration - elapsed));
    window.RegenboogCore.updateHUDTimer(CLASS_ID, remaining, true);
  }
  
  function addScorePopup(x, y, text, color) {
    scorePopups.push({
      x: x,
      y: y,
      text: text,
      color: color,
      life: 60, // frames
      alpha: 1.0
    });
  }
  
  function updateScorePopups() {
    scorePopups.forEach(popup => {
      popup.life--;
      popup.y -= 2; // Move up
      popup.alpha = popup.life / 60;
    });
    scorePopups = scorePopups.filter(popup => popup.life > 0);
  }
  
  function drawScorePopups() {
    scorePopups.forEach(popup => {
      ctx.save();
      ctx.globalAlpha = popup.alpha;
      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = popup.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.textAlign = 'center';
      ctx.strokeText(popup.text, popup.x, popup.y);
      ctx.fillText(popup.text, popup.x, popup.y);
      ctx.restore();
    });
  }
  
  function checkRoundEnd() {
    const elapsed = (Date.now() - startTime) / 1000;
    
    if (elapsed >= roundDuration) {
      endRound();
    }
  }
  
  function endRound() {
    gameRunning = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    
    totalScore += score;
    
    if (canvas) {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.style.display = 'none';
    }
    
    const hudContainer = document.getElementById('dolfijnen-hud-container');
    if (hudContainer) {
      hudContainer.style.display = 'none';
    }
    
    if (currentRound >= TOTAL_ROUNDS) {
      // Game complete
      area.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
          <h2 class="game-score">Alle rondes voltooid!</h2>
          <p style="font-size: 1.5rem; margin: 1rem 0;">Totaal Score: <strong>${totalScore}</strong></p>
        </div>
      `;
      window.Leaderboard.showSubmitForm(CLASS_ID, totalScore, function () {
        window.Leaderboard.render(leaderboardEl, CLASS_ID);
      });
    } else {
      // Next round - use onclick directly in HTML to avoid scope issues
      area.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
          <h2 class="game-score">Ronde ${currentRound} voltooid!</h2>
          <p style="font-size: 1.2rem; margin: 1rem 0;">Score deze ronde: <strong>${score}</strong></p>
          <p style="font-size: 1.2rem; margin: 1rem 0;">Totaal Score: <strong>${totalScore}</strong></p>
          <button onclick="window.dolfijnenStartRound()" style="padding: 1rem 2rem; font-size: 1.2rem; background: linear-gradient(135deg, var(--rainbow-4), var(--rainbow-5)); color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: 600; margin-top: 1rem;">
            Volgende Ronde
          </button>
        </div>
      `;
    }
  }
  
  function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw water background pattern (optional)
    drawWaterPattern();
    
    // Draw hoops
    hoops.forEach(hoop => {
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(hoop.x + hoop.width / 2, hoop.y + hoop.height / 2, hoop.width / 2, 0, Math.PI * 2);
      ctx.stroke();
    });
    
    // Draw fishes
    fishes.forEach(fish => {
      if (!fish.collected) {
        // Draw fish emoji
        ctx.font = `${FISH_HEIGHT}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🐟', fish.x + fish.width / 2, fish.y + fish.height / 2);
      }
    });
    
    // Draw obstacles
    obstacles.forEach(obs => {
      if (!obs.hit) {
        // Draw rock emoji - gebruik de grootte van het obstakel
        ctx.font = `${obs.height}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🪨', obs.x + obs.width / 2, obs.y + obs.height / 2);
      }
    });
    
    // Draw dolphin
    drawDolphin(DOLPHIN_X, dolphinY - DOLPHIN_HEIGHT / 2);
    
    // Draw score popups
    drawScorePopups();
  }
  
  function drawWaterPattern() {
    // Simple water effect with wavy lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      const y = (canvas.height / 5) * i;
      for (let x = 0; x < canvas.width; x += 10) {
        const waveY = y + Math.sin((x + Date.now() / 50) / 20) * 5;
        if (x === 0) {
          ctx.moveTo(x, waveY);
        } else {
          ctx.lineTo(x, waveY);
        }
      }
      ctx.stroke();
    }
  }
  
  function drawDolphin(x, y) {
    if (dolphinImage && dolphinImage.complete) {
      // Use actual dolphin image
      ctx.drawImage(dolphinImage, x, y, DOLPHIN_WIDTH, DOLPHIN_HEIGHT);
    } else {
      // Fallback: Draw dolphin body (simple shape)
      ctx.fillStyle = '#87CEEB';
      ctx.beginPath();
      ctx.ellipse(x + DOLPHIN_WIDTH / 2, y + DOLPHIN_HEIGHT / 2, DOLPHIN_WIDTH / 2, DOLPHIN_HEIGHT / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw dolphin fin
      ctx.fillStyle = '#4682B4';
      ctx.beginPath();
      ctx.moveTo(x + DOLPHIN_WIDTH / 2, y);
      ctx.lineTo(x + DOLPHIN_WIDTH / 2 - 15, y - 20);
      ctx.lineTo(x + DOLPHIN_WIDTH / 2 + 15, y - 20);
      ctx.closePath();
      ctx.fill();
      
      // Draw dolphin eye
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(x + DOLPHIN_WIDTH / 2 + 10, y + DOLPHIN_HEIGHT / 2 - 5, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw dolphin tail
      ctx.fillStyle = '#4682B4';
      ctx.beginPath();
      ctx.moveTo(x, y + DOLPHIN_HEIGHT / 2);
      ctx.lineTo(x - 20, y + DOLPHIN_HEIGHT / 2 - 15);
      ctx.lineTo(x - 20, y + DOLPHIN_HEIGHT / 2 + 15);
      ctx.closePath();
      ctx.fill();
    }
  }
  
  function gameLoop() {
    if (!gameRunning) return;
    
    updateDolphin();
    spawnObjects();
    updateObjects();
    updateScorePopups();
    updateTimer();
    checkRoundEnd();
    draw();
    
    animationId = requestAnimationFrame(gameLoop);
  }
  
  // Initialize dolphin image loading
  loadDolphinImage();
  
  init();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
