/**
 * Zeeslag – 10x10 bord. P1 en P2 plaatsen schepen, dan om de beurt schieten.
 * Schepen: 1x5, 1x4, 2x3, 1x2 (totaal 5 schepen)
 */
const SIZE = 10;
const P1 = 1;
const P2 = 2;

// Schepen: [lengte, aantal]
const SHIPS = [
  [5, 1], // 1 schip van 5
  [4, 1], // 1 schip van 4
  [3, 2], // 2 schepen van 3
  [2, 1], // 1 schip van 2
];

function initBoard() {
  // Bord structuur: { ships: [[r1,c1, r2,c2, ...]], shots: Set("r,c"), hits: Set("r,c") }
  return {
    ships: [], // Array van arrays: [[r1,c1, r2,c2, ...], ...] - elke array is één schip
    shots: new Set(), // Vakjes die zijn beschoten: "r,c"
    hits: new Set(), // Vakjes met hits: "r,c"
  };
}

function isValidShipPlacement(board, shipCells) {
  // Check of alle cellen binnen het bord zijn
  for (const [r, c] of shipCells) {
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return false;
  }
  // Check of geen overlap met bestaande schepen
  const occupied = new Set();
  for (const ship of board.ships) {
    for (const [r, c] of ship) {
      occupied.add(r + ',' + c);
    }
  }
  for (const [r, c] of shipCells) {
    if (occupied.has(r + ',' + c)) return false;
  }
  // Check of schepen niet direct naast elkaar (diagonaal mag wel)
  const adjacent = new Set();
  for (const ship of board.ships) {
    for (const [r, c] of ship) {
      adjacent.add((r - 1) + ',' + c);
      adjacent.add((r + 1) + ',' + c);
      adjacent.add(r + ',' + (c - 1));
      adjacent.add(r + ',' + (c + 1));
    }
  }
  for (const [r, c] of shipCells) {
    if (adjacent.has(r + ',' + c)) return false;
  }
  return true;
}

function getRequiredShips() {
  const result = [];
  for (const [length, count] of SHIPS) {
    for (let i = 0; i < count; i++) {
      result.push(length);
    }
  }
  return result.sort((a, b) => b - a); // Langste eerst
}

function getLegalMoves(board, currentPlayer, placementPhase) {
  if (placementPhase) {
    // In placement fase: return alle mogelijke plaatsingen voor het volgende schip
    const required = getRequiredShips();
    const placed = board.ships.length;
    if (placed >= required.length) return []; // Alle schepen geplaatst
    const length = required[placed];
    const moves = [];
    // Horizontaal
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c <= SIZE - length; c++) {
        const ship = [];
        for (let i = 0; i < length; i++) ship.push([r, c + i]);
        if (isValidShipPlacement(board, ship)) {
          moves.push({ type: 'place', ship });
        }
      }
    }
    // Verticaal
    for (let r = 0; r <= SIZE - length; r++) {
      for (let c = 0; c < SIZE; c++) {
        const ship = [];
        for (let i = 0; i < length; i++) ship.push([r + i, c]);
        if (isValidShipPlacement(board, ship)) {
          moves.push({ type: 'place', ship });
        }
      }
    }
    return moves;
  } else {
    // In shooting fase: return alle nog niet beschoten vakjes
    const moves = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const key = r + ',' + c;
        if (!board.shots.has(key)) {
          moves.push({ type: 'shoot', r, c });
        }
      }
    }
    return moves;
  }
}

function applyMove(board, move, currentPlayer) {
  const next = {
    ships: board.ships.map(ship => [...ship]),
    shots: new Set(board.shots),
    hits: new Set(board.hits),
  };
  if (move.type === 'place') {
    next.ships.push(move.ship.map(cell => [...cell]));
  } else if (move.type === 'shoot') {
    const key = move.r + ',' + move.c;
    next.shots.add(key);
    // Check of er een schip is geraakt
    for (const ship of board.ships) {
      for (const [r, c] of ship) {
        if (r === move.r && c === move.c) {
          next.hits.add(key);
          break;
        }
      }
    }
  }
  return next;
}

function checkWinner(board, currentPlayer) {
  // Win als alle schepen van de tegenstander zijn geraakt
  // We controleren niet op currentPlayer omdat we alleen het eigen bord hebben
  // De server moet beide borden checken
  const totalShipCells = board.ships.reduce((sum, ship) => sum + ship.length, 0);
  return board.hits.size >= totalShipCells ? currentPlayer : null;
}

function moveMatches(legalMove, move) {
  if (legalMove.type !== move.type) return false;
  if (move.type === 'place') {
    // Vergelijk schepen (volgorde maakt niet uit)
    const legalCells = new Set(legalMove.ship.map(([r, c]) => r + ',' + c));
    const moveCells = new Set(move.ship.map(([r, c]) => r + ',' + c));
    if (legalCells.size !== moveCells.size) return false;
    for (const cell of legalCells) {
      if (!moveCells.has(cell)) return false;
    }
    return true;
  } else {
    return legalMove.r === move.r && legalMove.c === move.c;
  }
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
  getRequiredShips,
};
