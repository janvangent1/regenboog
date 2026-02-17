/**
 * Zeeslag – 1 vs 1, 1 vs computer, of multiplayer. Zelfde flow als dammen.
 */
(function () {
  const CLASS_ID = 'zeeslag';
  const area = document.getElementById('game-area');
  if (area) area.classList.add('zeeslag-game');
  const leaderboardEl = document.getElementById('leaderboard');
  const SIZE = 10;
  const P1 = 1;
  const P2 = 2;
  const SHIPS = [
    [5, 1], // 1 schip van 5
    [4, 1], // 1 schip van 4
    [3, 2], // 2 schepen van 3
    [2, 1], // 1 schip van 2
  ];

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  let myBoard = null; // Mijn bord met schepen
  let opponentBoard = null; // Tegenstander bord (alleen shots/hits zichtbaar)
  let currentPlayer = P1;
  let mode = null;
  let step = null; // null, 'placement', 'play', 'mp-name', 'mp-lobby'
  let placementPhase = true;
  let currentShipIndex = 0;
  let selectedShip = null; // { length, horizontal: true/false }
  let placementHistory = []; // Voor undo functionaliteit
  let selectedShipIndex = null; // Voor rotate/move
  let gameOver = false;
  let winner = null;
  let aiThinkingTimeout = null; // Voor AI delay
  let aiBoard = null; // AI's eigen bord (voor 1vAI)
  let aiDifficulty = 'normal'; // AI moeilijkheidsgraad
  let aiLastHit = null; // Laatste hit positie voor AI targeting
  let aiHuntMode = false; // AI is in "hunt" mode (heeft een hit maar schip nog niet gezonken)
  let aiHuntDirection = null; // Richting waarin AI aan het zoeken is
  let aiHuntStartPos = null; // Start positie van de hunt
  let lastSunkShipMessage = null; // Voor schip gezonken meldingen
  let previousOpponentHits = new Set(); // Track hits voor schip gezonken detectie
  let socket = null;
  let myName = '';
  let mySide = null;
  let opponentName = '';
  let roomId = null;
  let chatMessages = [];
  let lobbyList = [];
  let pendingInviteFrom = null;

  // Sound functions
  function playSound(frequency, duration, type = 'sine') {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (e) {
      // Silently fail if audio not supported
    }
  }

  function playMissSound() {
    // Plons geluid - lage frequentie, water-achtig
    playSound(150, 0.3, 'sine');
  }

  function playHitSound() {
    // Knal geluid - hogere frequentie, explosie-achtig
    playSound(400, 0.15, 'square');
    setTimeout(function () { playSound(300, 0.1, 'sawtooth'); }, 50);
  }

  function playSunkSound() {
    // Speciaal geluid voor gezonken schip
    playSound(200, 0.2, 'sawtooth');
    setTimeout(function () { playSound(150, 0.3, 'sawtooth'); }, 100);
  }

  function checkShipSunk(board, previousHits) {
    // Check of er een schip volledig gezonken is
    for (var i = 0; i < board.ships.length; i++) {
      var ship = board.ships[i];
      var allHit = true;
      for (var j = 0; j < ship.length; j++) {
        var key = ship[j][0] + ',' + ship[j][1];
        if (!board.hits.has(key)) {
          allHit = false;
          break;
        }
      }
      if (allHit) {
        // Check of dit schip net gezonken is (was niet volledig gezonken voorheen)
        var wasSunkBefore = true;
        for (var j = 0; j < ship.length; j++) {
          var key = ship[j][0] + ',' + ship[j][1];
          if (!previousHits.has(key)) {
            wasSunkBefore = false;
            break;
          }
        }
        if (!wasSunkBefore) {
          return ship.length; // Return lengte van gezonken schip
        }
      }
    }
    return null;
  }

  function computeZeeslagScore() {
    // Bereken score op basis van moeilijkheidsgraad en efficiency
    var base = 10;
    var diffBonus = (aiDifficulty === 'easy' ? 5 : aiDifficulty === 'hard' ? 25 : 15);
    // Bonus voor efficiency: minder shots = hogere score
    var totalShots = opponentBoard.shots.size;
    var totalShipCells = 0;
    for (var i = 0; i < opponentBoard.ships.length; i++) {
      totalShipCells += opponentBoard.ships[i].length;
    }
    var efficiencyBonus = Math.max(0, (totalShipCells * 2) - totalShots);
    return Math.round(base + diffBonus + efficiencyBonus);
  }

  function getRequiredShips() {
    const result = [];
    for (var i = 0; i < SHIPS.length; i++) {
      var length = SHIPS[i][0];
      var count = SHIPS[i][1];
      for (var j = 0; j < count; j++) {
        result.push(length);
      }
    }
    return result.sort(function (a, b) { return b - a; });
  }

  function initBoard() {
    return {
      ships: [],
      shots: new Set(),
      hits: new Set(),
    };
  }

  function deserializeBoard(data) {
    if (!data) return initBoard();
    return {
      ships: data.ships || [],
      shots: new Set(data.shots || []),
      hits: new Set(data.hits || []),
    };
  }

  function isValidShipPlacement(board, shipCells) {
    for (var i = 0; i < shipCells.length; i++) {
      var r = shipCells[i][0], c = shipCells[i][1];
      if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return false;
    }
    var occupied = new Set();
    for (var i = 0; i < board.ships.length; i++) {
      for (var j = 0; j < board.ships[i].length; j++) {
        var r = board.ships[i][j][0], c = board.ships[i][j][1];
        occupied.add(r + ',' + c);
      }
    }
    for (var i = 0; i < shipCells.length; i++) {
      var r = shipCells[i][0], c = shipCells[i][1];
      if (occupied.has(r + ',' + c)) return false;
    }
    var adjacent = new Set();
    for (var i = 0; i < board.ships.length; i++) {
      for (var j = 0; j < board.ships[i].length; j++) {
        var r = board.ships[i][j][0], c = board.ships[i][j][1];
        adjacent.add((r - 1) + ',' + c);
        adjacent.add((r + 1) + ',' + c);
        adjacent.add(r + ',' + (c - 1));
        adjacent.add(r + ',' + (c + 1));
      }
    }
    for (var i = 0; i < shipCells.length; i++) {
      var r = shipCells[i][0], c = shipCells[i][1];
      if (adjacent.has(r + ',' + c)) return false;
    }
    return true;
  }

  function setupSocketListeners() {
    if (!socket) return;
    socket.off('setNameOk');
    socket.off('lobby');
    socket.off('invite');
    socket.off('gameStart');
    socket.off('gameState');
    socket.off('chat');
    socket.off('opponentLeft');
    socket.off('youLeftRoom');
    socket.off('inviteFailed');
    socket.off('inviteDeclined');
    socket.on('setNameOk', function () { socket.emit('getLobby'); render(); });
    socket.on('lobby', function (list) { lobbyList = list || []; render(); });
    socket.on('invite', function (data) {
      pendingInviteFrom = { fromId: data.fromId, fromName: data.fromName || 'Speler' };
      render();
    });
    socket.on('gameStart', function (data) {
      roomId = data.roomId;
      myBoard = deserializeBoard(data.myBoard);
      opponentBoard = initBoard();
      mySide = data.youAre;
      opponentName = data.opponentName || 'Tegenstander';
      chatMessages = data.chat || [];
      currentPlayer = P1;
      winner = null;
      gameOver = false;
      placementPhase = true;
      currentShipIndex = 0;
      selectedShip = null;
      lastSunkShipMessage = null;
      previousOpponentHits = new Set();
      step = 'play';
      render();
    });
    socket.on('gameState', function (data) {
      var wasPlacementPhase = placementPhase;
      var wasMyTurn = currentPlayer === mySide;
      var previousOpponentShots = new Set(opponentBoard.shots);
      var previousOpponentHits = new Set(opponentBoard.hits);
      var previousMyHits = new Set(myBoard.hits);
      myBoard = deserializeBoard(data.myBoard) || myBoard;
      opponentBoard = deserializeBoard(data.opponentBoard) || opponentBoard;
      currentPlayer = data.currentPlayer;
      placementPhase = data.placementPhase !== undefined ? data.placementPhase : placementPhase;
      winner = data.winner != null ? data.winner : null;
      gameOver = winner !== null;
      // Speel geluidjes bij shooting fase - check of er nieuwe shots zijn op opponentBoard (speler schiet)
      if (!placementPhase && !wasPlacementPhase) {
        // Check of er nieuwe shots zijn toegevoegd (speler heeft geschoten)
        var newShots = [];
        opponentBoard.shots.forEach(function(key) {
          if (!previousOpponentShots.has(key)) {
            newShots.push(key);
          }
        });
        if (newShots.length > 0) {
          // Laatste shot is het meest recente
          var lastShotKey = newShots[newShots.length - 1];
          var isHit = opponentBoard.hits.has(lastShotKey);
          if (isHit) {
            playHitSound();
            // Check of er een schip gezonken is
            var sunkShipLength = checkShipSunk(opponentBoard, previousOpponentHits);
            if (sunkShipLength) {
              playSunkSound();
              lastSunkShipMessage = 'Schip van ' + sunkShipLength + ' vakjes gezonken!';
              setTimeout(function() { lastSunkShipMessage = null; render(); }, 3000);
            }
          } else {
            playMissSound();
          }
        }
        // Check of computer/tegenstander heeft geschoten op mijn bord
        var newMyShots = [];
        myBoard.shots.forEach(function(key) {
          if (!previousMyHits.has(key) && myBoard.hits.has(key)) {
            newMyShots.push(key);
          }
        });
        if (newMyShots.length > 0) {
          // Tegenstander heeft raak geschoten op mijn bord
          playHitSound();
          var sunkMyShipLength = checkShipSunk(myBoard, previousMyHits);
          if (sunkMyShipLength) {
            playSunkSound();
            lastSunkShipMessage = 'Jouw schip van ' + sunkMyShipLength + ' vakjes is gezonken!';
            setTimeout(function() { lastSunkShipMessage = null; render(); }, 3000);
          }
        }
      }
      render();
    });
    socket.on('chat', function (msg) { chatMessages.push(msg); render(); });
    socket.on('opponentLeft', function () {
      roomId = null; step = 'mp-lobby'; opponentName = ''; mySide = null; chatMessages = [];
      render();
    });
    socket.on('youLeftRoom', function () { roomId = null; step = 'mp-lobby'; render(); });
    socket.on('inviteFailed', function () { pendingInviteFrom = null; render(); });
    socket.on('inviteDeclined', function () { pendingInviteFrom = null; render(); });
  }

  function renderMyBoard() {
    var html = '<div class="zeeslag-board"><div class="zeeslag-board-label">Jouw vloot</div>';
    // Bepaal welke cellen deel uitmaken van welk schip
    var shipMap = {};
    for (var i = 0; i < myBoard.ships.length; i++) {
      var ship = myBoard.ships[i];
      var isHorizontal = ship.length > 1 && ship[0][0] === ship[1][0];
      for (var j = 0; j < ship.length; j++) {
        var key = ship[j][0] + ',' + ship[j][1];
        shipMap[key] = { shipIndex: i, position: j, length: ship.length, horizontal: isHorizontal };
      }
    }
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var cellClass = 'zeeslag-cell';
        var key = r + ',' + c;
        var shipInfo = shipMap[key];
        var hasShip = !!shipInfo;
        var isShot = myBoard.shots.has(key);
        var isHit = myBoard.hits.has(key);
        var shipIcon = '';
        if (hasShip && !isHit) {
          cellClass += ' zeeslag-ship';
          // Voeg boot icon toe
          var isFirst = shipInfo.position === 0;
          var isLast = shipInfo.position === shipInfo.length - 1;
          if (shipInfo.horizontal) {
          if (isFirst) {
            shipIcon = '<svg class="zeeslag-ship-icon" viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="0" y="30" width="100" height="40" fill="#8d6e63" stroke="#5d4037" stroke-width="2" rx="3"/><polygon points="0,50 0,30 -15,40 -15,60 0,50" fill="#6d4c41"/><rect x="10" y="35" width="80" height="30" fill="#a1887f"/><circle cx="50" cy="50" r="8" fill="#90caf9" opacity="0.6"/></svg>';
          } else if (isLast) {
            shipIcon = '<svg class="zeeslag-ship-icon" viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="0" y="30" width="100" height="40" fill="#8d6e63" stroke="#5d4037" stroke-width="2" rx="3"/><rect x="10" y="35" width="80" height="30" fill="#a1887f"/><circle cx="50" cy="50" r="8" fill="#90caf9" opacity="0.6"/></svg>';
          } else {
            shipIcon = '<svg class="zeeslag-ship-icon" viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="0" y="30" width="100" height="40" fill="#8d6e63" stroke="#5d4037" stroke-width="2" rx="3"/><rect x="10" y="35" width="80" height="30" fill="#a1887f"/><circle cx="50" cy="50" r="8" fill="#90caf9" opacity="0.6"/></svg>';
          }
          } else {
          if (isFirst) {
            shipIcon = '<svg class="zeeslag-ship-icon" viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="30" y="0" width="40" height="100" fill="#8d6e63" stroke="#5d4037" stroke-width="2" rx="3"/><polygon points="50,0 30,0 40,-15 60,-15 50,0" fill="#6d4c41"/><rect x="35" y="10" width="30" height="80" fill="#a1887f"/><circle cx="50" cy="50" r="8" fill="#90caf9" opacity="0.6"/></svg>';
          } else if (isLast) {
            shipIcon = '<svg class="zeeslag-ship-icon" viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="30" y="0" width="40" height="100" fill="#8d6e63" stroke="#5d4037" stroke-width="2" rx="3"/><rect x="35" y="10" width="30" height="80" fill="#a1887f"/><circle cx="50" cy="50" r="8" fill="#90caf9" opacity="0.6"/></svg>';
          } else {
            shipIcon = '<svg class="zeeslag-ship-icon" viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="30" y="0" width="40" height="100" fill="#8d6e63" stroke="#5d4037" stroke-width="2" rx="3"/><rect x="35" y="10" width="30" height="80" fill="#a1887f"/><circle cx="50" cy="50" r="8" fill="#90caf9" opacity="0.6"/></svg>';
          }
          }
        }
        if (isHit) cellClass += ' zeeslag-hit';
        else if (isShot) cellClass += ' zeeslag-miss';
        var dataAttrs = 'data-r="' + r + '" data-c="' + c + '" data-board="my"';
        if (hasShip) {
          dataAttrs += ' data-ship-index="' + shipInfo.shipIndex + '"';
          if (selectedShipIndex === shipInfo.shipIndex) {
            cellClass += ' zeeslag-ship-selected';
          }
        }
        html += '<div class="' + cellClass + '" ' + dataAttrs + '>' + shipIcon + '</div>';
      }
    }
    html += '</div>';
    return html;
  }

  function renderOpponentBoard() {
    var html = '<div class="zeeslag-board"><div class="zeeslag-board-label">Tegenstander</div>';
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var cellClass = 'zeeslag-cell';
        var key = r + ',' + c;
        var isShot = opponentBoard.shots.has(key);
        var isHit = opponentBoard.hits.has(key);
        if (isHit) cellClass += ' zeeslag-hit';
        else if (isShot) cellClass += ' zeeslag-miss';
        html += '<div class="' + cellClass + '" data-r="' + r + '" data-c="' + c + '" data-board="opponent"></div>';
      }
    }
    html += '</div>';
    return html;
  }

  function onCellClick(r, c, boardType) {
    if (gameOver) return;
    if (mode === 'multiplayer' && currentPlayer !== mySide) return;
    if (mode === 'multiplayer' && !socket) return;

    if (placementPhase) {
      if (boardType !== 'my') return;
      if (!selectedShip) return;
      var shipCells = [];
      var length = selectedShip.length;
      if (selectedShip.horizontal) {
        if (c + length > SIZE) return;
        for (var i = 0; i < length; i++) shipCells.push([r, c + i]);
      } else {
        if (r + length > SIZE) return;
        for (var i = 0; i < length; i++) shipCells.push([r + i, c]);
      }
      if (!isValidShipPlacement(myBoard, shipCells)) return;
      // Als er een schip geselecteerd is voor verplaatsen, verwijder het eerst
      if (selectedShipIndex !== null && selectedShipIndex < myBoard.ships.length) {
        // Sla op voor undo
        placementHistory.push({
          ships: myBoard.ships.map(function(s) { return s.map(function(c) { return [c[0], c[1]]; }); }),
          shipIndex: currentShipIndex
        });
        myBoard.ships.splice(selectedShipIndex, 1);
        currentShipIndex--;
        selectedShipIndex = null;
      } else {
        // Sla huidige staat op voor undo
        placementHistory.push({
          ships: myBoard.ships.map(function(s) { return s.map(function(c) { return [c[0], c[1]]; }); }),
          shipIndex: currentShipIndex
        });
      }
      myBoard.ships.push(shipCells);
      currentShipIndex++;
      var required = getRequiredShips();
      if (currentShipIndex >= required.length) {
        placementPhase = false;
        if (mode === 'multiplayer') {
          socket.emit('move', { type: 'placeDone' });
        } else if (mode === '1vAI') {
          // In 1vAI mode: speler begint altijd eerst
          currentPlayer = P1;
        }
      }
      selectedShip = null;
      selectedShipIndex = null;
      render();
    } else {
      if (boardType !== 'opponent') return;
      var key = r + ',' + c;
      if (opponentBoard.shots.has(key)) return;
      if (mode === 'multiplayer' && socket) {
        socket.emit('move', { type: 'shoot', r: r, c: c });
        // Geluidjes worden afgespeeld via gameState event
      } else if (mode === '1vAI') {
        // Speler schiet op AI's bord
        opponentBoard.shots.add(key);
        var hit = false;
        // Check AI's bord (opponentBoard heeft de schepen)
        var previousHits = new Set(opponentBoard.hits);
        for (var i = 0; i < opponentBoard.ships.length; i++) {
          for (var j = 0; j < opponentBoard.ships[i].length; j++) {
            if (opponentBoard.ships[i][j][0] === r && opponentBoard.ships[i][j][1] === c) {
              hit = true;
              opponentBoard.hits.add(key);
              playHitSound();
              // Check of schip gezonken is
              var sunkShipLength = checkShipSunk(opponentBoard, previousHits);
              if (sunkShipLength) {
                playSunkSound();
                lastSunkShipMessage = 'Schip van ' + sunkShipLength + ' vakjes gezonken!';
                setTimeout(function() { lastSunkShipMessage = null; render(); }, 3000);
              }
              break;
            }
          }
          if (hit) break;
        }
        if (!hit) {
          playMissSound();
        }
        // Check win (speler wint als alle AI schepen geraakt zijn)
        var totalCells = 0;
        for (var i = 0; i < opponentBoard.ships.length; i++) {
          totalCells += opponentBoard.ships[i].length;
        }
        if (opponentBoard.hits.size >= totalCells) {
          winner = P1;
          gameOver = true;
          // Toon score formulier
          if (mode === '1vAI' && leaderboardEl && winner === P1) {
            var score = computeZeeslagScore();
            setTimeout(function() {
              window.Leaderboard.showSubmitForm(CLASS_ID, score, function () {
                if (window.Leaderboard && leaderboardEl) window.Leaderboard.render(leaderboardEl, CLASS_ID);
              });
            }, 1000);
          }
        } else {
          currentPlayer = P2;
          // Laat AI schieten na korte delay
          setTimeout(function() {
            aiShoot();
          }, 800);
        }
        render();
      }
    }
  }

  function placeAIShips() {
    // Plaats AI schepen automatisch
    var required = getRequiredShips();
    aiBoard.ships = [];
    for (var i = 0; i < required.length; i++) {
      var length = required[i];
      var placed = false;
      var attempts = 0;
      while (!placed && attempts < 100) {
        attempts++;
        var horizontal = Math.random() < 0.5;
        var r = Math.floor(Math.random() * SIZE);
        var c = Math.floor(Math.random() * SIZE);
        var shipCells = [];
        if (horizontal) {
          if (c + length > SIZE) continue;
          for (var j = 0; j < length; j++) shipCells.push([r, c + j]);
        } else {
          if (r + length > SIZE) continue;
          for (var j = 0; j < length; j++) shipCells.push([r + j, c]);
        }
        if (isValidShipPlacement(aiBoard, shipCells)) {
          aiBoard.ships.push(shipCells);
          placed = true;
        }
      }
    }
    // Kopieer AI schepen naar opponentBoard voor weergave (maar niet zichtbaar tijdens gameplay)
    opponentBoard = { ships: aiBoard.ships.map(function(s) { return s.map(function(c) { return [c[0], c[1]]; }); }), shots: new Set(), hits: new Set() };
  }

  function aiShoot() {
    if (gameOver || currentPlayer !== P2 || mode !== '1vAI') return;
    
    // Bounds checking helper
    function isValidShot(r, c) {
      return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
    }
    
    // Kies een vakje dat nog niet is beschoten op mijn bord
    var shot = null;
    
    if (aiDifficulty === 'easy') {
      // Easy: volledig willekeurig
      var availableShots = [];
      for (var r = 0; r < SIZE; r++) {
        for (var c = 0; c < SIZE; c++) {
          var key = r + ',' + c;
          if (!myBoard.shots.has(key)) {
            availableShots.push([r, c]);
          }
        }
      }
      if (availableShots.length === 0) return;
      shot = availableShots[Math.floor(Math.random() * availableShots.length)];
    } else {
      // Normal/Hard: intelligent targeting
      if (aiHuntMode && aiLastHit) {
        // We hebben een hit maar het schip is nog niet gezonken - zoek verder
        var lastR = aiLastHit[0], lastC = aiLastHit[1];
        var directions = [[0, 1], [0, -1], [1, 0], [-1, 0]]; // rechts, links, onder, boven
        
        if (aiHuntDirection) {
          // We zijn al een richting aan het volgen
          var dir = aiHuntDirection;
          var nextR = lastR + dir[0], nextC = lastC + dir[1];
          if (isValidShot(nextR, nextC)) {
            var nextKey = nextR + ',' + nextC;
            if (!myBoard.shots.has(nextKey)) {
              shot = [nextR, nextC];
            } else if (myBoard.hits.has(nextKey)) {
              // Nog een hit in deze richting, ga verder
              aiLastHit = [nextR, nextC];
              var furtherR = nextR + dir[0], furtherC = nextC + dir[1];
              if (isValidShot(furtherR, furtherC)) {
                var furtherKey = furtherR + ',' + furtherC;
                if (!myBoard.shots.has(furtherKey)) {
                  shot = [furtherR, furtherC];
                }
              }
            } else {
              // Miss in deze richting, probeer andere richting
              aiHuntDirection = null;
              aiLastHit = aiHuntStartPos;
            }
          } else {
            // Buiten grenzen, probeer andere richting
            aiHuntDirection = null;
            aiLastHit = aiHuntStartPos;
          }
        }
        
        // Als we nog geen shot hebben, probeer aangrenzende cellen
        if (!shot) {
          var candidates = [];
          for (var i = 0; i < directions.length; i++) {
            var dir = directions[i];
            var testR = lastR + dir[0], testC = lastC + dir[1];
            if (isValidShot(testR, testC)) {
              var testKey = testR + ',' + testC;
              if (!myBoard.shots.has(testKey)) {
                candidates.push([testR, testC, dir]);
              }
            }
          }
          if (candidates.length > 0) {
            var chosen = candidates[Math.floor(Math.random() * candidates.length)];
            shot = [chosen[0], chosen[1]];
            aiHuntDirection = [chosen[2][0], chosen[2][1]];
            if (!aiHuntStartPos) aiHuntStartPos = aiLastHit;
          }
        }
      }
      
      // Als we nog geen shot hebben, gebruik random
      if (!shot) {
        var availableShots = [];
        for (var r = 0; r < SIZE; r++) {
          for (var c = 0; c < SIZE; c++) {
            if (isValidShot(r, c)) {
              var key = r + ',' + c;
              if (!myBoard.shots.has(key)) {
                availableShots.push([r, c]);
              }
            }
          }
        }
        if (availableShots.length === 0) return;
        shot = availableShots[Math.floor(Math.random() * availableShots.length)];
      }
    }
    
    if (!shot) return;
    var r = shot[0], c = shot[1];
    // Harde bounds clamp: nooit buiten 0 .. SIZE-1
    r = Math.max(0, Math.min(SIZE - 1, r));
    c = Math.max(0, Math.min(SIZE - 1, c));
    if (!isValidShot(r, c)) {
      console.error('AI shot out of bounds (clamped):', shot[0], shot[1], '->', r, c);
      return;
    }
    var key = r + ',' + c;
    if (myBoard.shots.has(key)) return; // al beschoten, skip (voorkom dubbele shot)
    myBoard.shots.add(key);
    var hit = false;
    var previousHits = new Set(myBoard.hits);
    // Check of er een schip is geraakt op mijn bord
    for (var i = 0; i < myBoard.ships.length; i++) {
      for (var j = 0; j < myBoard.ships[i].length; j++) {
        if (myBoard.ships[i][j][0] === r && myBoard.ships[i][j][1] === c) {
          hit = true;
          myBoard.hits.add(key);
          playHitSound();
          
          // Update AI targeting state
          if (aiDifficulty !== 'easy') {
            if (!aiHuntMode) {
              // Eerste hit op dit schip
              aiHuntMode = true;
              aiLastHit = [r, c];
              aiHuntStartPos = [r, c];
              aiHuntDirection = null;
            } else {
              // Nog een hit op hetzelfde schip
              aiLastHit = [r, c];
            }
          }
          
          // Check of schip gezonken is
          var sunkShipLength = checkShipSunk(myBoard, previousHits);
          if (sunkShipLength) {
            playSunkSound();
            lastSunkShipMessage = 'Jouw schip van ' + sunkShipLength + ' vakjes is gezonken!';
            setTimeout(function() { lastSunkShipMessage = null; render(); }, 3000);
            // Reset AI hunt mode
            if (aiDifficulty !== 'easy') {
              aiHuntMode = false;
              aiLastHit = null;
              aiHuntDirection = null;
              aiHuntStartPos = null;
            }
          }
          break;
        }
      }
      if (hit) break;
    }
    if (!hit) {
      playMissSound();
      // Bij miss in hunt mode, probeer andere richting
      if (aiDifficulty !== 'easy' && aiHuntMode && aiHuntDirection) {
        aiHuntDirection = null;
        aiLastHit = aiHuntStartPos;
      }
    }
    // Check win
    var totalCells = 0;
    for (var i = 0; i < myBoard.ships.length; i++) {
      totalCells += myBoard.ships[i].length;
    }
    if (myBoard.hits.size >= totalCells) {
      winner = P2;
      gameOver = true;
    } else {
      currentPlayer = P1;
    }
    render();
  }

  function render() {
    if (mode === null) {
      var guidance = window.RegenboogCore && window.RegenboogCore.introGuidance && window.RegenboogCore.introGuidance.zeeslag;
      var cardLines = '';
      if (guidance && guidance.length) {
        cardLines = '<p><strong>Hoe te spelen:</strong></p><ul>' +
          guidance.map(function (line) {
            return '<li class="core-intro-step">🎯 ' + escapeHtml(line) + '</li>';
          }).join('') + '</ul>';
      } else {
        cardLines = '<p><strong>Hoe te spelen:</strong></p><ul>' +
          '<li class="core-intro-step">🚢 Plaats je schepen (5, 4, 3, 3, 2 vakjes lang)</li>' +
          '<li class="core-intro-step">🎯 Schiet op vakjes van je tegenstander</li>' +
          '<li class="core-intro-step">🏆 Win door alle schepen te raken</li></ul>';
      }
      area.innerHTML =
        '<div class="core-intro">' +
        '  <h3 class="core-intro-title">Zeeslag</h3>' +
        '  <p class="core-intro-subtitle">Strategisch schietspel: vind en vernietig de vloot van je tegenstander.</p>' +
        '  <div class="core-intro-card">' + cardLines + '</div>' +
        '  <div class="core-intro-actions dammen-mode-actions">' +
        '    <p class="dammen-choose-mode">Kies hoe je wilt spelen:</p>' +
        '    <div class="dammen-mode-buttons">' +
        '      <button type="button" class="dammen-mode-btn" data-mode="1vAI">1 tegen computer</button>' +
        '      <button type="button" class="dammen-mode-btn" data-mode="multiplayer">1 tegen 1 (over internet)</button>' +
        '    </div>' +
        '  </div>' +
        '</div>';
      area.querySelectorAll('.dammen-mode-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          mode = btn.getAttribute('data-mode');
          if (mode === 'multiplayer') {
            step = 'mp-name';
          } else {
            step = 'difficulty';
          }
          render();
        });
      });
      if (window.Leaderboard && leaderboardEl) window.Leaderboard.render(leaderboardEl, CLASS_ID);
      return;
    }

    if (mode === 'multiplayer' && step === 'mp-name') {
      area.innerHTML =
        '<p class="dammen-instruction">Voer je naam in voor de speelzaal.</p>' +
        '<div class="dammen-name-form">' +
        '<input type="text" id="dammen-player-name" class="dammen-name-input" placeholder="Jouw naam" maxlength="30" value="' + (myName ? myName.replace(/"/g, '&quot;') : '') + '">' +
        '<button type="button" class="dammen-mode-btn" id="dammen-name-ok">Ga naar speelzaal</button>' +
        '</div>' +
        '<button type="button" class="dammen-back" id="dammen-mp-back">Terug</button>';
      document.getElementById('dammen-name-ok').addEventListener('click', function () {
        var input = document.getElementById('dammen-player-name');
        myName = input && input.value ? input.value.trim().slice(0, 30) : '';
        if (!myName) myName = 'Speler';
        step = 'mp-lobby';
        if (socket) socket.disconnect();
        socket = (typeof io !== 'undefined' && io) ? io('/zeeslag') : null;
        if (!socket) {
          step = 'mp-name';
          render();
          return;
        }
        setupSocketListeners();
        socket.emit('setName', myName);
        render();
      });
      document.getElementById('dammen-mp-back').addEventListener('click', function () {
        mode = null; step = null;
        if (socket) { socket.disconnect(); socket = null; }
        render();
      });
      return;
    }

    if (mode === 'multiplayer' && step === 'mp-lobby') {
      var listHtml = lobbyList.filter(function (u) { return u.id !== (socket && socket.id) && u.name; }).map(function (u) {
        return '<div class="dammen-lobby-user"><span class="dammen-lobby-name">' + escapeHtml(u.name) + '</span><button type="button" class="dammen-invite-btn" data-id="' + escapeHtml(u.id) + '">Nodig uit</button></div>';
      }).join('') || '<p class="dammen-lobby-empty">Niemand anders online.</p>';
      var inviteHtml = pendingInviteFrom
        ? '<div class="dammen-invite-overlay"><p>' + escapeHtml(pendingInviteFrom.fromName) + ' nodigt je uit.</p><button type="button" class="dammen-accept-btn" id="dammen-accept">Accepteer</button><button type="button" class="dammen-decline-btn" id="dammen-decline">Weiger</button></div>' : '';
      area.innerHTML = '<p class="dammen-instruction">Speelzaal</p><div class="dammen-lobby-list">' + listHtml + '</div>' + inviteHtml + '<button type="button" class="dammen-back" id="dammen-lobby-back">Terug</button>';
      area.querySelectorAll('.dammen-invite-btn').forEach(function (btn) {
        btn.addEventListener('click', function () { var id = btn.getAttribute('data-id'); if (socket && id) socket.emit('invite', id); });
      });
      if (pendingInviteFrom) {
        document.getElementById('dammen-accept').addEventListener('click', function () {
          if (socket && pendingInviteFrom) socket.emit('acceptInvite', pendingInviteFrom.fromId);
          pendingInviteFrom = null;
        });
        document.getElementById('dammen-decline').addEventListener('click', function () {
          if (socket && pendingInviteFrom) socket.emit('declineInvite', pendingInviteFrom.fromId);
          pendingInviteFrom = null;
          render();
        });
      }
      document.getElementById('dammen-lobby-back').addEventListener('click', function () {
        step = 'mp-name';
        if (socket) { socket.disconnect(); socket = null; }
        lobbyList = []; pendingInviteFrom = null;
        render();
      });
      return;
    }

    if (mode === '1vAI' && step === 'difficulty') {
      area.innerHTML =
        '<p class="dammen-instruction">Kies de moeilijkheid.</p>' +
        '<div class="dammen-difficulty-buttons">' +
        '<button type="button" class="dammen-difficulty-btn" data-diff="easy">Makkelijk</button>' +
        '<button type="button" class="dammen-difficulty-btn" data-diff="normal">Normaal</button>' +
        '<button type="button" class="dammen-difficulty-btn" data-diff="hard">Moeilijk</button>' +
        '</div><button type="button" class="dammen-back" id="dammen-diff-back">Terug</button>';
      area.querySelectorAll('.dammen-difficulty-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          aiDifficulty = btn.getAttribute('data-diff') || 'normal';
          step = 'play';
          myBoard = initBoard();
          opponentBoard = initBoard();
          aiBoard = initBoard(); // AI's eigen bord
          // Reset AI state
          aiLastHit = null;
          aiHuntMode = false;
          aiHuntDirection = null;
          aiHuntStartPos = null;
          // Plaats AI schepen automatisch
          placeAIShips();
          currentPlayer = P1;
          placementPhase = true;
          currentShipIndex = 0;
          gameOver = false;
          winner = null;
          selectedShip = null;
          render();
        });
      });
      document.getElementById('dammen-diff-back').addEventListener('click', function () { mode = null; step = null; render(); });
      return;
    }

    var turnText = '';
    var winnerHtml = '';
    
    if (gameOver && winner !== null && mode === 'multiplayer') {
      // Toon winnaar scherm voor multiplayer (1vAI heeft eigen melding + leaderboard)
      if (window.RegenboogCore && window.RegenboogCore.showWinnerScreen) {
        var winnerName1 = mySide === P1 ? 'Jij' : opponentName;
        var winnerName2 = mySide === P2 ? 'Jij' : opponentName;
        winnerHtml = window.RegenboogCore.showWinnerScreen(winner, mode, {
          player1Name: winnerName1,
          player2Name: winnerName2,
          mySide: mySide,
          opponentName: opponentName
        });
      }
      turnText = winner === mySide ? 'Jij wint!' : opponentName + ' wint!';
    } else {
      turnText = gameOver
        ? (mode === '1vAI'
            ? (winner === P1 ? 'Jij wint!' : 'Computer wint!')
            : (winner === mySide ? 'Jij wint!' : opponentName + ' wint!'))
        : placementPhase
          ? (currentShipIndex < getRequiredShips().length ? 'Plaats je schepen (' + (currentShipIndex + 1) + '/' + getRequiredShips().length + ')' : 'Wacht op tegenstander...')
          : mode === 'multiplayer'
            ? (currentPlayer === mySide ? 'Jij bent aan zet' : opponentName + ' is aan zet')
            : (currentPlayer === P1 ? 'Jij bent aan zet' : 'Computer is aan zet...');
    }
    
    var sunkMessageHtml = '';
    if (lastSunkShipMessage) {
      sunkMessageHtml = '<div class="zeeslag-sunk-message">' + escapeHtml(lastSunkShipMessage) + '</div>';
    }

    var chatHtml = '';
    if (mode === 'multiplayer') {
      var chatList = chatMessages.map(function (msg) { return '<div class="dammen-chat-msg"><strong>' + escapeHtml(msg.name) + '</strong>: ' + escapeHtml(msg.text) + '</div>'; }).join('');
      chatHtml = '<div class="dammen-chat-panel"><div class="dammen-chat-title">Chat – ' + escapeHtml(opponentName) + '</div><div class="dammen-chat-messages" id="dammen-chat-msgs">' + chatList + '</div><div class="dammen-chat-input-wrap"><input type="text" class="dammen-chat-input" id="dammen-chat-input" placeholder="Bericht…" maxlength="500"><button type="button" class="dammen-chat-send" id="dammen-chat-send">Verstuur</button></div></div>';
    }

    var boardsHtml = '';
    if (placementPhase && (mode !== 'multiplayer' || !roomId || currentShipIndex < getRequiredShips().length)) {
      boardsHtml = '<div class="zeeslag-boards-wrap">' + renderMyBoard() + '</div>';
    } else {
      boardsHtml = '<div class="zeeslag-boards-wrap">' + renderMyBoard() + renderOpponentBoard() + '</div>';
    }
    var placementHtml = '';
    if (placementPhase) {
      var required = getRequiredShips();
      var controlsHtml = '';
      var previewHtml = '';
      if (currentShipIndex < required.length) {
        var currentLength = required[currentShipIndex];
        // Preview van geselecteerd schip (bouwen voor we de sectie maken)
        if (selectedShip && selectedShip.length === currentLength) {
          var previewSize = Math.max(selectedShip.length, 3);
          if (selectedShip.horizontal) {
            var shipIcon = selectedShip.length >= 4
              ? '<svg class="zeeslag-ship-icon" viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="0" y="30" width="100" height="40" fill="#8d6e63" stroke="#5d4037" stroke-width="2" rx="3"/><polygon points="0,50 0,30 -15,40 -15,60 0,50" fill="#6d4c41"/><rect x="10" y="35" width="80" height="30" fill="#a1887f"/><circle cx="50" cy="50" r="8" fill="#90caf9" opacity="0.6"/></svg>'
              : '<svg class="zeeslag-ship-icon" viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="0" y="30" width="100" height="40" fill="#8d6e63" stroke="#5d4037" stroke-width="2" rx="3"/><rect x="10" y="35" width="80" height="30" fill="#a1887f"/><circle cx="50" cy="50" r="8" fill="#90caf9" opacity="0.6"/></svg>';
            previewHtml = '<div class="zeeslag-ship-preview">' +
              '<p class="zeeslag-preview-title">Preview</p>' +
              '<div class="zeeslag-preview-grid zeeslag-preview-h" style="grid-template-columns: repeat(' + previewSize + ', 1fr);">';
            for (var r = 0; r < 3; r++) {
              for (var c = 0; c < previewSize; c++) {
                if (r === 1 && c < selectedShip.length) {
                  previewHtml += '<div class="zeeslag-preview-cell zeeslag-preview-ship">' + shipIcon + '</div>';
                } else {
                  previewHtml += '<div class="zeeslag-preview-cell"></div>';
                }
              }
            }
            previewHtml += '</div><p class="zeeslag-preview-label">Horizontaal (' + selectedShip.length + ' vakjes)</p></div>';
          } else {
            var shipIconVertical = selectedShip.length >= 4
              ? '<svg class="zeeslag-ship-icon" viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="30" y="0" width="40" height="100" fill="#8d6e63" stroke="#5d4037" stroke-width="2" rx="3"/><polygon points="50,0 30,0 40,-15 60,-15 50,0" fill="#6d4c41"/><rect x="35" y="10" width="30" height="80" fill="#a1887f"/><circle cx="50" cy="50" r="8" fill="#90caf9" opacity="0.6"/></svg>'
              : '<svg class="zeeslag-ship-icon" viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="30" y="0" width="40" height="100" fill="#8d6e63" stroke="#5d4037" stroke-width="2" rx="3"/><rect x="35" y="10" width="30" height="80" fill="#a1887f"/><circle cx="50" cy="50" r="8" fill="#90caf9" opacity="0.6"/></svg>';
            previewHtml = '<div class="zeeslag-ship-preview">' +
              '<p class="zeeslag-preview-title">Preview</p>' +
              '<div class="zeeslag-preview-grid zeeslag-preview-v" style="grid-template-columns: repeat(3, 1fr);">';
            for (var r = 0; r < previewSize; r++) {
              for (var c = 0; c < 3; c++) {
                if (c === 1 && r < selectedShip.length) {
                  previewHtml += '<div class="zeeslag-preview-cell zeeslag-preview-ship">' + shipIconVertical + '</div>';
                } else {
                  previewHtml += '<div class="zeeslag-preview-cell"></div>';
                }
              }
            }
            previewHtml += '</div><p class="zeeslag-preview-label">Verticaal (' + selectedShip.length + ' vakjes)</p></div>';
          }
        }
        // Sectie: richtingkeuze + preview naast elkaar (1 geheel)
        controlsHtml = '<div class="zeeslag-placement-section">' +
          '<div class="zeeslag-placement">' +
          '<p>Kies richting voor schip van ' + currentLength + ' vakjes:</p>' +
          '<button type="button" class="zeeslag-ship-btn" id="zeeslag-horizontal">Horizontaal ↔</button>' +
          '<button type="button" class="zeeslag-ship-btn" id="zeeslag-vertical">Verticaal ↕</button>' +
          '</div>' +
          (previewHtml ? previewHtml : '') +
          '</div>';
      }
      // Placement controls: undo, clear, rotate, move
      var placementControlsHtml = '<div class="zeeslag-placement-controls">' +
        '<button type="button" class="zeeslag-control-btn" id="zeeslag-undo" ' + (placementHistory.length === 0 ? 'disabled' : '') + '>↶ Ongedaan maken</button>' +
        '<button type="button" class="zeeslag-control-btn" id="zeeslag-clear" ' + (myBoard.ships.length === 0 ? 'disabled' : '') + '>🗑 Wis alles</button>' +
        '<button type="button" class="zeeslag-control-btn" id="zeeslag-rotate" ' + (selectedShipIndex === null ? 'disabled' : '') + '>↻ Draai schip</button>' +
        '<p class="zeeslag-hint">Tip: Klik op een geplaatst schip om het te selecteren voor draaien/verplaatsen</p>' +
        '</div>';
      placementHtml = controlsHtml + placementControlsHtml;
    }

    area.innerHTML =
      '<p class="dammen-instruction">' + turnText + '</p>' +
      winnerHtml +
      sunkMessageHtml +
      '<div class="dammen-play-wrap">' +
      boardsHtml +
      placementHtml +
      chatHtml +
      '</div>' +
      '<div class="dammen-actions">' +
      (mode === 'multiplayer' ? '<button type="button" class="dammen-back" id="dammen-leave-room">Verlaat spel</button>' : '<button type="button" class="dammen-again" id="dammen-new">Nieuw spel</button><button type="button" class="dammen-back" id="dammen-back">Andere spelmodus</button>') +
      '</div>';

    if (placementHtml) {
      if (document.getElementById('zeeslag-horizontal')) {
        document.getElementById('zeeslag-horizontal').addEventListener('click', function () {
          var required = getRequiredShips();
          selectedShip = { length: required[currentShipIndex], horizontal: true };
          render();
        });
      }
      if (document.getElementById('zeeslag-vertical')) {
        document.getElementById('zeeslag-vertical').addEventListener('click', function () {
          var required = getRequiredShips();
          selectedShip = { length: required[currentShipIndex], horizontal: false };
          render();
        });
      }
      // Undo knop
      if (document.getElementById('zeeslag-undo')) {
        document.getElementById('zeeslag-undo').addEventListener('click', function () {
          if (placementHistory.length === 0) return;
          var prev = placementHistory.pop();
          myBoard.ships = prev.ships.map(function(s) { return s.map(function(c) { return [c[0], c[1]]; }); });
          currentShipIndex = prev.shipIndex;
          selectedShip = null;
          selectedShipIndex = null;
          render();
        });
      }
      // Clear knop
      if (document.getElementById('zeeslag-clear')) {
        document.getElementById('zeeslag-clear').addEventListener('click', function () {
          if (confirm('Weet je zeker dat je alle schepen wilt wissen?')) {
            placementHistory = [];
            myBoard.ships = [];
            currentShipIndex = 0;
            selectedShip = null;
            selectedShipIndex = null;
            render();
          }
        });
      }
      // Rotate knop
      if (document.getElementById('zeeslag-rotate')) {
        document.getElementById('zeeslag-rotate').addEventListener('click', function () {
          if (selectedShipIndex === null || selectedShipIndex >= myBoard.ships.length) return;
          var ship = myBoard.ships[selectedShipIndex];
          if (ship.length === 0) return;
          var isHorizontal = ship.length > 1 && ship[0][0] === ship[1][0];
          var newShip = [];
          var baseR = ship[0][0];
          var baseC = ship[0][1];
          // Check of rotatie mogelijk is (past binnen bord)
          if (isHorizontal) {
            // Draai naar verticaal
            if (baseR + ship.length > SIZE) return;
            for (var i = 0; i < ship.length; i++) {
              newShip.push([baseR + i, baseC]);
            }
          } else {
            // Draai naar horizontaal
            if (baseC + ship.length > SIZE) return;
            for (var i = 0; i < ship.length; i++) {
              newShip.push([baseR, baseC + i]);
            }
          }
          // Check validiteit
          var tempBoard = { ships: myBoard.ships.filter(function(s, idx) { return idx !== selectedShipIndex; }) };
          if (!isValidShipPlacement(tempBoard, newShip)) return;
          // Sla op voor undo
          placementHistory.push({
            ships: myBoard.ships.map(function(s) { return s.map(function(c) { return [c[0], c[1]]; }); }),
            shipIndex: currentShipIndex
          });
          myBoard.ships[selectedShipIndex] = newShip;
          render();
        });
      }
    }

    area.querySelectorAll('.zeeslag-cell').forEach(function (cell) {
      cell.addEventListener('click', function () {
        var r = parseInt(cell.getAttribute('data-r'), 10);
        var c = parseInt(cell.getAttribute('data-c'), 10);
        var boardType = cell.getAttribute('data-board');
        var shipIndex = cell.getAttribute('data-ship-index');
        if (placementPhase && boardType === 'my' && shipIndex !== null && !selectedShip) {
          // Selecteer schip voor rotate/move
          selectedShipIndex = parseInt(shipIndex, 10);
          selectedShip = null;
          render();
          return;
        }
        onCellClick(r, c, boardType);
      });
    });

    if (mode === 'multiplayer') {
      var leaveBtn = document.getElementById('dammen-leave-room');
      if (leaveBtn) leaveBtn.addEventListener('click', function () {
        if (socket) socket.emit('leaveRoom');
        roomId = null; step = 'mp-lobby'; opponentName = ''; mySide = null; chatMessages = [];
        render();
      });
      var chatIn = document.getElementById('dammen-chat-input');
      var chatSend = document.getElementById('dammen-chat-send');
      var chatMsgs = document.getElementById('dammen-chat-msgs');
      if (chatSend && chatIn && socket) {
        function sendChat() { var t = chatIn.value.trim(); if (t) { socket.emit('chat', t); chatIn.value = ''; } }
        chatSend.addEventListener('click', sendChat);
        chatIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') sendChat(); });
      }
      if (chatMsgs) chatMsgs.scrollTop = chatMsgs.scrollHeight;
    } else {
      var newBtn = document.getElementById('dammen-new');
      if (newBtn) newBtn.addEventListener('click', function () {
        myBoard = initBoard();
        opponentBoard = initBoard();
        if (mode === '1vAI') {
          aiBoard = initBoard();
          // Reset AI state
          aiLastHit = null;
          aiHuntMode = false;
          aiHuntDirection = null;
          aiHuntStartPos = null;
          placeAIShips();
        }
        currentPlayer = P1;
        placementPhase = true;
        currentShipIndex = 0;
        gameOver = false;
        winner = null;
        selectedShip = null;
        placementHistory = [];
        selectedShipIndex = null;
        render();
      });
      var backBtn = document.getElementById('dammen-back');
      if (backBtn) backBtn.addEventListener('click', function () { mode = null; step = null; render(); });
    }
  }

  myBoard = initBoard();
  opponentBoard = initBoard();
  render();
  if (window.Leaderboard && leaderboardEl) window.Leaderboard.render(leaderboardEl, CLASS_ID);
})();
