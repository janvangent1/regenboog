(function () {
  const CLASS_ID = 'egels';
  const TOTAL_ROUNDS = 3;
  const area = document.getElementById('game-area');
  const leaderboardEl = document.getElementById('leaderboard');
  
  let canvas, ctx;
  let hedgehogX = 0;
  let hedgehogY = 0;
  let score = 0;
  let currentRound = 0;
  let totalScore = 0;
  let gameRunning = false;
  let animationId = null;
  let vehicles = [];
  let lastSpawnTime = 0;
  let startTime = 0;
  let roundDuration = 0; // Geen timer, spel eindigt wanneer egel oversteekt
  let hedgehogImage = null;
  let lanes = [];
  let crossingsCompleted = 0;
  let crossingsNeeded = 3; // Aantal keer oversteken per ronde
  let hits = 0; // Aantal keer geraakt
  let hitCooldown = 0; // Cooldown om meerdere hits snel achter elkaar te voorkomen
  let isHit = false; // Voor visuele feedback
  let topGrassY = 0; // Y positie van de top grass (voor oversteek detectie)
  
  // Game constants
  const HEDGEHOG_WIDTH = 50;
  const HEDGEHOG_HEIGHT = 50;
  const LANE_HEIGHT = 80;
  const VEHICLE_SPEEDS = [
    { min: 2, max: 4 },   // Ronde 1: langzaam
    { min: 3.5, max: 6 },   // Ronde 2: sneller
    { min: 4.5, max: 7 }    // Ronde 3: snelst (iets makkelijker dan voorheen, maar nog steeds moeilijker dan ronde 2)
  ];
  const SPAWN_RATES = [800, 500, 450]; // Milliseconden tussen spawns per ronde (meer verkeer per ronde, maar ronde 3 iets makkelijker)
  const VEHICLES_PER_SPAWN = [1, 1, 2]; // Aantal voertuigen per spawn per ronde
  const VEHICLE_TYPES = [
    { name: 'car', width: 60, height: 40, color: '#FF6B6B' },
    { name: 'bike', width: 50, height: 30, color: '#4ECDC4' },
    { name: 'truck', width: 80, height: 50, color: '#FFE66D' }
  ];
  
  // Load hedgehog image
  function loadHedgehogImage() {
    hedgehogImage = new Image();
    hedgehogImage.src = '/assets/images/classes/egels.png';
    hedgehogImage.onerror = function() {
      hedgehogImage = null; // Fallback naar getekende egel
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
  
  function playCorrectSound() {
    playSound(600, 0.2, 'sine');
  }
  
  function playWrongSound() {
    playSound(200, 0.3, 'sawtooth');
  }
  
  function playMoveSound() {
    playSound(400, 0.1, 'sine');
  }
  
  function calculateLiveScore() {
    if (startTime === 0) return 0;
    const elapsed = (Date.now() - startTime) / 1000;
    // Basis score per ronde (200/300/400), minus tijd * 2, plus crossings * 50
    const baseScore = currentRound === 1 ? 200 : currentRound === 2 ? 300 : 400;
    const timePenalty = Math.floor(elapsed * 2);
    const crossingBonus = crossingsCompleted * 50;
    // Stevige penalty per hit: -30 punten per keer geraakt
    const hitPenalty = hits * 30;
    return Math.max(10, Math.floor(baseScore - timePenalty + crossingBonus - hitPenalty));
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
  
  let timerInterval = null;
  
  function init() {
    currentRound = 0;
    totalScore = 0;
    score = 0;
    gameRunning = false;
    vehicles = [];
    lastSpawnTime = 0;
    crossingsCompleted = 0;
    
    loadHedgehogImage();
    startRound();
  }
  
  function startRound() {
    currentRound++;
    score = 0;
    gameRunning = true;
    vehicles = [];
    lastSpawnTime = Date.now();
    startTime = Date.now();
    crossingsCompleted = 0;
    hits = 0;
    hitCooldown = 0;
    isHit = false;
    checkingCrossing = false;
    
    const hudHtml = window.RegenboogCore.createHUD(CLASS_ID, currentRound, TOTAL_ROUNDS, false, true);
    area.innerHTML = hudHtml + `
      <canvas id="egels-canvas" style="border: 2px solid var(--border); border-radius: 12px; background: #87CEEB;"></canvas>
    `;
    
    canvas = document.getElementById('egels-canvas');
    ctx = canvas.getContext('2d');
    
    // Set canvas size
    const containerWidth = area.offsetWidth - 40;
    canvas.width = Math.min(900, containerWidth);
    canvas.height = 600;
    canvas.style.display = 'block';
    canvas.style.width = canvas.width + 'px';
    canvas.style.height = canvas.height + 'px';
    
    // Initialize hedgehog position (center horizontally, bottom)
    hedgehogX = canvas.width / 2 - HEDGEHOG_WIDTH / 2;
    hedgehogY = canvas.height - HEDGEHOG_HEIGHT - 20;
    
    // Initialize lanes (grass at top and bottom, roads in between)
    // Zelfde aantal lanes voor alle rondes - alleen meer en sneller verkeer
    lanes = [];
    const numLanes = 5; // Vast aantal lanes voor alle rondes
    const roadHeight = numLanes * LANE_HEIGHT;
    topGrassY = (canvas.height - roadHeight) / 2; // Sla op voor oversteek detectie
    
    for (let i = 0; i < numLanes; i++) {
      lanes.push({
        y: topGrassY + i * LANE_HEIGHT,
        direction: i % 2 === 0 ? 'right' : 'left' // Alternerende richtingen
      });
    }
    
    // Setup keyboard controls
    document.addEventListener('keydown', handleKeyPress);
    
    // Initialize HUD
    window.RegenboogCore.updateHUDRound(CLASS_ID, currentRound);
    window.RegenboogCore.updateHUDScore(CLASS_ID, 0);
    
    startTimer();
    gameLoop();
  }
  
  function handleKeyPress(e) {
    if (!gameRunning) return;
    
    const MOVE_STEP = 50; // Stapgrootte voor beweging
    
    if (e.key === 'ArrowUp' || e.key === 'Up') {
      e.preventDefault();
      moveHedgehog(0, -LANE_HEIGHT);
      playMoveSound();
    } else if (e.key === 'ArrowDown' || e.key === 'Down') {
      e.preventDefault();
      // Alleen achteruit als niet op startpositie
      if (hedgehogY < canvas.height - HEDGEHOG_HEIGHT - 20) {
        moveHedgehog(0, LANE_HEIGHT);
        playMoveSound();
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'Left') {
      e.preventDefault();
      moveHedgehog(-MOVE_STEP, 0);
      playMoveSound();
    } else if (e.key === 'ArrowRight' || e.key === 'Right') {
      e.preventDefault();
      moveHedgehog(MOVE_STEP, 0);
      playMoveSound();
    }
  }
  
  function moveHedgehog(dx, dy) {
    const newX = hedgehogX + dx;
    const newY = hedgehogY + dy;
    
    // Check boundaries
    if (newX < 0 || newX + HEDGEHOG_WIDTH > canvas.width) return;
    // Allow movement up to topGrassY (egel moet boven topGrassY kunnen komen voor oversteek)
    // Bottom boundary: canvas.height
    const minY = topGrassY - HEDGEHOG_HEIGHT; // Allow going exactly to topGrassY
    const maxY = canvas.height - HEDGEHOG_HEIGHT;
    if (newY < minY || newY > maxY) return;
    
    hedgehogX = newX;
    hedgehogY = newY;
    
    // Check collision with vehicles (geen game over meer, alleen penalty)
    if (checkCollision() && hitCooldown <= 0) {
      handleHit();
    }
  }
  
  function handleHit() {
    hits++;
    hitCooldown = 1000; // 1 seconde cooldown tussen hits
    isHit = true;
    playWrongSound();
    
    // Reset hit visual feedback na korte tijd
    setTimeout(() => {
      isHit = false;
    }, 300);
    
    // Optioneel: reset egel naar veilige positie (terug naar start of laatste veilige lane)
    // Voor nu laten we de egel gewoon doorgaan waar hij is
  }
  
  function checkCrossingComplete() {
    // Check if reached top (completed crossing) - check continu in game loop
    // De egel heeft de overkant bereikt als hij boven de top grass is
    if (hedgehogY + HEDGEHOG_HEIGHT <= topGrassY && gameRunning) {
      // Voorkom meerdere triggers door een flag te gebruiken
      if (!checkingCrossing) {
        checkingCrossing = true;
        crossingsCompleted++;
        playCorrectSound();
        
        setTimeout(() => {
          if (crossingsCompleted >= crossingsNeeded) {
            // Round complete
            completeRound();
          } else {
            // Reset to bottom for next crossing
            hedgehogY = canvas.height - HEDGEHOG_HEIGHT - 20;
            hedgehogX = canvas.width / 2 - HEDGEHOG_WIDTH / 2;
            checkingCrossing = false;
          }
        }, 500);
      }
    } else if (hedgehogY + HEDGEHOG_HEIGHT > topGrassY + 10) {
      // Reset flag als egel weer onder de top is
      checkingCrossing = false;
    }
  }
  
  let checkingCrossing = false; // Flag om meerdere triggers te voorkomen
  
  function checkCollision() {
    for (let vehicle of vehicles) {
      if (hedgehogX < vehicle.x + vehicle.width &&
          hedgehogX + HEDGEHOG_WIDTH > vehicle.x &&
          hedgehogY < vehicle.y + vehicle.height &&
          hedgehogY + HEDGEHOG_HEIGHT > vehicle.y) {
        return true;
      }
    }
    return false;
  }
  
  function isLaneClear(laneIndex, direction, minDistance = 200) {
    const lane = lanes[laneIndex];
    const laneY = lane.y;
    const laneYEnd = laneY + LANE_HEIGHT;
    
    for (let vehicle of vehicles) {
      // Check if vehicle is on this lane (with some tolerance)
      const vehicleCenterY = vehicle.y + vehicle.height / 2;
      if (vehicleCenterY >= laneY && vehicleCenterY <= laneYEnd && vehicle.direction === direction) {
        // Check distance based on direction
        if (direction === 'right') {
          // Check if there's space before spawning (vehicle coming from left)
          // Check if vehicle is still on screen or just spawned
          if (vehicle.x < minDistance && vehicle.x > -vehicle.width - 50) {
            return false;
          }
        } else {
          // Check if there's space before spawning (vehicle coming from right)
          if (vehicle.x + vehicle.width > canvas.width - minDistance && vehicle.x < canvas.width + 50) {
            return false;
          }
        }
      }
    }
    return true;
  }
  
  function spawnVehicle() {
    if (!gameRunning) return;
    
    const numVehicles = VEHICLES_PER_SPAWN[currentRound - 1];
    const attemptsPerVehicle = 10; // Max aantal pogingen per voertuig
    
    for (let v = 0; v < numVehicles; v++) {
      let spawned = false;
      let attempts = 0;
      
      while (!spawned && attempts < attemptsPerVehicle) {
        const laneIndex = Math.floor(Math.random() * lanes.length);
        const lane = lanes[laneIndex];
        
        // Check if lane is clear
        if (isLaneClear(laneIndex, lane.direction, 120)) {
          const vehicleType = VEHICLE_TYPES[Math.floor(Math.random() * VEHICLE_TYPES.length)];
          const speed = VEHICLE_SPEEDS[currentRound - 1].min + 
                       Math.random() * (VEHICLE_SPEEDS[currentRound - 1].max - VEHICLE_SPEEDS[currentRound - 1].min);
          
          let x, y;
          if (lane.direction === 'right') {
            x = -vehicleType.width;
            y = lane.y + (LANE_HEIGHT - vehicleType.height) / 2;
          } else {
            x = canvas.width;
            y = lane.y + (LANE_HEIGHT - vehicleType.height) / 2;
          }
          
          vehicles.push({
            x: x,
            y: y,
            width: vehicleType.width,
            height: vehicleType.height,
            speed: speed,
            direction: lane.direction,
            type: vehicleType.name,
            color: vehicleType.color,
            laneIndex: laneIndex
          });
          
          spawned = true;
        }
        attempts++;
      }
    }
  }
  
  function getVehicleLane(vehicle) {
    // Find which lane a vehicle is in
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i];
      const vehicleCenterY = vehicle.y + vehicle.height / 2;
      if (vehicleCenterY >= lane.y && vehicleCenterY <= lane.y + LANE_HEIGHT) {
        return i;
      }
    }
    return -1;
  }
  
  function checkVehicleCollision(vehicle, otherVehicles) {
    const vehicleLane = getVehicleLane(vehicle);
    if (vehicleLane === -1) return false;
    
    for (let other of otherVehicles) {
      if (vehicle === other) continue;
      if (vehicle.direction !== other.direction) continue;
      
      const otherLane = getVehicleLane(other);
      if (otherLane === -1) continue;
      
      // Check if vehicles are on same lane
      if (vehicleLane === otherLane) {
        // Check horizontal collision (with some buffer)
        const buffer = 10;
        if (vehicle.direction === 'right') {
          // Vehicle coming from left, check if other is ahead
          if (other.x > vehicle.x && other.x < vehicle.x + vehicle.width + buffer) {
            return true;
          }
        } else {
          // Vehicle coming from right, check if other is ahead
          if (other.x + other.width < vehicle.x + vehicle.width && other.x + other.width > vehicle.x - buffer) {
            return true;
          }
        }
      }
    }
    return false;
  }
  
  function updateVehicles() {
    // Update hit cooldown
    if (hitCooldown > 0) {
      hitCooldown -= 16; // ~60fps, ongeveer 16ms per frame
    }
    
    for (let i = vehicles.length - 1; i >= 0; i--) {
      const vehicle = vehicles[i];
      const currentLaneIndex = getVehicleLane(vehicle);
      
      // Check for collision with other vehicles and change lane if needed
      if (checkVehicleCollision(vehicle, vehicles) && currentLaneIndex !== -1) {
        // Try to change lane - check adjacent lanes
        const possibleLanes = [];
        
        // Try lane above
        if (currentLaneIndex > 0) {
          const laneAbove = lanes[currentLaneIndex - 1];
          if (laneAbove.direction === vehicle.direction) {
            // Check if lane above is clear
            let clear = true;
            for (let other of vehicles) {
              if (other === vehicle) continue;
              const otherLane = getVehicleLane(other);
              if (otherLane === currentLaneIndex - 1 && other.direction === vehicle.direction) {
                // Check if there's space
                if (vehicle.direction === 'right') {
                  if (other.x < vehicle.x + vehicle.width + 100) clear = false;
                } else {
                  if (other.x + other.width > vehicle.x - 100) clear = false;
                }
              }
            }
            if (clear) possibleLanes.push(currentLaneIndex - 1);
          }
        }
        
        // Try lane below
        if (currentLaneIndex < lanes.length - 1) {
          const laneBelow = lanes[currentLaneIndex + 1];
          if (laneBelow.direction === vehicle.direction) {
            // Check if lane below is clear
            let clear = true;
            for (let other of vehicles) {
              if (other === vehicle) continue;
              const otherLane = getVehicleLane(other);
              if (otherLane === currentLaneIndex + 1 && other.direction === vehicle.direction) {
                // Check if there's space
                if (vehicle.direction === 'right') {
                  if (other.x < vehicle.x + vehicle.width + 100) clear = false;
                } else {
                  if (other.x + other.width > vehicle.x - 100) clear = false;
                }
              }
            }
            if (clear) possibleLanes.push(currentLaneIndex + 1);
          }
        }
        
        // Change to a random available lane
        if (possibleLanes.length > 0) {
          const newLaneIndex = possibleLanes[Math.floor(Math.random() * possibleLanes.length)];
          const newLane = lanes[newLaneIndex];
          vehicle.y = newLane.y + (LANE_HEIGHT - vehicle.height) / 2;
        }
      }
      
      if (vehicle.direction === 'right') {
        vehicle.x += vehicle.speed;
        if (vehicle.x > canvas.width) {
          vehicles.splice(i, 1);
        }
      } else {
        vehicle.x -= vehicle.speed;
        if (vehicle.x + vehicle.width < 0) {
          vehicles.splice(i, 1);
        }
      }
    }
    
    // Spawn new vehicles
    const now = Date.now();
    if (now - lastSpawnTime > SPAWN_RATES[currentRound - 1]) {
      spawnVehicle();
      lastSpawnTime = now;
    }
  }
  
  function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw grass at top
    ctx.fillStyle = '#90EE90';
    ctx.fillRect(0, 0, canvas.width, topGrassY);
    
    // Draw roads and lanes
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i];
      
      // Road background (gray)
      ctx.fillStyle = '#555';
      ctx.fillRect(0, lane.y, canvas.width, LANE_HEIGHT);
      
      // Lane markings (dashed lines)
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(0, lane.y + LANE_HEIGHT / 2);
      ctx.lineTo(canvas.width, lane.y + LANE_HEIGHT / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    // Draw grass at bottom
    const bottomGrassStart = lanes.length > 0 ? lanes[lanes.length - 1].y + LANE_HEIGHT : topGrassY;
    ctx.fillStyle = '#90EE90';
    ctx.fillRect(0, bottomGrassStart, canvas.width, canvas.height - bottomGrassStart);
    
    // Draw vehicles
    for (let vehicle of vehicles) {
      ctx.fillStyle = vehicle.color;
      ctx.fillRect(vehicle.x, vehicle.y, vehicle.width, vehicle.height);
      
      // Add simple details
      ctx.fillStyle = '#000';
      ctx.fillRect(vehicle.x + 5, vehicle.y + 5, vehicle.width - 10, vehicle.height - 10);
      ctx.fillStyle = vehicle.color;
      ctx.fillRect(vehicle.x + 8, vehicle.y + 8, vehicle.width - 16, vehicle.height - 16);
    }
    
    // Draw hedgehog (with hit effect)
    ctx.save();
    if (isHit) {
      // Rood knipperen bij hit
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(hedgehogX - 5, hedgehogY - 5, HEDGEHOG_WIDTH + 10, HEDGEHOG_HEIGHT + 10);
      ctx.globalAlpha = 1;
    }
    
    if (hedgehogImage && hedgehogImage.complete) {
      ctx.drawImage(hedgehogImage, hedgehogX, hedgehogY, HEDGEHOG_WIDTH, HEDGEHOG_HEIGHT);
    } else {
      // Fallback: draw simple hedgehog shape
      ctx.fillStyle = isHit ? '#FF6B6B' : '#8B7355';
      ctx.beginPath();
      ctx.ellipse(hedgehogX + HEDGEHOG_WIDTH / 2, hedgehogY + HEDGEHOG_HEIGHT / 2, 
                  HEDGEHOG_WIDTH / 2, HEDGEHOG_HEIGHT / 2, 0, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw spikes
      ctx.strokeStyle = '#654321';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * 2 * Math.PI;
        const x1 = hedgehogX + HEDGEHOG_WIDTH / 2 + Math.cos(angle) * HEDGEHOG_WIDTH / 3;
        const y1 = hedgehogY + HEDGEHOG_HEIGHT / 2 + Math.sin(angle) * HEDGEHOG_HEIGHT / 3;
        const x2 = hedgehogX + HEDGEHOG_WIDTH / 2 + Math.cos(angle) * HEDGEHOG_WIDTH / 2;
        const y2 = hedgehogY + HEDGEHOG_HEIGHT / 2 + Math.sin(angle) * HEDGEHOG_HEIGHT / 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
    ctx.restore();
    
    // Draw progress indicator
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 250, 50);
    ctx.fillStyle = '#FFF';
    ctx.font = '16px Arial';
    ctx.fillText(`Oversteken: ${crossingsCompleted}/${crossingsNeeded}`, 15, 30);
    if (hits > 0) {
      ctx.fillStyle = '#FF6B6B';
      ctx.fillText(`Geraakt: ${hits}x (-${hits * 30} punten)`, 15, 50);
    }
  }
  
  function gameLoop() {
    if (!gameRunning) return;
    
    updateVehicles();
    
    // Check collision continuously (geen game over meer, alleen penalty)
    if (checkCollision() && hitCooldown <= 0) {
      handleHit();
    }
    
    // Check if crossing is complete (continu checken)
    checkCrossingComplete();
    
    draw();
    animationId = requestAnimationFrame(gameLoop);
  }
  
  // Game over functie wordt niet meer gebruikt bij hits, alleen bij ronde voltooiing
  // Maar behouden voor eventuele toekomstige use cases
  
  function completeRound() {
    gameRunning = false;
    stopTimer();
    document.removeEventListener('keydown', handleKeyPress);
    
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    
    // Play success sound
    playCorrectSound();
    setTimeout(() => playSound(700, 0.15, 'sine'), 100);
    setTimeout(() => playSound(800, 0.2, 'sine'), 200);
    
    const finalScore = calculateLiveScore();
    totalScore += finalScore;
    
    if (currentRound >= TOTAL_ROUNDS) {
      // Game complete
      area.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
          <h2 class="game-score" style="font-size: 1.8rem; color: #2a9d8f;">Geweldig! Alle rondes voltooid!</h2>
          <p style="font-size: 1.5rem; margin: 1rem 0;">Totaal Score: <strong>${totalScore}</strong></p>
          ${hits > 0 ? `<p style="font-size: 1rem; color: #e63946; margin: 0.5rem 0;">Totaal geraakt: ${hits}x</p>` : '<p style="font-size: 1rem; color: #2a9d8f; margin: 0.5rem 0;">Perfect! Geen botsingen!</p>'}
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
          <p style="font-size: 1.2rem; margin: 1rem 0;">Score deze ronde: <strong>${finalScore}</strong></p>
          ${hits > 0 ? `<p style="font-size: 1rem; color: #e63946; margin: 0.5rem 0;">Geraakt: ${hits}x (${hits * 30} punten verloren)</p>` : ''}
          <p style="font-size: 1.2rem; margin: 1rem 0;">Totaal Score: <strong>${totalScore}</strong></p>
          <p style="font-size: 1rem; color: #666; margin-top: 1rem;">Klaar voor ronde ${currentRound + 1}...</p>
        </div>
      `;
      setTimeout(() => {
        startRound();
      }, 2000);
    }
  }
  
  function startFresh() {
    currentRound = 0;
    totalScore = 0;
    init();
  }

  function showIntro() {
    area.innerHTML =
      '<div style="text-align:center; margin-bottom:1rem;">' +
      '  <h3>Egels - Weg Oversteken</h3>' +
      '  <p style="font-size:1.05rem; color:#555; margin-bottom:0.6rem;">Help de egel veilig oversteken en ontwijk verkeer.</p>' +
      '  <div style="margin:1rem 0; padding:1rem; background:#f5f0e8; border-radius:8px; display:inline-block; text-align:left;">' +
      '    <p style="margin:0.5rem 0;"><strong>Hoe te spelen:</strong></p>' +
      '    <p style="margin:0.5rem 0;">- Gebruik pijltjestoetsen of richtingknoppen</p>' +
      '    <p style="margin:0.5rem 0;">- Vermijd auto\'s en raak de overkant</p>' +
      '    <p style="margin:0.5rem 0;">- Speel 3 rondes met meer uitdaging</p>' +
      '  </div>' +
      '  <div><button type="button" id="egels-start" style="padding:1rem 2rem; font-size:1.1rem; background:linear-gradient(135deg, #2f855a, #276749); color:white; border:none; border-radius:12px; cursor:pointer; font-weight:700;">Start spel</button></div>' +
      '</div>';
    var startBtn = document.getElementById('egels-start');
    if (startBtn) {
      startBtn.addEventListener('click', startFresh);
    }
  }

  showIntro();
  window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
