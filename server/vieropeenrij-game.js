/**
 * 4 op een rij – 7 kolommen, 6 rijen. P1 = onder, P2 = boven.
 */
const COLS = 7;
const ROWS = 6;
const P1 = 1;
const P2 = 2;

function initBoard() {
  return Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
}

function getLegalMoves(board, _currentPlayer) {
  const moves = [];
  for (let c = 0; c < COLS; c++) {
    if (board[0][c] === null) moves.push(c);
  }
  return moves;
}

function dropInColumn(board, col, player) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === null) {
      const next = board.map((row, ri) =>
        row.map((cell, ci) => (ri === r && ci === col ? player : cell))
      );
      return next;
    }
  }
  return null;
}

function countLine(board, r, c, dr, dc, player) {
  let n = 0;
  while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
    n++;
    r += dr;
    c += dc;
  }
  return n;
}

function checkWinner(board) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (!p) continue;
      for (const [dr, dc] of dirs) {
        const n1 = countLine(board, r, c, dr, dc, p);
        const n2 = countLine(board, r - dr, c - dc, -dr, -dc, p);
        const n = n1 + (n2 > 0 ? n2 - 1 : 0);
        if (n >= 4) return p;
      }
    }
  }
  if (board[0].every((cell) => cell != null)) return 0;
  return null;
}

function applyMove(board, move, currentPlayer) {
  const col = typeof move === 'object' && move.col != null ? move.col : move;
  if (col < 0 || col >= COLS || board[0][col] !== null) return null;
  return dropInColumn(board, col, currentPlayer);
}

function moveMatches(legalMove, move) {
  const col = typeof move === 'object' && move.col != null ? move.col : move;
  return legalMove === col;
}

module.exports = {
  COLS,
  ROWS,
  P1,
  P2,
  initBoard,
  getLegalMoves,
  applyMove,
  checkWinner,
  moveMatches,
};
