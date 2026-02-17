/**
 * Reken-duel – 1 vs 1 (op dezelfde computer) of multiplayer (over internet).
 * 1v1: beide spelers krijgen afwisselend oefeningen, winnaar = snelste totale tijd.
 * Multiplayer: eerste met juiste antwoord krijgt punt, eerste tot 5 punten wint.
 */
(function () {
  const CLASS_ID = 'reken-duel';
  const area = document.getElementById('game-area');
  if (area) area.classList.add('reken-duel-game');
  const leaderboardEl = document.getElementById('leaderboard');
  const P1 = 1;
  const P2 = 2;
  const QUESTIONS_PER_PLAYER = 5; // Aantal oefeningen per speler bij 1v1

  const DIFFICULTY_CONFIG = {
    easy: { operations: ['+', '-'], minNum: 1, maxNum: 20, maxResult: 20, description: 'Optellen en aftrekken (resultaat < 20)' },
    normal: { operations: ['+', '-', '*'], minNum: 1, maxNum: 50, multMin: 2, multMax: 10, maxResult: 50, description: 'Optellen, aftrekken en vermenigvuldigen (resultaat < 50)' },
    hard: { operations: ['+', '-', '*', '/'], minNum: 10, maxNum: 100, multMin: 2, multMax: 12, maxResult: 100, description: 'Alle bewerkingen (resultaat < 100)' },
  };

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function generateQuestion(difficulty) {
    const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.normal;
    if (!config.operations || config.operations.length === 0) {
      config.operations = ['+'];
    }
    
    // Probeer een operatie te kiezen die niet recent gebruikt is (voor betere distributie)
    let availableOps = config.operations.slice();
    if (recentOperations.length > 0 && availableOps.length > 1) {
      // Filter recent gebruikte operaties eruit als er alternatieven zijn
      var filtered = availableOps.filter(function(op) {
        return recentOperations.indexOf(op) === -1;
      });
      if (filtered.length > 0) {
        availableOps = filtered;
      }
    }
    
    const operation = availableOps[Math.floor(Math.random() * availableOps.length)];
    let a, b, answer;
    let displayOp = operation; // Voor weergave

    var maxAttempts = 50; // Max aantal pogingen om een geldige vraag te genereren
    var attempts = 0;
    
    do {
      attempts++;
      switch (operation) {
        case '+':
          // Bij optellen: zorg dat a + b < maxResult
          if (config.maxResult) {
            // Genereer a en b zodat a + b < maxResult
            var maxA = Math.min(config.maxNum, config.maxResult - config.minNum);
            if (maxA < config.minNum) maxA = config.minNum;
            a = Math.floor(Math.random() * (maxA - config.minNum + 1)) + config.minNum;
            var maxB = Math.min(config.maxNum, config.maxResult - a);
            if (maxB < config.minNum) maxB = config.minNum;
            b = Math.floor(Math.random() * (maxB - config.minNum + 1)) + config.minNum;
          } else {
            a = Math.floor(Math.random() * (config.maxNum - config.minNum + 1)) + config.minNum;
            b = Math.floor(Math.random() * (config.maxNum - config.minNum + 1)) + config.minNum;
          }
          answer = a + b;
          displayOp = '+';
          break;
        case '-':
          // Bij aftrekken: zorg dat a - b >= 0 en a < maxResult (als maxResult bestaat)
          if (config.maxResult) {
            a = Math.floor(Math.random() * (config.maxResult - config.minNum + 1)) + config.minNum;
          } else {
            a = Math.floor(Math.random() * (config.maxNum - config.minNum + 1)) + config.minNum;
          }
          b = Math.floor(Math.random() * (a - config.minNum + 1)) + config.minNum;
          answer = a - b;
          displayOp = '−'; // Min-teken (Unicode)
          break;
        case '*':
          // Bij vermenigvuldigen: zorg dat a * b < maxResult
          if (config.maxResult) {
            // Genereer factoren zodat product < maxResult
            var maxFactor = Math.floor(Math.sqrt(config.maxResult));
            maxFactor = Math.min(maxFactor, config.multMax);
            maxFactor = Math.max(maxFactor, config.multMin);
            a = Math.floor(Math.random() * (maxFactor - config.multMin + 1)) + config.multMin;
            var maxBForMult = Math.floor(config.maxResult / a);
            maxBForMult = Math.min(maxBForMult, config.multMax);
            maxBForMult = Math.max(maxBForMult, config.multMin);
            b = Math.floor(Math.random() * (maxBForMult - config.multMin + 1)) + config.multMin;
          } else {
            a = Math.floor(Math.random() * (config.multMax - config.multMin + 1)) + config.multMin;
            b = Math.floor(Math.random() * (config.multMax - config.multMin + 1)) + config.multMin;
          }
          answer = a * b;
          displayOp = '×'; // Maal-teken (Unicode)
          break;
        case '/':
          // Bij delen: zorg dat quotient * b < maxResult
          if (config.maxResult) {
            b = Math.floor(Math.random() * (config.multMax - config.multMin + 1)) + config.multMin;
            var maxQuotient = Math.floor(config.maxResult / b);
            maxQuotient = Math.max(maxQuotient, Math.floor(config.minNum / b));
            answer = Math.floor(Math.random() * (maxQuotient - Math.floor(config.minNum / b) + 1)) + Math.floor(config.minNum / b);
            a = answer * b;
          } else {
            b = Math.floor(Math.random() * (config.multMax - config.multMin + 1)) + config.multMin;
            answer = Math.floor(Math.random() * (Math.floor(config.maxNum / b) - Math.floor(config.minNum / b) + 1)) + Math.floor(config.minNum / b);
            a = answer * b;
          }
          displayOp = '÷'; // Deel-teken (Unicode)
          break;
        default:
          // Fallback naar optellen
          if (config.maxResult) {
            var maxA = Math.min(config.maxNum, config.maxResult - config.minNum);
            if (maxA < config.minNum) maxA = config.minNum;
            a = Math.floor(Math.random() * (maxA - config.minNum + 1)) + config.minNum;
            var maxB = Math.min(config.maxNum, config.maxResult - a);
            if (maxB < config.minNum) maxB = config.minNum;
            b = Math.floor(Math.random() * (maxB - config.minNum + 1)) + config.minNum;
          } else {
            a = Math.floor(Math.random() * (config.maxNum - config.minNum + 1)) + config.minNum;
            b = Math.floor(Math.random() * (config.maxNum - config.minNum + 1)) + config.minNum;
          }
          answer = a + b;
          displayOp = '+';
          break;
      }
    } while (config.maxResult && answer >= config.maxResult && attempts < maxAttempts);

    return {
      question: a + ' ' + displayOp + ' ' + b,
      answer: answer,
      operation: operation,
    };
  }

  // Sound functions - gebruik gedeelde AudioContext voor betere performance
  let sharedAudioContext = null;
  let audioUnlocked = false;
  
  function getAudioContext() {
    if (!sharedAudioContext) {
      try {
        sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return null;
      }
    }
    return sharedAudioContext;
  }
  
  // Activeer audio context bij eerste user interaction - belangrijk voor browser policy
  function activateAudio() {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    
    if (audioUnlocked) return;
    
    // Prime de audio output met een zeer stil geluidje om browser policy te passeren
    try {
      if (audioContext.state === 'suspended') {
        audioContext.resume().then(function() {
          // Prime output
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.connect(gain);
          gain.connect(audioContext.destination);
          gain.gain.setValueAtTime(0.00001, audioContext.currentTime);
          osc.frequency.value = 220;
          osc.start(audioContext.currentTime);
          osc.stop(audioContext.currentTime + 0.01);
          audioUnlocked = true;
        }).catch(function() {
          // Als resume faalt, probeer direct te primen
          try {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            gain.gain.setValueAtTime(0.00001, audioContext.currentTime);
            osc.frequency.value = 220;
            osc.start(audioContext.currentTime);
            osc.stop(audioContext.currentTime + 0.01);
            audioUnlocked = true;
          } catch (e) {}
        });
      } else {
        // Context is al running, prime direct
        try {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.connect(gain);
          gain.connect(audioContext.destination);
          gain.gain.setValueAtTime(0.00001, audioContext.currentTime);
          osc.frequency.value = 220;
          osc.start(audioContext.currentTime);
          osc.stop(audioContext.currentTime + 0.01);
          audioUnlocked = true;
        } catch (e) {}
      }
    } catch (e) {
      // Silently fail
    }
  }

  function playSound(frequency, duration, type = 'sine') {
    try {
      const audioContext = getAudioContext();
      if (!audioContext) return;
      
      // Zorg dat context running is
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (e) {
      // Silently fail if audio not supported
      console.log('Audio error:', e);
    }
  }

  function playCorrectSound() {
    playSound(600, 0.2, 'sine');
    setTimeout(function () { playSound(700, 0.15, 'sine'); }, 100);
  }

  function playWrongSound() {
    playSound(200, 0.3, 'sawtooth');
    setTimeout(function () { playSound(150, 0.2, 'sawtooth'); }, 150);
  }

  function playPointSound() {
    playSound(800, 0.15, 'sine');
    setTimeout(function () { playSound(900, 0.2, 'sine'); }, 120);
  }

  function playWinSound() {
    playSound(600, 0.15, 'sine');
    setTimeout(function () { playSound(700, 0.15, 'sine'); }, 150);
    setTimeout(function () { playSound(800, 0.15, 'sine'); }, 300);
    setTimeout(function () { playSound(900, 0.2, 'sine'); }, 450);
  }

  function playNewQuestionSound() {
    playSound(400, 0.1, 'sine');
  }

  let player1Score = 0;
  let player2Score = 0;
  let player1TotalTime = 0; // Totale tijd voor speler 1 (bij 1v1)
  let player2TotalTime = 0; // Totale tijd voor speler 2 (bij 1v1)
  let player1QuestionsAnswered = 0; // Aantal oefeningen beantwoord door speler 1 (bij 1v1)
  let player2QuestionsAnswered = 0; // Aantal oefeningen beantwoord door speler 2 (bij 1v1)
  let currentQuestion = null;
  let currentAnswer = null;
  let mode = null;
  let step = null;
  let difficulty = 'normal';
  let gameOver = false;
  let winner = null;
  let waitingForAnswer = false;
  let questionStartTime = null;
  let playerCooldownUntil = null; // Voor multiplayer: wanneer speler weer mag antwoorden na fout
  let socket = null;
  let myName = '';
  let mySide = null;
  let opponentName = '';
  let roomId = null;
  let chatMessages = [];
  let lobbyList = [];
  let pendingInviteFrom = null;

  function initBoard() {
    return {
      player1Score: 0,
      player2Score: 0,
      currentQuestion: null,
      currentAnswer: null,
      questionStartTime: null,
      winner: null,
    };
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
      pendingInviteFrom = { fromId: data.fromId, fromName: data.fromName || 'Speler', difficulty: data.difficulty || 'normal' };
      render();
    });
    socket.on('gameStart', function (data) {
      roomId = data.roomId;
      player1Score = 0;
      player2Score = 0;
      mySide = data.youAre;
      opponentName = data.opponentName || 'Tegenstander';
      chatMessages = data.chat || [];
      currentQuestion = null;
      currentAnswer = null;
      winner = null;
      gameOver = false;
      waitingForAnswer = false;
      difficulty = data.difficulty || 'normal';
      step = 'play';
      newQuestion();
      render();
    });
    socket.on('gameState', function (data) {
      player1Score = data.player1Score !== undefined ? data.player1Score : player1Score;
      player2Score = data.player2Score !== undefined ? data.player2Score : player2Score;
      if (data.newQuestion) {
        currentQuestion = data.newQuestion.question;
        currentAnswer = data.newQuestion.answer;
        questionStartTime = Date.now();
        waitingForAnswer = true;
        activateAudio(); // Zorg dat audio geactiveerd is
        playNewQuestionSound();
        render();
      }
      if (data.answerResult) {
        if (data.answerResult.correct) {
          playCorrectSound();
          if (data.answerResult.scored) {
            playPointSound();
          }
        } else {
          playWrongSound();
        }
        waitingForAnswer = false;
        setTimeout(function () {
          if (!gameOver && socket) {
            socket.emit('nextQuestion');
          }
        }, 1500);
      }
      winner = data.winner != null ? data.winner : null;
      gameOver = winner !== null;
      if (gameOver && winner !== null) {
        playWinSound();
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

  // Houd bij welke operaties recent gebruikt zijn voor betere distributie
  let recentOperations = [];
  const MAX_RECENT_OPS = 3;
  
  // Voor straftijd melding bij 1v1
  let penaltyMessage = null;
  let penaltyMessageTimeout = null;
  
  // Voor countdown tussen oefeningen bij 1v1
  let countdownActive = false;
  let countdownValue = 0;
  let countdownCallback = null;
  
  function showPenaltyMessage(player, penaltyMs) {
    penaltyMessage = {
      player: player,
      penalty: penaltyMs / 1000, // In seconden
      timestamp: Date.now()
    };
    // Verwijder melding na 3 seconden
    if (penaltyMessageTimeout) clearTimeout(penaltyMessageTimeout);
    penaltyMessageTimeout = setTimeout(function() {
      penaltyMessage = null;
      render();
    }, 3000);
  }
  
  function showCountdown(seconds, callback) {
    if (mode !== '1v1') {
      // Geen countdown voor multiplayer
      setTimeout(callback, 1500);
      return;
    }
    countdownActive = true;
    countdownValue = seconds;
    countdownCallback = callback;
    render(); // Toon countdown
    
    var countdownInterval = setInterval(function() {
      countdownValue--;
      if (countdownValue <= 0) {
        clearInterval(countdownInterval);
        countdownActive = false;
        countdownValue = 0;
        if (countdownCallback) {
          countdownCallback();
          countdownCallback = null;
        }
      } else {
        render(); // Update countdown display
      }
    }, 1000);
  }

  function newQuestion() {
    var q = generateQuestion(difficulty);
    currentQuestion = q.question;
    currentAnswer = q.answer;
    questionStartTime = Date.now();
    waitingForAnswer = true;
    
    // Voeg operatie toe aan recent lijstje (voor betere distributie)
    if (q.operation) {
      recentOperations.push(q.operation);
      if (recentOperations.length > MAX_RECENT_OPS) {
        recentOperations.shift();
      }
    }
    
    // Geluidje voor nieuwe vraag
    activateAudio(); // Zorg dat audio geactiveerd is
    playNewQuestionSound();
    
    if (mode === 'multiplayer' && socket) {
      socket.emit('newQuestion', { question: q.question, answer: q.answer });
    }
  }

  function submitAnswer(answer) {
    if (!waitingForAnswer || gameOver) return;
    
    // Check cooldown voor multiplayer
    if (mode === 'multiplayer' && playerCooldownUntil && Date.now() < playerCooldownUntil) {
      return; // Speler mag nog niet antwoorden
    }
    
    if (mode === 'multiplayer' && socket) {
      socket.emit('answer', { answer: parseInt(answer, 10) });
      waitingForAnswer = false;
      return;
    }
    var correct = parseInt(answer, 10) === currentAnswer;
    var answerTime = Date.now() - questionStartTime; // Tijd in milliseconden
    
    if (mode === '1v1') {
      // Bij 1v1: tijd bijhouden per speler
      if (correct) {
        activateAudio(); // Zorg dat audio werkt
        playCorrectSound();
        if (currentPlayer === P1) {
          player1TotalTime += answerTime;
          player1QuestionsAnswered++;
          if (player1QuestionsAnswered >= QUESTIONS_PER_PLAYER && player2QuestionsAnswered >= QUESTIONS_PER_PLAYER) {
            // Beide spelers hebben alle oefeningen gedaan, bepaal winnaar op basis van tijd
            gameOver = true;
            if (player1TotalTime < player2TotalTime) {
              winner = P1;
            } else if (player2TotalTime < player1TotalTime) {
              winner = P2;
            } else {
              winner = null; // Gelijkspel
            }
            playWinSound();
          }
        } else {
          player2TotalTime += answerTime;
          player2QuestionsAnswered++;
          if (player1QuestionsAnswered >= QUESTIONS_PER_PLAYER && player2QuestionsAnswered >= QUESTIONS_PER_PLAYER) {
            // Beide spelers hebben alle oefeningen gedaan, bepaal winnaar op basis van tijd
            gameOver = true;
            if (player1TotalTime < player2TotalTime) {
              winner = P1;
            } else if (player2TotalTime < player1TotalTime) {
              winner = P2;
            } else {
              winner = null; // Gelijkspel
            }
            playWinSound();
          }
        }
        if (!gameOver) {
          playPointSound();
          // Bij correct antwoord: wissel naar volgende speler met 3 seconden afteller
          showCountdown(3, function() {
            currentPlayer = currentPlayer === P1 ? P2 : P1;
            newQuestion();
            render();
          });
        }
      } else {
        // FOUT ANTWOORD bij 1v1: speler moet opnieuw proberen + 5 seconden straftijd
        activateAudio(); // Zorg dat audio werkt
        playWrongSound();
        var penaltyTime = 5000; // 5 seconden straftijd
        if (currentPlayer === P1) {
          player1TotalTime += answerTime + penaltyTime;
          // Speler blijft aan zet, vraag blijft hetzelfde
        } else {
          player2TotalTime += answerTime + penaltyTime;
          // Speler blijft aan zet, vraag blijft hetzelfde
        }
        // Reset vraag start tijd voor nieuwe poging
        questionStartTime = Date.now();
        // Toon straftijd melding
        showPenaltyMessage(currentPlayer, penaltyTime);
        render(); // Update UI om straftijd te tonen
      }
    } else {
      // Multiplayer: punten systeem (eerste met juiste antwoord krijgt punt)
      if (correct) {
        activateAudio(); // Zorg dat audio werkt
        playCorrectSound();
        if (currentPlayer === P1) {
          player1Score++;
          if (player1Score >= 5) {
            winner = P1;
            gameOver = true;
            playWinSound();
          } else {
            playPointSound();
          }
        } else {
          player2Score++;
          if (player2Score >= 5) {
            winner = P2;
            gameOver = true;
            playWinSound();
          } else {
            playPointSound();
          }
        }
        if (!gameOver) {
          playPointSound();
        }
      } else {
        // FOUT ANTWOORD bij multiplayer: 5 seconden cooldown
        playWrongSound();
        playerCooldownUntil = Date.now() + 5000; // 5 seconden cooldown
        render(); // Update UI om cooldown te tonen
      }
    }
    
    if (correct || mode === 'multiplayer') {
      waitingForAnswer = false;
      if (!gameOver && mode !== '1v1') {
        setTimeout(function () {
          currentPlayer = currentPlayer === P1 ? P2 : P1;
          newQuestion();
          render();
        }, 1500);
      }
    }
    render();
  }

  let currentPlayer = P1;

  function render() {
    if (mode === null) {
      var guidance = window.RegenboogCore && window.RegenboogCore.introGuidance && window.RegenboogCore.introGuidance['reken-duel'];
      var cardLines = '';
      if (guidance && guidance.length) {
        cardLines = '<p><strong>Hoe te spelen:</strong></p><ul>' +
          guidance.map(function (line) {
            return '<li class="core-intro-step">🎯 ' + escapeHtml(line) + '</li>';
          }).join('') + '</ul>';
      } else {
        cardLines = '<p><strong>Hoe te spelen:</strong></p><ul>' +
          '<li class="core-intro-step">🧮 Los rekensommen op zo snel mogelijk</li>' +
          '<li class="core-intro-step">⏱️ Bij 1 tegen 1: beide spelers krijgen ' + QUESTIONS_PER_PLAYER + ' oefeningen, snelste totale tijd wint</li>' +
          '<li class="core-intro-step">🌐 Bij multiplayer: eerste met juiste antwoord krijgt punt, eerste tot 5 punten wint</li></ul>';
      }
      area.innerHTML =
        '<div class="core-intro">' +
        '  <h3 class="core-intro-title">Reken-duel</h3>' +
        '  <p class="core-intro-subtitle">Los rekensommen op en win het duel!</p>' +
        '  <div class="core-intro-card">' + cardLines + '</div>' +
        '  <div class="core-intro-actions dammen-mode-actions">' +
        '    <p class="dammen-choose-mode">Kies hoe je wilt spelen:</p>' +
        '    <div class="dammen-mode-buttons">' +
        '      <button type="button" class="dammen-mode-btn" data-mode="1v1">1 tegen 1 (op dezelfde computer)</button>' +
        '      <button type="button" class="dammen-mode-btn" data-mode="multiplayer">1 tegen 1 (over internet)</button>' +
        '    </div>' +
        '  </div>' +
        '</div>';
      area.querySelectorAll('.dammen-mode-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          mode = btn.getAttribute('data-mode');
          if (mode === '1v1') {
            step = 'difficulty';
          } else if (mode === 'multiplayer') {
            step = 'mp-name';
          }
          render();
        });
      });
      // Geen leaderboard voor reken-duel (geen AI/computer)
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
        socket = (typeof io !== 'undefined' && io) ? io('/reken-duel') : null;
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
        ? '<div class="dammen-invite-overlay"><p>' + escapeHtml(pendingInviteFrom.fromName) + ' nodigt je uit.</p><p style="font-size: 0.9rem; margin-top: 0.5rem;">Kies moeilijkheidsgraad:</p><div class="dammen-difficulty-buttons" style="margin-top: 0.5rem;"><button type="button" class="dammen-difficulty-btn" data-diff="easy" id="invite-easy">Makkelijk</button><button type="button" class="dammen-difficulty-btn" data-diff="normal" id="invite-normal">Normaal</button><button type="button" class="dammen-difficulty-btn" data-diff="hard" id="invite-hard">Moeilijk</button></div><button type="button" class="dammen-accept-btn" id="dammen-accept" style="display:none;">Accepteer</button><button type="button" class="dammen-decline-btn" id="dammen-decline">Weiger</button></div>' : '';
      area.innerHTML = '<p class="dammen-instruction">Speelzaal</p><div class="dammen-lobby-list">' + listHtml + '</div>' + inviteHtml + '<button type="button" class="dammen-back" id="dammen-lobby-back">Terug</button>';
      var inviteTargetId = null;
      area.querySelectorAll('.dammen-invite-btn').forEach(function (btn) {
        btn.addEventListener('click', function () { 
          inviteTargetId = btn.getAttribute('data-id'); 
          if (socket && inviteTargetId) {
            // Kies moeilijkheidsgraad voor uitnodiging
            step = 'mp-choose-diff';
            render();
          }
        });
      });
      if (pendingInviteFrom) {
        var selectedDiff = null;
        ['easy', 'normal', 'hard'].forEach(function (diff) {
          document.getElementById('invite-' + diff).addEventListener('click', function () {
            selectedDiff = diff;
            ['easy', 'normal', 'hard'].forEach(function (d) {
              document.getElementById('invite-' + d).style.opacity = d === diff ? '1' : '0.5';
            });
            document.getElementById('dammen-accept').style.display = 'block';
          });
        });
        document.getElementById('dammen-accept').addEventListener('click', function () {
          if (socket && pendingInviteFrom) {
            socket.emit('acceptInvite', { fromId: pendingInviteFrom.fromId, difficulty: selectedDiff || pendingInviteFrom.difficulty || 'normal' });
          }
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

    if (mode === 'multiplayer' && step === 'mp-choose-diff') {
      var targetId = inviteTargetId;
      if (!targetId) {
        // Als targetId niet meer beschikbaar is, ga terug naar lobby
        step = 'mp-lobby';
        render();
        return;
      }
      area.innerHTML =
        '<p class="dammen-instruction">Kies moeilijkheidsgraad voor de uitnodiging.</p>' +
        '<div class="dammen-difficulty-buttons">' +
        '<button type="button" class="dammen-difficulty-btn" data-diff="easy">Makkelijk<br><small>' + DIFFICULTY_CONFIG.easy.description + '</small></button>' +
        '<button type="button" class="dammen-difficulty-btn" data-diff="normal">Normaal<br><small>' + DIFFICULTY_CONFIG.normal.description + '</small></button>' +
        '<button type="button" class="dammen-difficulty-btn" data-diff="hard">Moeilijk<br><small>' + DIFFICULTY_CONFIG.hard.description + '</small></button>' +
        '</div><button type="button" class="dammen-back" id="dammen-diff-back">Terug</button>';
      area.querySelectorAll('.dammen-difficulty-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var diff = btn.getAttribute('data-diff');
          if (socket && targetId) {
            socket.emit('invite', { targetId: targetId, difficulty: diff });
            // Wacht even zodat de server de invite kan verwerken voordat we teruggaan naar lobby
            setTimeout(function() {
              inviteTargetId = null;
              step = 'mp-lobby';
              render();
            }, 100);
          } else {
            inviteTargetId = null;
            step = 'mp-lobby';
            render();
          }
        });
      });
      document.getElementById('dammen-diff-back').addEventListener('click', function () { inviteTargetId = null; step = 'mp-lobby'; render(); });
      return;
    }

    if (step === 'difficulty') {
      area.innerHTML =
        '<p class="dammen-instruction">Kies de moeilijkheidsgraad.</p>' +
        '<div class="dammen-difficulty-buttons">' +
        '<button type="button" class="dammen-difficulty-btn" data-diff="easy">Makkelijk<br><small>' + DIFFICULTY_CONFIG.easy.description + '</small></button>' +
        '<button type="button" class="dammen-difficulty-btn" data-diff="normal">Normaal<br><small>' + DIFFICULTY_CONFIG.normal.description + '</small></button>' +
        '<button type="button" class="dammen-difficulty-btn" data-diff="hard">Moeilijk<br><small>' + DIFFICULTY_CONFIG.hard.description + '</small></button>' +
        '</div><button type="button" class="dammen-back" id="dammen-diff-back">Terug</button>';
      area.querySelectorAll('.dammen-difficulty-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          difficulty = btn.getAttribute('data-diff');
          step = 'play';
          player1Score = 0;
          player2Score = 0;
          player1TotalTime = 0;
          player2TotalTime = 0;
          player1QuestionsAnswered = 0;
          player2QuestionsAnswered = 0;
          playerCooldownUntil = null;
          recentOperations = []; // Reset recent operations
          currentQuestion = null;
          currentAnswer = null;
          winner = null;
          gameOver = false;
          waitingForAnswer = false;
          currentPlayer = P1;
          newQuestion();
          render();
        });
      });
      document.getElementById('dammen-diff-back').addEventListener('click', function () { mode = null; step = null; render(); });
      return;
    }

    var turnText = '';
    var winnerHtml = '';
    
    if (gameOver) {
      if (winner === null) {
        turnText = 'Gelijkspel!';
      } else {
        if (mode === 'multiplayer') {
          turnText = winner === mySide ? 'Jij wint!' : (opponentName || 'Tegenstander') + ' wint!';
        } else {
          turnText = (winner === P1 ? 'Speler 1' : 'Speler 2') + ' wint!';
        }
      }
      
      // Gebruik Core helper voor winnaar scherm
      if (window.RegenboogCore && window.RegenboogCore.showWinnerScreen) {
        winnerHtml = window.RegenboogCore.showWinnerScreen(winner, mode, {
          player1Name: 'Speler 1',
          player2Name: 'Speler 2',
          mySide: mySide,
          opponentName: opponentName,
          player1Score: mode === 'multiplayer' ? player1Score : null,
          player2Score: mode === 'multiplayer' ? player2Score : null,
          player1Time: mode === '1v1' ? player1TotalTime : null,
          player2Time: mode === '1v1' ? player2TotalTime : null
        });
      }
    } else {
      turnText = mode === 'multiplayer'
        ? (waitingForAnswer ? (currentQuestion ? 'Los de som op!' : 'Wachten op nieuwe som...') : 'Wachten...')
        : (waitingForAnswer ? (currentPlayer === P1 ? 'Speler 1 aan zet' : 'Speler 2 aan zet') : 'Wachten...');
    }

    var scoreText = '';
    var formatTime = function(ms) {
      return (ms / 1000).toFixed(1) + 's';
    };
    
    if (mode === 'multiplayer') {
      var cooldownText = '';
      if (playerCooldownUntil && Date.now() < playerCooldownUntil) {
        var remaining = Math.ceil((playerCooldownUntil - Date.now()) / 1000);
        cooldownText = ' <span style="color: #d32f2f; font-weight: bold;">(Cooldown: ' + remaining + 's)</span>';
      }
      scoreText = '<div style="display: flex; justify-content: space-around; align-items: center; padding: 0.75rem; background: #f5f5f5; border-radius: 8px; margin: 0.5rem 0;">' +
        '<div style="text-align: center;"><strong>Speler 1</strong><br>' + (mySide === P1 ? '<span style="font-size: 1.2em; color: #1976d2;">Jij</span>' : escapeHtml(opponentName)) + '<br><span style="font-size: 1.5em; font-weight: bold; color: #1976d2;">' + player1Score + '</span></div>' +
        '<div style="font-size: 1.2em; font-weight: bold;">–</div>' +
        '<div style="text-align: center;"><strong>Speler 2</strong><br>' + (mySide === P2 ? '<span style="font-size: 1.2em; color: #1976d2;">Jij</span>' : escapeHtml(opponentName)) + '<br><span style="font-size: 1.5em; font-weight: bold; color: #1976d2;">' + player2Score + '</span></div>' +
        '</div>' + cooldownText;
    } else if (mode === '1v1') {
      // Bij 1v1: toon tijd en aantal oefeningen, highlight actieve speler
      var p1Style = currentPlayer === P1 ? 'background: #e3f2fd; border: 2px solid #1976d2; box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);' : 'background: #f5f5f5; border: 2px solid transparent;';
      var p2Style = currentPlayer === P2 ? 'background: #e8f5e9; border: 2px solid #388e3c; box-shadow: 0 2px 8px rgba(56, 142, 60, 0.3);' : 'background: #f5f5f5; border: 2px solid transparent;';
      var p1Color = currentPlayer === P1 ? '#1976d2' : '#666';
      var p2Color = currentPlayer === P2 ? '#388e3c' : '#666';
      
      scoreText = '<div style="display: flex; justify-content: space-around; align-items: center; gap: 1rem; margin: 0.5rem 0;">' +
        '<div style="text-align: center; padding: 0.75rem; border-radius: 8px; flex: 1; ' + p1Style + '">' +
        '<strong style="color: ' + p1Color + ';">' + (currentPlayer === P1 ? '▶ ' : '') + 'Speler 1' + (currentPlayer === P1 ? ' ◀' : '') + '</strong><br>' +
        '<span style="font-size: 1.2em; font-weight: bold; color: ' + p1Color + ';">' + formatTime(player1TotalTime) + '</span><br>' +
        '<small style="color: #666;">' + player1QuestionsAnswered + '/' + QUESTIONS_PER_PLAYER + ' oefeningen</small>' +
        '</div>' +
        '<div style="font-size: 1.2em; font-weight: bold; color: #999;">–</div>' +
        '<div style="text-align: center; padding: 0.75rem; border-radius: 8px; flex: 1; ' + p2Style + '">' +
        '<strong style="color: ' + p2Color + ';">' + (currentPlayer === P2 ? '▶ ' : '') + 'Speler 2' + (currentPlayer === P2 ? ' ◀' : '') + '</strong><br>' +
        '<span style="font-size: 1.2em; font-weight: bold; color: ' + p2Color + ';">' + formatTime(player2TotalTime) + '</span><br>' +
        '<small style="color: #666;">' + player2QuestionsAnswered + '/' + QUESTIONS_PER_PLAYER + ' oefeningen</small>' +
        '</div>' +
        '</div>';
    }

    var chatHtml = '';
    if (mode === 'multiplayer') {
      var chatList = chatMessages.map(function (msg) { return '<div class="dammen-chat-msg"><strong>' + escapeHtml(msg.name) + '</strong>: ' + escapeHtml(msg.text) + '</div>'; }).join('');
      chatHtml = '<div class="dammen-chat-panel"><div class="dammen-chat-title">Chat – ' + escapeHtml(opponentName) + '</div><div class="dammen-chat-messages" id="dammen-chat-msgs">' + chatList + '</div><div class="dammen-chat-input-wrap"><input type="text" class="dammen-chat-input" id="dammen-chat-input" placeholder="Bericht…" maxlength="500"><button type="button" class="dammen-chat-send" id="dammen-chat-send">Verstuur</button></div></div>';
    }

    var questionHtml = '';
    var penaltyHtml = '';
    var countdownHtml = '';
    
    // Toon countdown tussen oefeningen bij 1v1
    if (mode === '1v1' && countdownActive && countdownValue > 0) {
      // De volgende speler is degene die NIET aan zet is
      var nextPlayer = currentPlayer === P1 ? P2 : P1;
      var nextPlayerName = nextPlayer === P1 ? 'Speler 1' : 'Speler 2';
      var nextPlayerColor = nextPlayer === P1 ? '#1976d2' : '#388e3c';
      countdownHtml = '<div class="reken-duel-center-wrap"><div class="reken-duel-countdown" style="text-align: center; padding: 2rem; margin: 1rem 0; background: linear-gradient(180deg, #f5f5f5 0%, #e0e0e0 100%); border-radius: 16px; border: 3px solid ' + nextPlayerColor + '; box-shadow: 0 4px 16px rgba(0,0,0,0.2);">' +
        '<div style="font-size: 3rem; font-weight: bold; color: ' + nextPlayerColor + '; margin: 0.5rem 0;">' + countdownValue + '</div>' +
        '<div style="font-size: 1.2rem; color: #666; margin-top: 0.5rem;">' + nextPlayerName + ' mag zich klaarmaken...</div>' +
        '</div></div>';
    }
    
    // Toon straftijd melding bij 1v1
    if (mode === '1v1' && penaltyMessage && Date.now() - penaltyMessage.timestamp < 3000) {
      var playerName = penaltyMessage.player === P1 ? 'Speler 1' : 'Speler 2';
      penaltyHtml = '<div class="reken-duel-center-wrap"><div class="reken-duel-penalty" style="background: #ffebee; border: 2px solid #d32f2f; border-radius: 8px; padding: 1rem; margin: 1rem 0; text-align: center; animation: shake 0.5s;">' +
        '<div style="font-size: 1.2em; font-weight: bold; color: #d32f2f;">❌ Fout antwoord!</div>' +
        '<div style="margin-top: 0.5rem; color: #c62828;">' + playerName + ' krijgt <strong>+' + penaltyMessage.penalty + ' seconden</strong> straftijd</div>' +
        '<div style="margin-top: 0.5rem; font-size: 0.9em; color: #666;">Probeer opnieuw!</div>' +
        '</div></div>';
    }
    
    if (currentQuestion && waitingForAnswer && !countdownActive) {
      var inputDisabled = '';
      var inputPlaceholder = 'Antwoord';
      var buttonDisabled = '';
      var buttonText = 'Antwoord';
      
      // Check cooldown voor multiplayer
      if (mode === 'multiplayer' && playerCooldownUntil && Date.now() < playerCooldownUntil) {
        var remaining = Math.ceil((playerCooldownUntil - Date.now()) / 1000);
        inputDisabled = 'disabled';
        inputPlaceholder = 'Cooldown: ' + remaining + ' seconden...';
        buttonDisabled = 'disabled';
        buttonText = 'Wachten...';
      }
      
      // Bepaal kleur en speler naam voor 1v1
      var questionBoxStyle = '';
      var playerLabel = '';
      if (mode === '1v1') {
        if (currentPlayer === P1) {
          // Speler 1: blauw thema
          questionBoxStyle = 'background: linear-gradient(180deg, #e3f2fd 0%, #bbdefb 100%); border: 3px solid #1976d2; box-shadow: 0 4px 16px rgba(25, 118, 210, 0.3);';
          playerLabel = '<div style="font-size: 1.1em; font-weight: bold; color: #1976d2; margin-bottom: 0.5rem;">👤 Speler 1</div>';
        } else {
          // Speler 2: groen thema
          questionBoxStyle = 'background: linear-gradient(180deg, #e8f5e9 0%, #c8e6c9 100%); border: 3px solid #388e3c; box-shadow: 0 4px 16px rgba(56, 142, 60, 0.3);';
          playerLabel = '<div style="font-size: 1.1em; font-weight: bold; color: #388e3c; margin-bottom: 0.5rem;">👤 Speler 2</div>';
        }
      } else {
        // Multiplayer: standaard geel/oranje thema
        questionBoxStyle = 'background: linear-gradient(180deg, #fff8e1 0%, #ffe082 100%); border: 3px solid #f57f17; box-shadow: 0 4px 16px rgba(245, 127, 23, 0.2);';
      }
      
      questionHtml = '<div class="reken-duel-question" style="' + questionBoxStyle + '">' +
        playerLabel +
        '<div class="reken-duel-question-text">' + escapeHtml(currentQuestion) + ' = ?</div>' +
        '<div class="reken-duel-answer-input-wrap">' +
        '<input type="number" class="reken-duel-answer-input" id="reken-duel-answer" placeholder="' + inputPlaceholder + '" autofocus ' + inputDisabled + '>' +
        '<button type="button" class="reken-duel-submit-btn" id="reken-duel-submit" ' + buttonDisabled + '>' + buttonText + '</button>' +
        '</div></div>';
    } else if (!waitingForAnswer && !gameOver) {
      questionHtml = '<div class="reken-duel-waiting">Wachten op volgende som...</div>';
    }

    area.innerHTML =
      '<p class="dammen-instruction">' + turnText + '</p>' +
      winnerHtml +
      '<p class="dammen-stand">' + scoreText + '</p>' +
      countdownHtml +
      penaltyHtml +
      questionHtml +
      '<div class="dammen-play-wrap">' + chatHtml + '</div>' +
      '<div class="dammen-actions">' +
      (mode === 'multiplayer' ? '<button type="button" class="dammen-back" id="dammen-leave-room">Verlaat spel</button>' : '<button type="button" class="dammen-again" id="dammen-new">Nieuw spel</button><button type="button" class="dammen-back" id="dammen-back">Andere spelmodus</button>') +
      '</div>';

    if (questionHtml && waitingForAnswer) {
      var answerInput = document.getElementById('reken-duel-answer');
      var submitBtn = document.getElementById('reken-duel-submit');
      if (answerInput && submitBtn) {
        function doSubmit() {
          var answer = answerInput.value.trim();
          if (answer && !answerInput.disabled) {
            submitAnswer(answer);
          }
        }
        submitBtn.addEventListener('click', function() {
          activateAudio(); // Activeer audio bij eerste klik
          doSubmit();
        });
        answerInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && !answerInput.disabled) {
            activateAudio(); // Activeer audio bij eerste Enter
            doSubmit();
          }
        });
        if (answerInput && !answerInput.disabled) {
          answerInput.focus();
          // Activeer audio bij eerste focus/interactie
          answerInput.addEventListener('focus', activateAudio, { once: true });
        }
        
        // Update cooldown timer voor multiplayer
        if (mode === 'multiplayer' && playerCooldownUntil && Date.now() < playerCooldownUntil) {
          var cooldownInterval = setInterval(function() {
            if (!playerCooldownUntil || Date.now() >= playerCooldownUntil) {
              clearInterval(cooldownInterval);
              if (answerInput) {
                answerInput.disabled = false;
                answerInput.placeholder = 'Antwoord';
                answerInput.focus();
              }
              if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Antwoord';
              }
            } else {
              var remaining = Math.ceil((playerCooldownUntil - Date.now()) / 1000);
              if (answerInput) {
                answerInput.placeholder = 'Cooldown: ' + remaining + ' seconden...';
              }
              if (submitBtn) {
                submitBtn.textContent = 'Wachten...';
              }
            }
          }, 100);
        }
      }
    }

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
        player1Score = 0;
        player2Score = 0;
        player1TotalTime = 0;
        player2TotalTime = 0;
        player1QuestionsAnswered = 0;
        player2QuestionsAnswered = 0;
        recentOperations = []; // Reset recent operations
        currentQuestion = null;
        currentAnswer = null;
        winner = null;
        gameOver = false;
        waitingForAnswer = false;
        currentPlayer = P1;
        newQuestion();
        render();
      });
      var backBtn = document.getElementById('dammen-back');
      if (backBtn) backBtn.addEventListener('click', function () { mode = null; step = null; render(); });
    }
  }

  // Activeer audio bij eerste klik op de pagina (voor browser policy)
  document.addEventListener('click', function() {
    activateAudio();
  }, { once: true });
  
  document.addEventListener('keydown', function() {
    activateAudio();
  }, { once: true });
  
  render();
  // Geen leaderboard voor reken-duel (geen AI/computer)
})();
