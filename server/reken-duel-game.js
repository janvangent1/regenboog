/**
 * Reken-duel – Spelers krijgen rekensommen, wie het eerst het juiste antwoord geeft krijgt een punt.
 * Eerste tot 5 punten wint.
 */
const P1 = 1;
const P2 = 2;
const POINTS_TO_WIN = 5;

// Moeilijkheidsgraden configuratie
const DIFFICULTY_CONFIG = {
  easy: {
    operations: ['+', '-'],
    minNum: 1,
    maxNum: 20,
    description: 'Optellen en aftrekken (1-20)',
  },
  normal: {
    operations: ['+', '-', '*'],
    minNum: 1,
    maxNum: 50,
    multMin: 2,
    multMax: 10,
    description: 'Optellen, aftrekken en vermenigvuldigen (1-50)',
  },
  hard: {
    operations: ['+', '-', '*', '/'],
    minNum: 10,
    maxNum: 100,
    multMin: 2,
    multMax: 12,
    description: 'Alle bewerkingen (10-100)',
  },
};

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

function generateQuestion(difficulty) {
  const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.normal;
  const operation = config.operations[Math.floor(Math.random() * config.operations.length)];
  let a, b, answer;

  switch (operation) {
    case '+':
      a = Math.floor(Math.random() * (config.maxNum - config.minNum + 1)) + config.minNum;
      b = Math.floor(Math.random() * (config.maxNum - config.minNum + 1)) + config.minNum;
      answer = a + b;
      break;
    case '-':
      a = Math.floor(Math.random() * (config.maxNum - config.minNum + 1)) + config.minNum;
      b = Math.floor(Math.random() * (a - config.minNum + 1)) + config.minNum;
      answer = a - b;
      break;
    case '*':
      a = Math.floor(Math.random() * (config.multMax - config.multMin + 1)) + config.multMin;
      b = Math.floor(Math.random() * (config.multMax - config.multMin + 1)) + config.multMin;
      answer = a * b;
      break;
    case '/':
      // Voor delen: genereer eerst het antwoord, dan de deler
      b = Math.floor(Math.random() * (config.multMax - config.multMin + 1)) + config.multMin;
      answer = Math.floor(Math.random() * (Math.floor(config.maxNum / b) - Math.floor(config.minNum / b) + 1)) + Math.floor(config.minNum / b);
      a = answer * b;
      break;
  }

  return {
    question: `${a} ${operation} ${b}`,
    answer: answer,
    operation: operation,
  };
}

function getLegalMoves(board, currentPlayer, difficulty) {
  // Geen legale moves in traditionele zin - spelers kunnen antwoorden indienen
  return [];
}

function applyMove(board, move, currentPlayer) {
  const next = {
    player1Score: board.player1Score,
    player2Score: board.player2Score,
    currentQuestion: board.currentQuestion,
    currentAnswer: board.currentAnswer,
    questionStartTime: board.questionStartTime,
    winner: board.winner,
  };

  if (move.type === 'answer') {
    if (move.answer === board.currentAnswer) {
      // Correct antwoord
      if (currentPlayer === P1) {
        next.player1Score = board.player1Score + 1;
      } else {
        next.player2Score = board.player2Score + 1;
      }
      // Check win
      if (next.player1Score >= POINTS_TO_WIN) {
        next.winner = P1;
      } else if (next.player2Score >= POINTS_TO_WIN) {
        next.winner = P2;
      }
    }
  } else if (move.type === 'newQuestion') {
    next.currentQuestion = move.question;
    next.currentAnswer = move.answer;
    next.questionStartTime = Date.now();
  }

  return next;
}

function checkWinner(board, currentPlayer) {
  if (board.winner) return board.winner;
  if (board.player1Score >= POINTS_TO_WIN) return P1;
  if (board.player2Score >= POINTS_TO_WIN) return P2;
  return null;
}

function moveMatches(legalMove, move) {
  // Geen traditionele move matching voor dit spel
  return true;
}

module.exports = {
  P1,
  P2,
  POINTS_TO_WIN,
  DIFFICULTY_CONFIG,
  initBoard,
  generateQuestion,
  getLegalMoves,
  applyMove,
  checkWinner,
  moveMatches,
};
