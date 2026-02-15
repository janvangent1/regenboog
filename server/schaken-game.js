/**
 * Schaken – 8x8, standaard start. P1 = wit (onder), P2 = zwart (boven).
 * Vereenvoudigd: geen rokade, geen en passant. Promotie naar dame.
 */
const SIZE = 8;
const P1 = 1;
const P2 = 2;
const PIECES = { K: 'K', Q: 'Q', R: 'R', B: 'B', N: 'N', P: 'P' };

function initBoard() {
  const b = Array(8).fill(null).map(() => Array(8).fill(null));
  const back = (color, row) => {
    b[row][0] = { color, piece: 'R' };
    b[row][1] = { color, piece: 'N' };
    b[row][2] = { color, piece: 'B' };
    b[row][3] = { color, piece: 'Q' };
    b[row][4] = { color, piece: 'K' };
    b[row][5] = { color, piece: 'B' };
    b[row][6] = { color, piece: 'N' };
    b[row][7] = { color, piece: 'R' };
    for (let c = 0; c < 8; c++) b[row + (color === P1 ? -1 : 1)][c] = { color, piece: 'P' };
  };
  back(P2, 0);
  back(P1, 7);
  return b;
}

function cloneBoard(b) {
  return b.map((row) => row.map((c) => (c ? { color: c.color, piece: c.piece } : null)));
}

function getKingPos(board, color) {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (board[r][c] && board[r][c].color === color && board[r][c].piece === 'K') return [r, c];
  return null;
}

function attacked(board, r, c, byColor) {
  const pieceAt = (rr, cc) => (rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE ? board[rr][cc] : null);
  const isEnemy = (p) => p && p.color === byColor;
  const dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
  for (const [dr, dc] of dirs) {
    let rr = r + dr, cc = c + dc;
    if (dr !== 0 || dc !== 0) {
      const p = pieceAt(rr, cc);
      if (p && p.color === byColor && p.piece === 'K') return true;
    }
    for (let step = 1; step < SIZE; step++) {
      rr = r + dr * step; cc = c + dc * step;
      if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) break;
      const p = pieceAt(rr, cc);
      if (p) {
        if (p.color !== byColor) break;
        if (p.piece === 'Q' || p.piece === 'R') { if (dr === 0 || dc === 0) return true; break; }
        if (p.piece === 'B') { if (dr !== 0 && dc !== 0) return true; break; }
        break;
      }
    }
  }
  const knight = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  for (const [dr, dc] of knight) {
    const rr = r + dr, cc = c + dc;
    const p = pieceAt(rr, cc);
    if (p && p.color === byColor && p.piece === 'N') return true;
  }
  const pawnDir = byColor === P1 ? -1 : 1;
  for (const dc of [-1, 1]) {
    const p = pieceAt(r + pawnDir, c + dc);
    if (p && p.color === byColor && p.piece === 'P') return true;
  }
  return false;
}

function inCheck(board, color) {
  const k = getKingPos(board, color);
  if (!k) return false;
  const other = color === P1 ? P2 : P1;
  return attacked(board, k[0], k[1], other);
}

function rawMoves(board, r, c) {
  const piece = board[r][c];
  if (!piece) return [];
  const color = piece.color;
  const other = color === P1 ? P2 : P1;
  const moves = [];
  const add = (rr, cc, captureOk = true) => {
    if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) return;
    const p = board[rr][cc];
    if (!p) { moves.push([rr, cc]); return; }
    if (p.color === other && captureOk) moves.push([rr, cc]);
  };
  const slide = (dr, dc) => {
    for (let step = 1; step < SIZE; step++) {
      const rr = r + dr * step, cc = c + dc * step;
      if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) break;
      const p = board[rr][cc];
      if (!p) { moves.push([rr, cc]); continue; }
      if (p.color === other) moves.push([rr, cc]);
      break;
    }
  };

  switch (piece.piece) {
    case 'K':
      for (const dr of [-1,0,1]) for (const dc of [-1,0,1]) if (dr || dc) add(r + dr, c + dc);
      break;
    case 'Q':
      for (const dr of [-1,0,1]) for (const dc of [-1,0,1]) if (dr || dc) slide(dr, dc);
      break;
    case 'R':
      slide(-1,0); slide(1,0); slide(0,-1); slide(0,1);
      break;
    case 'B':
      slide(-1,-1); slide(-1,1); slide(1,-1); slide(1,1);
      break;
    case 'N': {
      const n = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      n.forEach(([dr, dc]) => add(r + dr, c + dc));
      break;
    }
    case 'P': {
      const forward = color === P1 ? -1 : 1;
      if (!board[r + forward][c]) {
        moves.push([r + forward, c]);
        const startRow = color === P1 ? 6 : 1;
        if (r === startRow && !board[r + 2 * forward][c]) moves.push([r + 2 * forward, c]);
      }
      for (const dc of [-1, 1]) {
        const rr = r + forward, cc = c + dc;
        if (cc >= 0 && cc < SIZE && board[rr] && board[rr][cc] && board[rr][cc].color === other)
          moves.push([rr, cc]);
      }
      break;
    }
  }
  return moves;
}

function getLegalMoves(board, color) {
  const moves = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = board[r][c];
      if (!p || p.color !== color) continue;
      const dests = rawMoves(board, r, c);
      for (const [toR, toC] of dests) {
        const next = cloneBoard(board);
        next[toR][toC] = next[r][c];
        next[r][c] = null;
        if (next[toR][toC].piece === 'P' && (toR === 0 || toR === 7)) next[toR][toC] = { color, piece: 'Q' };
        if (!inCheck(next, color)) moves.push({ fromR: r, fromC: c, toR, toC });
      }
    }
  }
  return moves;
}

function applyMove(board, move, _currentPlayer) {
  const next = cloneBoard(board);
  const { fromR, fromC, toR, toC } = move;
  next[toR][toC] = next[fromR][fromC];
  next[fromR][fromC] = null;
  if (next[toR][toC].piece === 'P' && (toR === 0 || toR === 7)) next[toR][toC] = { color: next[toR][toC].color, piece: 'Q' };
  return next;
}

function moveMatches(a, b) {
  return a.fromR === b.fromR && a.fromC === b.fromC && a.toR === b.toR && a.toC === b.toC;
}

function checkWinner(board, currentPlayer) {
  const moves = getLegalMoves(board, currentPlayer);
  const checked = inCheck(board, currentPlayer);
  if (moves.length === 0) return checked ? (currentPlayer === P1 ? P2 : P1) : 0;
  return null;
}

module.exports = {
  SIZE,
  P1,
  P2,
  initBoard,
  getLegalMoves,
  applyMove,
  checkWinner,
  moveMatches,
};
