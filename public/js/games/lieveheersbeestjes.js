(function () {
  const CLASS_ID = 'lieveheersbeestjes';
  const TOTAL_ROUNDS = 3;
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  
  let canvas, ctx;
  let ladybugX = 0;
  let mouseX = 0;
  let score = 0;
  let currentRound = 0;
  let totalScore = 0;
  let gameRunning = false;
  let animationId = null;
  let obstacles = [];
  let flowers = [];
  let lastSpawnTime = 0;
  let startTime = 0;
  let roundDuration = 30; // seconden
  let ladybugImage = null;
  let butterflyImage = null;
  let owlImage = null;
  let mouseImage = null;
  let scorePopups = [];
  
  // Game constants - VERTICAAL SPEL (Space Invaders stijl)
  const LADYBUG_WIDTH = 60;
  const LADYBUG_HEIGHT = 50;
  const LADYBUG_Y = 0; // Vaste Y positie onderaan (wordt berekend)
  const OBSTACLE_WIDTH_BASE = 50;
  const OBSTACLE_HEIGHT_BASE = 50;
  const FLOWER_WIDTH = 40;
  const FLOWER_HEIGHT = 40;
  const SPEEDS = [2, 4, 6]; // Sneller per ronde - meer verschil zoals bij dolfijnen
  const OBSTACLE_SIZES = [
    { width: 50, height: 50 }, // Ronde 1
    { width: 60, height: 60 }, // Ronde 2 - groter (voor uilen en muizen)
    { width: 70, height: 70 }  // Ronde 3 - nog groter (voor uilen en muizen)
  ];
  const SPAWN_INTERVALS = [1800, 1200, 800]; // Sneller spawnen per ronde (zoals dolfijnen)
  const OBSTACLE_CHANCES = [0.25, 0.45, 0.55]; // Meer obstakels per ronde (zoals dolfijnen)
  
  let flowerImage = null;
  
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
  
  function playFlowerSound() {
    playSound(600, 0.15, 'sine'); // Zelfde als vis geluid bij dolfijnen
  }
  
  function playObstacleSound() {
    playSound(200, 0.3, 'sawtooth'); // Zelfde als obstakel geluid bij dolfijnen
  }
  
  // Load images
  function loadImages() {
    ladybugImage = new Image();
    ladybugImage.src = '/assets/images/classes/lieveheersbeestjes.png';
    ladybugImage.onerror = function() {
      ladybugImage = null;
    };
    
    butterflyImage = new Image();
    butterflyImage.src = '/assets/images/classes/vlinders.png';
    butterflyImage.onerror = function() {
      butterflyImage = null;
    };
    
    owlImage = new Image();
    owlImage.src = '/assets/images/classes/uilen.png';
    owlImage.onerror = function() {
      owlImage = null;
    };
    
    mouseImage = new Image();
    mouseImage.src = '/assets/images/classes/muizen.png';
    mouseImage.onerror = function() {
      mouseImage = null;
    };
    
    // Load flower image - gebruik een bloem emoji als fallback, maar probeer eerst een afbeelding
    // Voor nu gebruiken we emoji, maar we kunnen later een bloem afbeelding toevoegen
    flowerImage = null; // We gebruiken emoji voor bloemen
  }
  
  function init() {
    currentRound = 0;
    totalScore = 0;
    score = 0;
    gameRunning = false;
    obstacles = [];
    flowers = [];
    lastSpawnTime = 0;
    scorePopups = [];
    
    loadImages();
    startRound();
  }
  
  function startRound() {
    currentRound++;
    score = 0;
    gameRunning = true;
    obstacles = [];
    flowers = [];
    lastSpawnTime = Date.now();
    startTime = Date.now();
    scorePopups = [];
    
    // Set round duration
    roundDuration = 30;
    
    // Create HUD and canvas - vervang alles
    const hudHtml = window.RegenboogCore.createHUD(CLASS_ID, currentRound, TOTAL_ROUNDS, false, true);
    area.innerHTML = hudHtml + `
      <canvas id="lieveheersbeestjes-canvas" style="border: 2px solid var(--border); border-radius: 12px; background: linear-gradient(180deg, #87CEEB 0%, #E0F6FF 50%, #FFE4B5 100%); cursor: none;"></canvas>
    `;
    
    canvas = document.getElementById('lieveheersbeestjes-canvas');
    
    ctx = canvas.getContext('2d');
    
    // Set canvas size
    const containerWidth = area.offsetWidth - 40;
    canvas.width = Math.min(900, containerWidth);
    canvas.height = 600; // Hoger voor verticaal spel
    canvas.style.display = 'block';
    canvas.style.width = canvas.width + 'px';
    canvas.style.height = canvas.height + 'px';
    
    // Initialize score display
    updateScore();
    window.RegenboogCore.updateHUDRound(CLASS_ID, currentRound);
    
    // Initialize ladybug position (middle horizontally, bottom vertically)
    ladybugX = canvas.width / 2;
    mouseX = ladybugX;
    const LADYBUG_Y_POS = canvas.height - LADYBUG_HEIGHT - 20; // 20px van onderen
    
    // Mouse/touch tracking (passive: false zodat preventDefault scroll blokkeert op tablet/gsm)
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    
    // Start game loop
    gameLoop();
  }
  
  function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseX = Math.max(LADYBUG_WIDTH / 2, Math.min(canvas.width - LADYBUG_WIDTH / 2, mouseX));
  }
  
  function handleTouchMove(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    mouseX = touch.clientX - rect.left;
    mouseX = Math.max(LADYBUG_WIDTH / 2, Math.min(canvas.width - LADYBUG_WIDTH / 2, mouseX));
  }
  
  function spawnObjects() {
    const now = Date.now();
    const spawnInterval = SPAWN_INTERVALS[currentRound - 1];
    
    if (now - lastSpawnTime >= spawnInterval) {
      lastSpawnTime = now;
      
      const speed = SPEEDS[currentRound - 1];
      
      // Determine if obstacle or flower (zoals bij dolfijnen)
      let obstacleChance, flowerChance;
      if (currentRound === 1) {
        obstacleChance = OBSTACLE_CHANCES[0];
        flowerChance = 1 - obstacleChance;
      } else if (currentRound === 2) {
        obstacleChance = OBSTACLE_CHANCES[1];
        flowerChance = 1 - obstacleChance;
      } else {
        obstacleChance = OBSTACLE_CHANCES[2];
        flowerChance = 1 - obstacleChance;
      }
      
      const rand = Math.random();
      
      if (rand < obstacleChance) {
        // Spawn obstacle - van boven naar beneden
        const obstacleTypes = ['butterfly', 'owl', 'mouse'];
        const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
        const size = OBSTACLE_SIZES[currentRound - 1];
        
        // Maak uilen en muizen groter
        let finalWidth = size.width;
        let finalHeight = size.height;
        if (type === 'owl' || type === 'mouse') {
          finalWidth = size.width * 1.3; // 30% groter
          finalHeight = size.height * 1.3;
        }
        
        obstacles.push({
          x: 50 + Math.random() * (canvas.width - 100), // Horizontaal random
          y: -size.height, // Start boven het scherm
          width: finalWidth,
          height: finalHeight,
          type: type,
          speed: speed
        });
        
        // In ronde 2 en 3: soms 2 obstakels tegelijk (extra moeilijkheid zoals bij dolfijnen)
        if (currentRound >= 2 && Math.random() < 0.3) {
          const type2 = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
          let finalWidth2 = size.width;
          let finalHeight2 = size.height;
          if (type2 === 'owl' || type2 === 'mouse') {
            finalWidth2 = size.width * 1.3;
            finalHeight2 = size.height * 1.3;
          }
          obstacles.push({
            x: 50 + Math.random() * (canvas.width - 100),
            y: -size.height - 30, // Iets achter het eerste
            width: finalWidth2,
            height: finalHeight2,
            type: type2,
            speed: speed
          });
        }
      } else {
        // Spawn flower - van boven naar beneden
        flowers.push({
          x: 50 + Math.random() * (canvas.width - 100), // Horizontaal random
          y: -FLOWER_HEIGHT, // Start boven het scherm
          width: FLOWER_WIDTH,
          height: FLOWER_HEIGHT,
          speed: speed
        });
      }
    }
  }
  
  function updateObjects() {
    // Update ladybug position (smooth follow) - horizontaal bewegen
    const targetX = mouseX;
    ladybugX += (targetX - ladybugX) * 0.15;
    
    // Update obstacles - bewegen van boven naar beneden
    obstacles.forEach((obstacle, idx) => {
      obstacle.y += obstacle.speed;
    });
    obstacles = obstacles.filter(obstacle => obstacle.y < canvas.height + obstacle.height);
    
    // Update flowers - bewegen van boven naar beneden
    flowers.forEach((flower, idx) => {
      flower.y += flower.speed;
    });
    flowers = flowers.filter(flower => flower.y < canvas.height + flower.height);
    
    // Check collisions
    checkCollisions();
    
    // Update score popups
    updateScorePopups();
  }
  
  function checkCollisions() {
    const LADYBUG_Y_POS = canvas.height - LADYBUG_HEIGHT - 20;
    const ladybugLeft = ladybugX - LADYBUG_WIDTH / 2;
    const ladybugRight = ladybugX + LADYBUG_WIDTH / 2;
    const ladybugTop = LADYBUG_Y_POS;
    const ladybugBottom = LADYBUG_Y_POS + LADYBUG_HEIGHT;
    
    // Check flower collisions
    flowers.forEach((flower, idx) => {
      if (flower.x < ladybugRight && flower.x + flower.width > ladybugLeft &&
          flower.y < ladybugBottom && flower.y + flower.height > ladybugTop) {
        score += 10;
        playFlowerSound(); // Geluidje zoals bij dolfijnen
        addScorePopup(flower.x + flower.width / 2, flower.y, '+10', '#2a9d8f');
        flowers.splice(idx, 1);
        updateScore();
      }
    });
    
    // Check obstacle collisions
    obstacles.forEach((obstacle, idx) => {
      if (obstacle.x < ladybugRight && obstacle.x + obstacle.width > ladybugLeft &&
          obstacle.y < ladybugBottom && obstacle.y + obstacle.height > ladybugTop) {
        score = Math.max(0, score - 5);
        playObstacleSound(); // Geluidje zoals bij dolfijnen
        addScorePopup(obstacle.x + obstacle.width / 2, obstacle.y, '-5', '#e63946');
        obstacles.splice(idx, 1);
        updateScore();
      }
    });
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
  
  function updateScore() {
    window.RegenboogCore.updateHUDScore(CLASS_ID, score);
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
    
    const hudContainer = document.getElementById('lieveheersbeestjes-hud-container');
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
      // Next round
      area.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
          <h2 class="game-score">Ronde ${currentRound} voltooid!</h2>
          <p style="font-size: 1.2rem; margin: 1rem 0;">Score deze ronde: <strong>${score}</strong></p>
          <p style="font-size: 1.2rem; margin: 1rem 0;">Totaal Score: <strong>${totalScore}</strong></p>
          <button onclick="window.lieveheersbeestjesStartRound()" style="padding: 1rem 2rem; font-size: 1.2rem; background: linear-gradient(135deg, var(--rainbow-4), var(--rainbow-5)); color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: 600; margin-top: 1rem;">
            Volgende Ronde
          </button>
        </div>
      `;
    }
  }
  
  function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw clouds (background decoration) - aangepast voor verticaal
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(150, 100, 30, 0, Math.PI * 2);
    ctx.arc(170, 100, 35, 0, Math.PI * 2);
    ctx.arc(190, 100, 30, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(700, 150, 25, 0, Math.PI * 2);
    ctx.arc(715, 150, 30, 0, Math.PI * 2);
    ctx.arc(730, 150, 25, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(400, 80, 25, 0, Math.PI * 2);
    ctx.arc(415, 80, 30, 0, Math.PI * 2);
    ctx.arc(430, 80, 25, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw flowers - gebruik emoji zoals op uitleg pagina
    flowers.forEach(flower => {
      ctx.font = flower.width + 'px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🌸', flower.x + flower.width / 2, flower.y + flower.height / 2);
    });
    
    // Draw obstacles
    obstacles.forEach(obstacle => {
      let img = null;
      if (obstacle.type === 'butterfly' && butterflyImage) {
        img = butterflyImage;
      } else if (obstacle.type === 'owl' && owlImage) {
        img = owlImage;
      } else if (obstacle.type === 'mouse' && mouseImage) {
        img = mouseImage;
      }
      
      if (img && img.complete) {
        // Behoud aspect ratio voor alle afbeeldingen
        const imgAspect = img.width / img.height;
        const targetAspect = obstacle.width / obstacle.height;
        let drawWidth = obstacle.width;
        let drawHeight = obstacle.height;
        let drawX = obstacle.x;
        let drawY = obstacle.y;
        
        if (imgAspect > targetAspect) {
          // Image is breder - pas hoogte aan
          drawHeight = obstacle.width / imgAspect;
          drawY = obstacle.y + (obstacle.height - drawHeight) / 2;
        } else {
          // Image is hoger - pas breedte aan
          drawWidth = obstacle.height * imgAspect;
          drawX = obstacle.x + (obstacle.width - drawWidth) / 2;
        }
        
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      } else {
        // Fallback emoji
        ctx.font = obstacle.width + 'px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const emoji = obstacle.type === 'butterfly' ? '🦋' : obstacle.type === 'owl' ? '🦉' : '🐭';
        ctx.fillText(emoji, obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2);
      }
    });
    
    // Draw ladybug - onderaan het scherm, horizontaal bewegen
    const LADYBUG_Y_POS = canvas.height - LADYBUG_HEIGHT - 20;
    if (ladybugImage && ladybugImage.complete) {
      const ladybugAspect = ladybugImage.width / ladybugImage.height;
      const targetAspect = LADYBUG_WIDTH / LADYBUG_HEIGHT;
      let drawWidth = LADYBUG_WIDTH;
      let drawHeight = LADYBUG_HEIGHT;
      let drawX = ladybugX - LADYBUG_WIDTH / 2;
      let drawY = LADYBUG_Y_POS;
      
      if (ladybugAspect > targetAspect) {
        // Image is breder - pas hoogte aan
        drawHeight = LADYBUG_WIDTH / ladybugAspect;
        drawY = LADYBUG_Y_POS + (LADYBUG_HEIGHT - drawHeight) / 2;
      } else {
        // Image is hoger - pas breedte aan
        drawWidth = LADYBUG_HEIGHT * ladybugAspect;
        drawX = ladybugX - drawWidth / 2;
      }
      
      ctx.drawImage(ladybugImage, drawX, drawY, drawWidth, drawHeight);
    } else {
      // Fallback: draw simple ladybug shape
      const LADYBUG_Y_POS = canvas.height - LADYBUG_HEIGHT - 20;
      ctx.fillStyle = '#c41e3a';
      ctx.beginPath();
      ctx.ellipse(ladybugX, LADYBUG_Y_POS + LADYBUG_HEIGHT / 2, LADYBUG_WIDTH / 2, LADYBUG_HEIGHT / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8b1530';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Draw spots
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(ladybugX - 10, LADYBUG_Y_POS + LADYBUG_HEIGHT / 2 - 5, 4, 0, Math.PI * 2);
      ctx.arc(ladybugX + 10, LADYBUG_Y_POS + LADYBUG_HEIGHT / 2 - 5, 4, 0, Math.PI * 2);
      ctx.arc(ladybugX, LADYBUG_Y_POS + LADYBUG_HEIGHT / 2 + 5, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw score popups
    drawScorePopups();
  }
  
  function gameLoop() {
    if (!gameRunning) return;
    
    spawnObjects();
    updateObjects();
    draw();
    checkRoundEnd();
    
    animationId = requestAnimationFrame(gameLoop);
  }
  
  // Expose startRound globally for button onclick
  window.lieveheersbeestjesStartRound = startRound;
  
  function startFresh() {
    currentRound = 0;
    totalScore = 0;
    init();
  }

  function showIntro() {
    area.innerHTML =
      '<div style="text-align:center; margin-bottom:1rem;">' +
      '  <h3>Lieveheersbeestjes - Tuinverdediging</h3>' +
      '  <p style="font-size:1.05rem; color:#555; margin-bottom:0.6rem;">Bescherm de tuin en vang de juiste doelen.</p>' +
      '  <div style="margin:1rem 0; padding:1rem; background:#fff5f5; border-radius:8px; display:inline-block; text-align:left;">' +
      '    <p style="margin:0.5rem 0;"><strong>Hoe te spelen:</strong></p>' +
      '    <p style="margin:0.5rem 0;">- Beweeg en reageer snel op objecten</p>' +
      '    <p style="margin:0.5rem 0;">- Verzamel punten en vermijd fouten</p>' +
      '    <p style="margin:0.5rem 0;">- Elke ronde wordt uitdagender</p>' +
      '  </div>' +
      '  <div><button type="button" id="lieveheersbeestjes-start" style="padding:1rem 2rem; font-size:1.1rem; background:linear-gradient(135deg, #e53e3e, #c53030); color:white; border:none; border-radius:12px; cursor:pointer; font-weight:700;">Start spel</button></div>' +
      '</div>';
    var startBtn = document.getElementById('lieveheersbeestjes-start');
    if (startBtn) {
      startBtn.addEventListener('click', startFresh);
    }
  }

  showIntro();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
