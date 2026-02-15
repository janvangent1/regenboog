/**
 * Server: Nederlands/Internationaal dammen (10x10, 20 schijven, meerslag verplicht max).
 */
const SIZE = 10;
const P1 = 1;
const P2 = 2;

function isDark(r, c) {
  return (r + c) % 2 === 1;
}

function cloneBoard(b) {
  return b.map((row) =>
    row.map((cell) => (cell ? { player: cell.player, king: cell.king } : null))
  );
}

function initBoard() {
  const board = [];
  for (let r = 0; r < SIZE; r++) {
    const row = [];
    for (let c = 0; c < SIZE; c++) {
      if (!isDark(r, c)) {
        row.push(null);
        continue;
      }
      if (r <= 3) row.push({ player: P2, king: false });
      else if (r >= 6) row.push({ player: P1, king: false });
      else row.push(null);
    }
    board.push(row);
  }
  return board;
}

function getPieceJumpChains(b, r, c, player, chain) {
  const piece = b[r][c];
  if (!piece || piece.player !== player || piece.king) return [];
  const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const chains = [];
  for (const d of dirs) {
    const midR = r + d[0];
    const midC = c + d[1];
    const toR = r + 2 * d[0];
    const toC = c + 2 * d[1];
    if (toR < 0 || toR >= SIZE || toC < 0 || toC >= SIZE) continue;
    const mid = b[midR][midC];
    if (!mid || mid.player === player) continue;
    if (b[toR][toC]) continue;
    const alreadyCaptured = (chain.captured || []).some(
      ([x, y]) => x === midR && y === midC
    );
    if (alreadyCaptured) continue;
    const newCaptures = (chain.captured || []).concat([[midR, midC]]);
    const newBoard = cloneBoard(b);
    newBoard[r][c] = null;
    newBoard[midR][midC] = null;
    newBoard[toR][toC] = { player: piece.player, king: piece.king };
    const further = getJumpChains(newBoard, toR, toC, player, { captured: newCaptures });
    if (further.length > 0) {
      further.forEach((f) => chains.push({ toR: f.toR, toC: f.toC, captures: f.captures }));
    } else {
      chains.push({ toR, toC, captures: newCaptures });
    }
  }
  return chains;
}

function getKingJumpChains(b, r, c, player, chain) {
  const piece = b[r][c];
  if (!piece || piece.player !== player || !piece.king) return [];
  const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const chains = [];
  for (const d of dirs) {
    let er = r + d[0];
    let ec = c + d[1];
    while (er >= 0 && er < SIZE && ec >= 0 && ec < SIZE) {
      const cell = b[er][ec];
      if (cell) {
        if (cell.player === player) break;
        const alreadyCaptured = (chain.captured || []).some(
          ([x, y]) => x === er && y === ec
        );
        if (alreadyCaptured) break;
        let lr = er + d[0];
        let lc = ec + d[1];
        while (lr >= 0 && lr < SIZE && lc >= 0 && lc < SIZE) {
          if (b[lr][lc]) break;
          const newCaptures = (chain.captured || []).concat([[er, ec]]);
          const newBoard = cloneBoard(b);
          newBoard[r][c] = null;
          newBoard[er][ec] = null;
          newBoard[lr][lc] = { player: piece.player, king: true };
          const further = getKingJumpChains(newBoard, lr, lc, player, { captured: newCaptures });
          if (further.length > 0) {
            further.forEach((f) => chains.push({ toR: f.toR, toC: f.toC, captures: f.captures }));
          } else {
            chains.push({ toR: lr, toC: lc, captures: newCaptures });
          }
          lr += d[0];
          lc += d[1];
        }
        break;
      }
      er += d[0];
      ec += d[1];
    }
  }
  return chains;
}

function getJumpChains(b, r, c, player, chain) {
  const piece = b[r][c];
  if (!piece || piece.player !== player) return [];
  if (piece.king) return getKingJumpChains(b, r, c, player, chain);
  return getPieceJumpChains(b, r, c, player, chain);
}

function getAllJumps(b, player) {
  const moves = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const list = getJumpChains(b, r, c, player, { captured: [] });
      list.forEach((lc) =>
        moves.push({
          fromR: r,
          fromC: c,
          toR: lc.toR,
          toC: lc.toC,
          captures: lc.captures,
        })
      );
    }
  }
  return moves;
}

function getSimpleMoves(b, player) {
  const moves = [];
  const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const piece = b[r][c];
      if (!piece || piece.player !== player) continue;
      if (piece.king) {
        for (const d of dirs) {
          let nr = r + d[0];
          let nc = c + d[1];
          while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && !b[nr][nc]) {
            moves.push({ fromR: r, fromC: c, toR: nr, toC: nc, captures: [] });
            nr += d[0];
            nc += d[1];
          }
        }
      } else {
        const stepDirs = player === P1 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
        for (const d of stepDirs) {
          const nr = r + d[0];
          const nc = c + d[1];
          if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE || b[nr][nc]) continue;
          if (player === P1 && nr >= r) continue;
          if (player === P2 && nr <= r) continue;
          moves.push({ fromR: r, fromC: c, toR: nr, toC: nc, captures: [] });
        }
      }
    }
  }
  return moves;
}

function getLegalMoves(b, player) {
  const jumps = getAllJumps(b, player);
  if (jumps.length > 0) {
    const maxCap = Math.max(...jumps.map((m) => (m.captures || []).length));
    return jumps.filter((m) => (m.captures || []).length === maxCap);
  }
  return getSimpleMoves(b, player);
}

function applyMove(b, move, _currentPlayer) {
  const next = cloneBoard(b);
  const piece = next[move.fromR][move.fromC];
  next[move.fromR][move.fromC] = null;
  (move.captures || []).forEach(([r, c]) => (next[r][c] = null));
  next[move.toR][move.toC] = { player: piece.player, king: piece.king };
  const crown =
    (piece.player === P1 && move.toR === 0) ||
    (piece.player === P2 && move.toR === SIZE - 1);
  if (crown) next[move.toR][move.toC].king = true;
  return next;
}

function checkWinner(b) {
  let has1 = false;
  let has2 = false;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (b[r][c]) {
        if (b[r][c].player === P1) has1 = true;
        else has2 = true;
      }
    }
  }
  if (!has1) return P2;
  if (!has2) return P1;
  if (getLegalMoves(b, P1).length === 0) return P2;
  if (getLegalMoves(b, P2).length === 0) return P1;
  return null;
}

function moveMatches(a, b) {
  const capA = a.captures || [];
  const capB = b.captures || [];
  if (
    a.fromR !== b.fromR ||
    a.fromC !== b.fromC ||
    a.toR !== b.toR ||
    a.toC !== b.toC ||
    capA.length !== capB.length
  )
    return false;
  for (let i = 0; i < capA.length; i++) {
    if (capA[i][0] !== capB[i][0] || capA[i][1] !== capB[i][1]) return false;
  }
  return true;
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
