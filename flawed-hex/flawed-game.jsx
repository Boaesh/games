import { useState, useCallback, useRef, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════════
// ELEMENTS
// ═══════════════════════════════════════════════════════════════════
const ELEMENTS = ["fire", "water", "earth", "air"];
const EC = {
  fire:  { light: "#FF8C42", dark: "#8B3000", glow: "#FF4500", bg: "#2e0e02", sym: "🔥", name: "Fire"  },
  water: { light: "#5CC8FF", dark: "#1a5fa0", glow: "#00AAFF", bg: "#061828", sym: "💧", name: "Water" },
  earth: { light: "#72D475", dark: "#2a6b2e", glow: "#00FF66", bg: "#061a08", sym: "🌿", name: "Earth" },
  air:   { light: "#FFE566", dark: "#9a7a10", glow: "#FFD700", bg: "#1c1a04", sym: "🌀", name: "Air"   },
};



// Safe display name for any piece
function pieceName(piece) {
  return EC[piece.element].name;
}

const HUMAN_IDX = 0;
const CPU_IDX   = 1;

// ═══════════════════════════════════════════════════════════════════
// MATCHING RULES
//   Light + Light → valid ONLY if same element
//   Dark  + Dark  → valid only per cycle below
//   Light + Dark  → NEVER valid
//
// Dark cycle: Fire↔Air↔Earth↔Water↔Fire
//   Dark Fire  ↔ Dark Air,   Dark Water
//   Dark Air   ↔ Dark Fire,  Dark Earth
//   Dark Earth ↔ Dark Air,   Dark Water
//   Dark Water ↔ Dark Earth, Dark Fire
// ═══════════════════════════════════════════════════════════════════
const DARK_MATCHES = {
  fire:  ["air",   "water"],
  air:   ["fire",  "earth"],
  earth: ["air",   "water"],
  water: ["earth", "fire" ],
};

function edgesMatch(a, b) {
  if (!a || !b) return false;
  if ( a.isLight &&  b.isLight) return a.element === b.element;
  if (!a.isLight && !b.isLight) return DARK_MATCHES[a.element].includes(b.element);
  return false;
}

// ═══════════════════════════════════════════════════════════════════
// EDGES — fixed layout
//   edges[0,1,2] = LIGHT   edges[3,4,5] = DARK
//   Prism: normal element edges, but piece.special="prism"
// ═══════════════════════════════════════════════════════════════════
function makeEdges(element) {
  return [
    { element, isLight: true  },
    { element, isLight: true  },
    { element, isLight: true  },
    { element, isLight: false },
    { element, isLight: false },
    { element, isLight: false },
  ];
}

// ═══════════════════════════════════════════════════════════════════
// PIECES — 25 × 4 elements = 100 normal tiles
// ═══════════════════════════════════════════════════════════════════
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function makePieces() {
  let id = 0;
  const all = [];
  ELEMENTS.forEach(el => {
    for (let j = 0; j < 25; j++)
      all.push({ id: id++, element: el, edges: makeEdges(el) });
  });
  return shuffle(all);
}

// ═══════════════════════════════════════════════════════════════════
// HEX GEOMETRY — pointy-top axial
//
// Dir → axial delta → opposite:
//   0=NE (+1,−1) opp 3    1=E  (+1, 0) opp 4
//   2=SE ( 0,+1) opp 5    3=SW (−1,+1) opp 0
//   4=W  (−1, 0) opp 1    5=NW ( 0,−1) opp 2
//
// hexCorners at -90° → visual slot i faces board dir i (verified)
// ═══════════════════════════════════════════════════════════════════
const DIRS = [[1,-1],[1,0],[0,1],[-1,1],[-1,0],[0,-1]];
const OPP  = [3,4,5,0,1,2];
const SZ   = 34;
const BOARD_RADIUS = 5;   // 91 cells, fits viewport

function inBounds(q, r) {
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= BOARD_RADIUS;
}
function axialToPixel(q, r) {
  return { x: SZ * Math.sqrt(3) * (q + r/2), y: SZ * 1.5 * r };
}
function hexCorners(cx, cy, s) {
  return Array.from({length:6}, (_, i) => {
    const a = Math.PI / 180 * (-90 + 60 * i);
    return [cx + s * Math.cos(a), cy + s * Math.sin(a)];
  });
}
function hkey(q, r) { return `${q},${r}`; }

// ═══════════════════════════════════════════════════════════════════
// POINT MAP — hybrid scoring:
//   Outer ring (dist=5): fixed visible tiers — 5 / 3 / 2 pts
//     Corner cells (6):      5 pts
//     Near-corner (12):      3 pts
//     Remaining edge (12):   2 pts
//   Interior (dist 1–4):     random 1–4, hidden until revealed
// CPU only knows the outer ring values; interior is a blind guess.
// ═══════════════════════════════════════════════════════════════════
const CORNER_KEYS = new Set(
  [[-5,0],[-5,5],[0,-5],[0,5],[5,-5],[5,0]].map(([q,r]) => hkey(q,r))
);
function buildOuterTiers() {
  const map = {};
  // Corners = 5
  for (const k of CORNER_KEYS) map[k] = 5;
  // Near-corners = 3
  for (const k of CORNER_KEYS) {
    const [q, r] = k.split(",").map(Number);
    for (const [dq, dr] of DIRS) {
      const nq = q+dq, nr = r+dr, nk = hkey(nq, nr);
      if (Math.max(Math.abs(nq),Math.abs(nr),Math.abs(nq+nr)) === BOARD_RADIUS && !CORNER_KEYS.has(nk))
        map[nk] = map[nk] || 3;
    }
  }
  // Remaining boundary = 2
  for (let q=-BOARD_RADIUS; q<=BOARD_RADIUS; q++)
    for (let r=-BOARD_RADIUS; r<=BOARD_RADIUS; r++)
      if (Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r)) === BOARD_RADIUS && !map[hkey(q,r)])
        map[hkey(q,r)] = 2;
  return map;
}
const OUTER_TIERS = buildOuterTiers();

function makePointMap(chokeSet) {
  const map = { ...OUTER_TIERS };
  // Interior cells (dist 1–4): random 1–4, hidden from CPU
  for (let q = -BOARD_RADIUS+1; q <= BOARD_RADIUS-1; q++) {
    for (let r = -BOARD_RADIUS+1; r <= BOARD_RADIUS-1; r++) {
      const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(q+r));
      if (dist >= 1 && dist < BOARD_RADIUS && !chokeSet.has(hkey(q, r)))
        map[hkey(q, r)] = Math.floor(Math.random() * 4) + 1; // 1–4
    }
  }
  return map;
}

// ═══════════════════════════════════════════════════════════════════
// CHOKE POINTS — randomly chosen each game
// Pick 7 interior cells (radii 1-4) that aren't the origin,
// ensuring the origin (0,0) — the first placed piece — stays clear.
// ═══════════════════════════════════════════════════════════════════
function makeChokeSet() {
  // Candidate pool: all interior cells excluding origin and radius-1 ring
  // (keep radius-1 open so the first piece always has neighbours)
  const pool = [];
  for (let q = -BOARD_RADIUS; q <= BOARD_RADIUS; q++) {
    for (let r = -BOARD_RADIUS; r <= BOARD_RADIUS; r++) {
      const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(q+r));
      if (dist >= 2 && dist <= 4) pool.push(hkey(q, r));
    }
  }
  // Fisher-Yates slice
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return new Set(a.slice(0, 7));
}

function isPlayable(q, r, chokeSet) {
  return inBounds(q, r) && !chokeSet.has(hkey(q, r));
}

function getAllCells(chokeSet) {
  const cells = [];
  for (let q = -BOARD_RADIUS; q <= BOARD_RADIUS; q++)
    for (let r = -BOARD_RADIUS; r <= BOARD_RADIUS; r++)
      if (isPlayable(q, r, chokeSet)) cells.push({ q, r });
  return cells;
}

// ═══════════════════════════════════════════════════════════════════
// POINT MAP — randomly assigned per game, hidden until a piece lands
// ═══════════════════════════════════════════════════════════════════
function calcScore(board, playerId, pointMap) {
  let pts = 0;
  for (const cell of Object.values(board)) {
    if (cell.owner !== playerId) continue;
    pts += pointMap[hkey(cell.q, cell.r)] || 0;
  }
  return pts;
}

// ═══════════════════════════════════════════════════════════════════
// GAME INIT
// ═══════════════════════════════════════════════════════════════════
const HAND_SIZE = 5;

// ═══════════════════════════════════════════════════════════════════
// EDGE LOOKUP
// ═══════════════════════════════════════════════════════════════════
function getEdge(piece, rot, dir) {
  return piece.edges[((dir - rot) % 6 + 6) % 6];
}
function canPlace(board, piece, q, r, rot) {
  let hasNeighbour = false;
  for (let dir = 0; dir < 6; dir++) {
    const nb = board[hkey(q + DIRS[dir][0], r + DIRS[dir][1])];
    if (!nb) continue;
    hasNeighbour = true;
    const mine  = getEdge(piece,    rot,         dir);
    const their = getEdge(nb.piece, nb.rotation, OPP[dir]);
    if (!edgesMatch(mine, their)) return false;
  }
  return hasNeighbour;
}

// Valid cells at EXACTLY this rotation, within bounds and not a choke point
function spotsForRotation(board, piece, rot, chokeSet) {
  const occupied = new Set(Object.keys(board));
  const candidates = new Set();
  if (!occupied.size) {
    if (isPlayable(0, 0, chokeSet)) candidates.add("0,0");
  } else {
    for (const k of occupied) {
      const [q, r] = k.split(",").map(Number);
      for (const [dq, dr] of DIRS) {
        const nq = q + dq, nr = r + dr;
        const nk = hkey(nq, nr);
        if (!occupied.has(nk) && isPlayable(nq, nr, chokeSet)) candidates.add(nk);
      }
    }
  }
  const results = [];
  for (const k of candidates) {
    const [q, r] = k.split(",").map(Number);
    if (canPlace(board, piece, q, r, rot)) results.push({ q, r });
  }
  return results;
}

function hasAnyValidPlacement(board, piece, chokeSet) {
  for (let rot = 0; rot < 6; rot++)
    if (spotsForRotation(board, piece, rot, chokeSet).length > 0) return true;
  return false;
}

// Returns all {q,r} cells where this piece can be placed at ANY rotation
function anyRotationSpots(board, piece, chokeSet) {
  const seen = new Set();
  const results = [];
  for (let rot = 0; rot < 6; rot++) {
    for (const { q, r } of spotsForRotation(board, piece, rot, chokeSet)) {
      const k = hkey(q, r);
      if (!seen.has(k)) { seen.add(k); results.push({ q, r }); }
    }
  }
  return results;
}

// For each piece in the human's hand+reserve, returns true if playable at any rotation
function handPlayability(board, player, chokeSet) {
  return {
    hand:    player.hand.map(p    => hasAnyValidPlacement(board, p, chokeSet)),
    reserve: player.reserve.map(p => hasAnyValidPlacement(board, p, chokeSet)),
  };
}

// ═══════════════════════════════════════════════════════════════════
// AI — CPU knows outer ring tiers but is blind to interior random values
// ═══════════════════════════════════════════════════════════════════
function cpuBestMove(board, player, chokeSet) {
  const allPieces = [
    ...player.hand.map((p, i) => ({ piece: p, idx: i, fromReserve: false })),
    ...player.reserve.map((p, i) => ({ piece: p, idx: i, fromReserve: true })),
  ];

  let best = null;
  let bestScore = -Infinity;

  for (const { piece, idx, fromReserve } of allPieces) {
    for (let rot = 0; rot < 6; rot++) {
      const spots = spotsForRotation(board, piece, rot, chokeSet);
      for (const { q, r } of spots) {
        let neighbours = 0;
        for (const [dq, dr] of DIRS)
          if (board[hkey(q + dq, r + dr)]) neighbours++;

        // Outer ring tiers are public — everyone can see 5/3/2 on the board.
        // Interior random values (1–4) are hidden — CPU uses a flat guess of 2.
        const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
        const ptVal = dist === BOARD_RADIUS
          ? (OUTER_TIERS[hkey(q, r)] || 2)  // public knowledge
          : 2;                                // blind to random interior values

        const score = ptVal * 20 + neighbours * 5 - (fromReserve ? 8 : 0);
        if (score > bestScore) {
          bestScore = score;
          best = { piece, idx, fromReserve, q, r, rot };
        }
      }
    }
  }
  return best;
}

function initGame() {
  const chokeSet = makeChokeSet();
  const pointMap = makePointMap(chokeSet);
  const bag   = makePieces();
  const first = bag.pop();
  const board = { "0,0": { piece: first, rotation: 0, q: 0, r: 0 } };
  const players = [
    { id: HUMAN_IDX, name: "You",      hand: bag.splice(0, HAND_SIZE), reserve: [] },
    { id: CPU_IDX,   name: "Computer", hand: bag.splice(0, HAND_SIZE), reserve: [] },
  ];
  return {
    bag, board, players, chokeSet, pointMap,
    turn: HUMAN_IDX,
    drawnThisTurn: false,
    selected: null,
    rotation: 0,
    spots: [],
    hintSpots: [],
    gameOver: false,
    winner: null,
    msg: "Your turn — pick a hex from your hand",
    cpuLastMove: null,
  };
}

// Game ends when BOTH players have no valid placement for any piece they hold.
// Winner = most points scored from outer-edge placements.
// Tiebreaker = fewest pieces still held. Both tied = draw.
function checkEnd(bag, players, board, chokeSet, pointMap) {
  const anyPlay = players.some(p =>
    [...p.hand, ...p.reserve].some(pc => hasAnyValidPlacement(board, pc, chokeSet))
  );
  if (anyPlay) return null;

  const scores  = players.map(p => calcScore(board, p.id, pointMap));
  const held    = players.map(p => p.hand.length + p.reserve.length);

  if (scores[0] !== scores[1]) {
    const wi = scores[0] > scores[1] ? 0 : 1;
    return { winIdx: wi, scores, held,
      msg: `${players[wi].name} wins with ${scores[wi]} point${scores[wi]!==1?"s":""}!` };
  }
  // Scores tied — fewest pieces held wins
  if (held[0] !== held[1]) {
    const wi = held[0] < held[1] ? 0 : 1;
    return { winIdx: wi, scores, held,
      msg: `${players[wi].name} wins on tiebreaker — fewer pieces held!` };
  }
  return { winIdx: -1, scores, held, msg: "It's a draw!" };
}

function getPiece(g, selected) {
  if (!selected) return null;
  const p = g.players[g.turn];
  return selected.fromReserve ? p.reserve[selected.idx] : p.hand[selected.idx];
}

// ═══════════════════════════════════════════════════════════════════
// APPLY MOVE — shared by human place() and CPU tick
// ═══════════════════════════════════════════════════════════════════
function applyMove(g, { piece, idx, fromReserve, q, r, rot }) {
  const newBoard = { ...g.board, [hkey(q, r)]: { piece, rotation: rot, q, r, owner: g.turn } };
  const newBag   = [...g.bag];
  const next     = (g.turn + 1) % 2;

  const newPlayers = g.players.map((p, i) => {
    if (i !== g.turn) return p;
    const hand    = fromReserve ? [...p.hand] : p.hand.filter((_, j) => j !== idx);
    const reserve = fromReserve ? p.reserve.filter((_, j) => j !== idx) : [...p.reserve];
    while (hand.length < HAND_SIZE && newBag.length > 0) hand.push(newBag.pop());
    return { ...p, hand, reserve };
  });

  const over = checkEnd(newBag, newPlayers, newBoard, g.chokeSet, g.pointMap);

  // Point flash: reveal hidden value for this cell
  const earned = g.pointMap[hkey(q, r)] || 0;
  const newFlash = { key: hkey(q, r), pts: earned, owner: g.turn, id: Date.now() };

  const placedMsg = earned > 0 && g.turn === HUMAN_IDX ? ` · +${earned}pt revealed!` : "";

  let nextMsg;
  if (over) {
    nextMsg = `Game Over! ${over.msg}`;
  } else if (next === HUMAN_IDX) {
    const allHuman = [...newPlayers[HUMAN_IDX].hand, ...newPlayers[HUMAN_IDX].reserve];
    const anyPlayable = allHuman.some(p => hasAnyValidPlacement(newBoard, p, g.chokeSet));
    nextMsg = anyPlayable
      ? `Your turn — pick a hex${placedMsg}`
      : newBag.length > 0
        ? "No pieces playable — draw from the bag"
        : "No pieces playable and bag is empty — you must pass";
  } else {
    nextMsg = "Computer is thinking…";
  }

  return {
    ...g,
    board: newBoard, bag: newBag, players: newPlayers,
    turn: over ? g.turn : next,
    drawnThisTurn: false,
    selected: null, rotation: 0, spots: [], hintSpots: [],
    gameOver: !!over, winner: over || null,
    cpuLastMove: g.turn === CPU_IDX ? { q, r } : null,
    newFlash,  // picked up by App to push into pointFlashes
    msg: nextMsg,
  };
}

// ═══════════════════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════════════════
export default function App() {
  const [G, setG]           = useState(initGame);
  const [off, setOff]       = useState({ x: 0, y: 0 });
  const [showRules, setShowRules] = useState(false);
  const [pointFlashes, setPointFlashes] = useState([]);
  const drag = useRef(null);

  const W = 580, H = 390;
  const ox = W / 2 + off.x;
  const oy = H / 2 + off.y;

  // ── CPU auto-play ─────────────────────────────────────────────
  // Fires after a short delay whenever it's the CPU's turn
  useEffect(() => {
    if (G.gameOver || G.turn !== CPU_IDX) return;
    const timer = setTimeout(() => {
      setG(g => {
        if (g.gameOver || g.turn !== CPU_IDX) return g;
        const move = cpuBestMove(g.board, g.players[CPU_IDX], g.chokeSet);
        if (move) return applyMove(g, move);

        // No valid move — CPU draws from bag or skips
        if (g.bag.length > 0) {
          const newBag = [...g.bag];
          const drawn  = newBag.pop();
          const playable = hasAnyValidPlacement(g.board, drawn, g.chokeSet);
          const newPlayers = g.players.map((p, i) => {
            if (i !== CPU_IDX) return p;
            return playable
              ? { ...p, hand: [...p.hand, drawn] }
              : { ...p, reserve: [...p.reserve, drawn] };
          });
          const next = (g.turn + 1) % 2;
          const over = checkEnd(newBag, newPlayers, g.board, g.chokeSet, g.pointMap);
          return {
            ...g, bag: newBag, players: newPlayers,
            turn: over ? g.turn : next,
            drawnThisTurn: false,
            gameOver: !!over, winner: over || null,
            cpuLastMove: null, hintSpots: [],
            msg: over ? `Game Over! ${over.msg}` : "Your turn — pick a hex from your hand",
          };
        }

        // Nothing to draw — check if game is fully over (both stuck)
        {
          const over = checkEnd(g.bag, g.players, g.board, g.chokeSet, g.pointMap);
          if (over) {
            return { ...g, gameOver: true, winner: over, msg: `Game Over! ${over.msg}`, cpuLastMove: null };
          }
        }

        // Skip turn — human might still be able to move
        return {
          ...g, turn: HUMAN_IDX,
          drawnThisTurn: false,
          msg: "Computer passed — your turn",
          cpuLastMove: null,
        };
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [G.turn, G.gameOver]);

  // Clear CPU highlight after a moment
  useEffect(() => {
    if (!G.cpuLastMove) return;
    const t = setTimeout(() => setG(g => ({ ...g, cpuLastMove: null })), 900);
    return () => clearTimeout(t);
  }, [G.cpuLastMove]);

  // Handle point flash — push to flashes list, auto-remove after 2s
  useEffect(() => {
    if (!G.newFlash) return;
    const flash = G.newFlash;
    setPointFlashes(f => [...f, flash]);
    setG(g => ({ ...g, newFlash: null }));
    const t = setTimeout(() => setPointFlashes(f => f.filter(x => x.id !== flash.id)), 2000);
    return () => clearTimeout(t);
  }, [G.newFlash]);

  // ── Human actions ─────────────────────────────────────────────
  const selectPiece = useCallback((pi, idx, fromReserve) => {
    setG(g => {
      if (g.turn !== HUMAN_IDX || g.turn !== pi || g.gameOver) return g;
      const piece    = fromReserve ? g.players[pi].reserve[idx] : g.players[pi].hand[idx];
      const rot      = 0;
      const spots    = spotsForRotation(g.board, piece, rot, g.chokeSet);
      const canPlay  = hasAnyValidPlacement(g.board, piece, g.chokeSet);
      const hints    = canPlay && spots.length === 0 ? anyRotationSpots(g.board, piece, g.chokeSet) : [];
      return {
        ...g, selected: { idx, fromReserve }, rotation: rot, spots, hintSpots: hints,
        msg: !canPlay
          ? `${pieceName(piece)} has no valid placements anywhere — try another piece or draw`
          : spots.length > 0
            ? `Placing ${pieceName(piece)} — ${spots.length} spot${spots.length!==1?"s":""} available. Click to place or rotate`
            : `${pieceName(piece)} needs rotating — highlighted cells show where it can fit`,
      };
    });
  }, []);

  const rotate = useCallback(d => {
    setG(g => {
      if (!g.selected || g.turn !== HUMAN_IDX) return g;
      const newRot = (g.rotation + d + 6) % 6;
      const piece  = getPiece(g, g.selected);
      const spots  = spotsForRotation(g.board, piece, newRot, g.chokeSet);
      const hints  = spots.length === 0 ? anyRotationSpots(g.board, piece, g.chokeSet) : [];
      return {
        ...g, rotation: newRot, spots, hintSpots: hints,
        msg: spots.length
          ? `${pieceName(piece)} at ${newRot*60}° — ${spots.length} valid spot${spots.length!==1?"s":""}. Click to place`
          : `${pieceName(piece)} at ${newRot*60}° — no spots here. Highlighted cells show where it can fit`,
      };
    });
  }, []);

  const place = useCallback((q, r) => {
    setG(g => {
      if (!g.selected || g.gameOver || g.turn !== HUMAN_IDX) return g;
      const piece = getPiece(g, g.selected);
      const rot   = g.rotation;
      if (!canPlace(g.board, piece, q, r, rot)) return g;
      const { idx, fromReserve } = g.selected;
      return applyMove(g, { piece, idx, fromReserve, q, r, rot });
    });
  }, []);

  const draw = useCallback(() => {
    setG(g => {
      if (!g.bag.length || g.gameOver || g.turn !== HUMAN_IDX || g.drawnThisTurn) return g;
      const newBag   = [...g.bag];
      const drawn    = newBag.pop();
      const playable = hasAnyValidPlacement(g.board, drawn, g.chokeSet);
      const newPlayers = g.players.map((p, i) => {
        if (i !== HUMAN_IDX) return p;
        return playable ? { ...p, hand: [...p.hand, drawn] } : { ...p, reserve: [...p.reserve, drawn] };
      });
      // If drawn piece is unplayable, turn passes to CPU; otherwise human keeps turn (but can't draw again)
      const next = playable ? HUMAN_IDX : CPU_IDX;
      const over = checkEnd(newBag, newPlayers, g.board, g.chokeSet, g.pointMap);
      return {
        ...g, bag: newBag, players: newPlayers,
        turn: over ? g.turn : next,
        drawnThisTurn: playable ? true : false,  // reset when turn passes, lock if staying
        selected: null, rotation: 0, spots: [], hintSpots: [],
        gameOver: !!over, winner: over || null,
        cpuLastMove: null,
        msg: over ? `Game Over! ${over.msg}`
          : playable ? `Drew ${pieceName(drawn)} — added to hand. Now place it or pass.`
          : `Drew ${pieceName(drawn)} — unplayable, sent to reserve. Computer's turn…`,
      };
    });
  }, []);

  const cancel = () => setG(g => ({
    ...g, selected: null, rotation: 0, spots: [], hintSpots: [],
    msg: "Your turn — pick a hex from your hand",
  }));

  const reset = () => { setG(initGame()); setOff({ x: 0, y: 0 }); };

  // ── Pan ───────────────────────────────────────────────────────
  const PAN = 60;
  const pan = (dx, dy) => setOff(o => ({ x: o.x + dx, y: o.y + dy }));
  const recenter = () => setOff({ x: 0, y: 0 });

  // Touch drag
  const onTouchStart = e => {
    const t = e.touches[0];
    drag.current = { sx: t.clientX - off.x, sy: t.clientY - off.y };
  };
  const onTouchMove = e => {
    if (!drag.current) return;
    const t = e.touches[0];
    setOff({ x: t.clientX - drag.current.sx, y: t.clientY - drag.current.sy });
  };
  const onTouchEnd = () => { drag.current = null; };

  const { board, players, turn, selected, rotation, spots, hintSpots, gameOver: over, winner, msg, bag, cpuLastMove } = G;
  const previewPiece = getPiece(G, selected);
  const isCpuTurn    = turn === CPU_IDX && !over;

  // Live scores
  const scores = players.map(p => calcScore(board, p.id, G.pointMap));

  // Per-piece playability for human hand/reserve — used for visual hints
  const playability = !isCpuTurn && !over
    ? handPlayability(board, players[HUMAN_IDX], G.chokeSet)
    : { hand: [], reserve: [] };

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 25% 25%,#1e1a2e 0%,#181818 55%,#0e1a1c 100%)",
      fontFamily: "'Cinzel',Georgia,serif", color: "#e8e0d5",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "10px 8px", userSelect: "none",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;800&family=Crimson+Text:ital,wght@0,400;1,400&display=swap');
        .hx{transition:all .15s ease}
        .hx:hover{filter:brightness(1.45) drop-shadow(0 0 5px rgba(255,210,100,.45));transform:translateY(-3px);cursor:pointer}
        .hx.sel{filter:brightness(1.6) drop-shadow(0 0 9px rgba(255,220,80,.65));transform:translateY(-7px)}
        @keyframes sp{0%,100%{opacity:.28}55%{opacity:.82}}
        .sp{animation:sp 1.5s ease-in-out infinite}
        .sp:hover{opacity:1!important;animation:none;cursor:pointer}
        @keyframes fu{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .fu{animation:fu .4s ease forwards}
        .gb{transition:all .18s;cursor:pointer;border-radius:6px;font-family:'Cinzel',serif;font-size:.7rem;letter-spacing:.07em;padding:6px 13px}
        .gb:hover{filter:brightness(1.35);transform:translateY(-1px)}
        .pb{transition:all .14s;cursor:pointer;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#aaa;border-radius:5px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:.85rem}
        .pb:hover{background:rgba(255,255,255,.14);color:#fff}
        .qbtn{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.2);color:#999;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:.85rem;font-family:'Cinzel',serif;display:inline-flex;align-items:center;justify-content:center;transition:all .2s;position:absolute;right:0;top:50%;transform:translateY(-50%);line-height:1}
        .qbtn:hover{background:rgba(255,255,255,.18);color:#fff;border-color:rgba(255,255,255,.4)}
        @keyframes cpu-pulse{0%,100%{opacity:.3}50%{opacity:.9}}
        .cpu-last{animation:cpu-pulse .45s ease-in-out 2}
        @keyframes pt-flash{0%{opacity:0;transform:scale(.7)}12%{opacity:1;transform:scale(1.08)}22%{transform:scale(1)}75%{opacity:1}100%{opacity:0;transform:scale(.95)}}
        .pt-flash{animation:pt-flash 2s cubic-bezier(.16,1,.3,1) forwards}
      `}</style>

      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: "7px" }}>
        <h1 style={{
          margin: 0, fontSize: "1.9rem", fontWeight: 800, letterSpacing: ".38em",
          background: "linear-gradient(100deg,#FF8C42 0%,#FFE566 33%,#72D475 66%,#5CC8FF 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>F L A W E D</h1>
        <p style={{ margin: "1px 0 0", fontSize: ".64rem", letterSpacing: ".22em", color: "#666", fontFamily: "'Crimson Text',serif" }}>
          Fire · Light · Air · Water · Earth · Dark
        </p>
      </div>

      {/* Status */}
      <div style={{
        background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.13)",
        borderRadius: "6px", padding: "5px 16px", marginBottom: "7px",
        fontSize: ".74rem", color: isCpuTurn ? "#8bc48b" : "#ccc",
        fontFamily: "'Crimson Text',serif", fontStyle: "italic",
        maxWidth: "560px", textAlign: "center",
        transition: "color .3s",
      }}>{msg}</div>

      {/* Board */}
      <div style={{ position: "relative", marginBottom: "7px" }}>
        <div style={{
          border: "1px solid rgba(255,255,255,.18)", borderRadius: "10px",
          overflow: "hidden", background: "rgba(20,18,30,.85)",
        }}>
          <svg width={W} height={H}
            onMouseDown={e => { drag.current = { sx: e.clientX - off.x, sy: e.clientY - off.y }; }}
            onMouseMove={e => { if (drag.current) setOff({ x: e.clientX - drag.current.sx, y: e.clientY - drag.current.sy }); }}
            onMouseUp={() => { drag.current = null; }}
            onMouseLeave={() => { drag.current = null; }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            style={{ cursor: drag.current ? "grabbing" : "grab", display: "block" }}
          >
            <defs>
              <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="4" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <rect width={W} height={H} fill="transparent"/>

            {/* Full hex grid — outer ring shows scoring tiers, interior cells hidden */}
            {getAllCells(G.chokeSet).map(({ q, r }) => {
              const { x, y } = axialToPixel(q, r);
              const isEmpty = !board[hkey(q, r)];
              const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(q+r));
              const isEdge = dist === BOARD_RADIUS;
              const tierPts = isEdge ? (OUTER_TIERS[hkey(q,r)] || 2) : 0;
              const fillCol = isEdge
                ? (tierPts === 5 ? "rgba(255,200,60,.15)" : tierPts === 3 ? "rgba(255,140,60,.11)" : "rgba(100,180,255,.08)")
                : isEmpty ? "rgba(255,255,255,.03)" : "none";
              const strokeCol = isEdge
                ? (tierPts === 5 ? "rgba(255,200,60,.55)" : tierPts === 3 ? "rgba(255,140,60,.40)" : "rgba(100,180,255,.30)")
                : "rgba(255,255,255,.10)";
              return (
                <g key={`g${q},${r}`} style={{ pointerEvents: "none" }}>
                  <polygon
                    points={hexCorners(ox+x, oy+y, SZ - 0.5).map(p => p.join(",")).join(" ")}
                    fill={fillCol}
                    stroke={strokeCol}
                    strokeWidth={isEdge ? 0.9 : 0.5}
                  />
                  {isEmpty && isEdge && (
                    <text x={ox+x} y={oy+y+1} textAnchor="middle" dominantBaseline="middle"
                      fontSize={tierPts === 5 ? 9 : 8}
                      fill={tierPts === 5 ? "rgba(255,200,60,.80)" : tierPts === 3 ? "rgba(255,140,60,.70)" : "rgba(100,180,255,.65)"}
                      style={{ pointerEvents:"none", userSelect:"none" }}
                    >{tierPts}pt</text>
                  )}
                  {isEmpty && !isEdge && (
                    <text x={ox+x} y={oy+y+1} textAnchor="middle" dominantBaseline="middle"
                      fontSize={7} fill="rgba(255,255,255,.18)"
                      style={{ pointerEvents:"none", userSelect:"none" }}>?</text>
                  )}
                </g>
              );
            })}

            {/* Choke points — dark blocked cells with X */}
            {Array.from(G.chokeSet).map(k => {
              const [q, r] = k.split(",").map(Number);
              const { x, y } = axialToPixel(q, r);
              const pts2 = hexCorners(ox+x, oy+y, SZ - 1);
              const d = SZ * 0.28;
              return (
                <g key={`chk${k}`} style={{ pointerEvents: "none" }}>
                  <polygon points={pts2.map(p => p.join(",")).join(" ")}
                    fill="rgba(40,10,10,.7)" stroke="rgba(180,30,30,.3)" strokeWidth={1} />
                  <line x1={ox+x-d} y1={oy+y-d} x2={ox+x+d} y2={oy+y+d}
                    stroke="rgba(180,30,30,.4)" strokeWidth={1.5} strokeLinecap="round"/>
                  <line x1={ox+x+d} y1={oy+y-d} x2={ox+x-d} y2={oy+y+d}
                    stroke="rgba(180,30,30,.4)" strokeWidth={1.5} strokeLinecap="round"/>
                </g>
              );
            })}

            {/* CPU last-move highlight */}
            {cpuLastMove && (() => {
              const { x, y } = axialToPixel(cpuLastMove.q, cpuLastMove.r);
              return (
                <polygon className="cpu-last"
                  points={hexCorners(ox+x, oy+y, SZ+4).map(p=>p.join(",")).join(" ")}
                  fill="none" stroke="rgba(100,220,140,.7)" strokeWidth={2.5}
                  style={{ pointerEvents: "none" }}
                />
              );
            })()}

            {/* Hint spots — cells reachable at some rotation, but NOT current rotation */}
            {!over && !isCpuTurn && hintSpots && hintSpots.map(({ q, r }) => {
              const { x, y } = axialToPixel(q, r);
              const pts2 = hexCorners(ox+x, oy+y, SZ - 3);
              return (
                <polygon key={`h${q},${r}`}
                  points={pts2.map(p => p.join(",")).join(" ")}
                  fill="rgba(180,120,255,.06)"
                  stroke="rgba(180,120,255,.35)"
                  strokeWidth={1} strokeDasharray="3,4"
                  style={{ pointerEvents: "none" }}
                />
              );
            })}

            {/* Valid placement spots */}
            {!over && !isCpuTurn && spots.map(({ q, r }) => {
              const { x, y } = axialToPixel(q, r);
              const pts2 = hexCorners(ox+x, oy+y, SZ - 2);
              return (
                <g key={`sp${q},${r}`} className="sp" onClick={() => place(q, r)}>
                  <polygon
                    points={pts2.map(p => p.join(",")).join(" ")}
                    fill="rgba(255,255,255,.04)"
                    stroke="rgba(255,240,180,.65)"
                    strokeWidth={1.5} strokeDasharray="5,3"
                  />
                  {previewPiece && (
                    <g opacity={0.4} style={{ pointerEvents: "none" }}>
                      <HexPiece piece={previewPiece} rotation={rotation} size={SZ} cx={ox+x} cy={oy+y} mini />
                    </g>
                  )}
                </g>
              );
            })}

            {/* Board pieces */}
            {Object.values(board).map(({ piece, rotation: rot, q, r }) => {
              const { x, y } = axialToPixel(q, r);
              return <HexPiece key={piece.id} piece={piece} rotation={rot} size={SZ} cx={ox+x} cy={oy+y} />;
            })}
          </svg>
        </div>
      </div>

      {/* Controls row */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "7px", flexWrap: "wrap", justifyContent: "center" }}>
        <span style={{ fontSize: ".67rem", color: "#888" }}>🎒 {bag.length}</span>
        {players.map(p => (
          <span key={p.id} style={{ fontSize: ".67rem", color: p.id === turn && !over ? "#ddd" : "#666" }}>
            {p.name}: {p.reserve.length} rsv
          </span>
        ))}
        {selected && !isCpuTurn && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <button className="gb" onClick={() => rotate(-1)}
                style={{ background: "rgba(255,255,255,.07)", color: "#ccc", border: "1px solid rgba(255,255,255,.14)" }}>↺</button>
              <span style={{ fontSize: ".67rem", color: "#777", minWidth: "30px", textAlign: "center" }}>{rotation*60}°</span>
              <button className="gb" onClick={() => rotate(1)}
                style={{ background: "rgba(255,255,255,.07)", color: "#ccc", border: "1px solid rgba(255,255,255,.14)" }}>↻</button>
            </div>
            <button className="gb" onClick={cancel}
              style={{ background: "rgba(255,200,60,.07)", color: "#FFE566", border: "1px solid rgba(255,200,60,.2)" }}>Cancel</button>
          </>
        )}
        {!over && !isCpuTurn && bag.length > 0 && (
          <button className="gb" onClick={draw}
            disabled={G.drawnThisTurn}
            style={{
              background: G.drawnThisTurn ? "rgba(255,255,255,.02)" : "rgba(255,255,255,.06)",
              color: G.drawnThisTurn ? "#555" : "#bbb",
              border: `1px solid ${G.drawnThisTurn ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.13)"}`,
              cursor: G.drawnThisTurn ? "not-allowed" : "pointer",
            }}>
            Draw ({bag.length}){G.drawnThisTurn ? " ✓" : ""}
          </button>
        )}
        <button className="gb" onClick={reset}
          style={{ background: "rgba(255,70,20,.07)", color: "#FF8C42", border: "1px solid rgba(255,70,20,.2)" }}>
          New Game
        </button>
        <button className="gb" onClick={() => setShowRules(true)}
          style={{ background: "rgba(100,160,255,.07)", color: "#88aaff", border: "1px solid rgba(100,160,255,.2)" }}>
          How to Play
        </button>
      </div>

      {/* Player panels */}
      <div style={{ display: "flex", gap: "10px", width: "100%", maxWidth: "580px" }}>
        {players.map((player, pi) => {
          const active   = pi === turn && !over;
          const isHuman  = pi === HUMAN_IDX;
          return (
            <div key={pi} style={{
              flex: 1,
              background: active ? "rgba(255,255,255,.10)" : "rgba(255,255,255,.04)",
              border: `1px solid ${active ? "rgba(255,255,255,.28)" : "rgba(255,255,255,.09)"}`,
              borderRadius: "9px", padding: "9px", transition: "all .3s",
              opacity: isCpuTurn && isHuman ? 0.6 : 1,
            }}>
              <div style={{
                fontSize: ".75rem", fontWeight: 600, letterSpacing: ".09em",
                marginBottom: "7px", color: active ? "#f0e8e0" : "#686868",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span>{player.name} {active ? (isHuman ? "▶" : "⚙") : ""}</span>
                <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                  <span style={{
                    fontSize: ".78rem", fontWeight: 800, letterSpacing: ".05em",
                    color: active ? "#FFE566" : "#666",
                  }}>{scores[pi]}pt</span>
                  <span style={{ fontSize: ".62rem", color: "#777" }}>· {player.hand.length + player.reserve.length} held</span>
                </div>
              </div>
              <div style={{ marginBottom: "5px" }}>
                <div style={{ fontSize: ".57rem", color: "#888", marginBottom: "3px", letterSpacing: ".13em" }}>HAND</div>
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                  {player.hand.map((piece, idx) => {
                    const sel      = active && isHuman && selected && !selected.fromReserve && selected.idx === idx;
                    const canPlay  = isHuman ? playability.hand[idx] : true;
                    return (
                      <svg key={piece.id} width={52} height={52}
                        className={`hx${sel ? " sel" : ""}`}
                        onClick={() => isHuman && active && selectPiece(pi, idx, false)}
                        style={{ cursor: isHuman && active ? "pointer" : "default" }}>
                        {/* Playability ring */}
                        {isHuman && active && !sel && (
                          <polygon
                            points={hexCorners(26, 26, 23).map(p=>p.join(",")).join(" ")}
                            fill="none"
                            stroke={canPlay ? "rgba(100,220,130,.55)" : "rgba(220,80,80,.45)"}
                            strokeWidth={1.5}
                          />
                        )}
                        <HexPiece piece={piece} rotation={sel ? rotation : 0} size={21} cx={26} cy={26} highlight={sel} mini />
                        {/* Dim overlay for unplayable */}
                        {isHuman && active && !sel && !canPlay && (
                          <polygon
                            points={hexCorners(26, 26, 22).map(p=>p.join(",")).join(" ")}
                            fill="rgba(0,0,0,.35)"
                          />
                        )}
                      </svg>
                    );
                  })}
                  {!player.hand.length && (
                    <span style={{ fontSize: ".64rem", color: "#666", fontStyle: "italic", fontFamily: "'Crimson Text',serif" }}>empty</span>
                  )}
                </div>
              </div>
              {player.reserve.length > 0 && (
                <div>
                  <div style={{ fontSize: ".57rem", color: "#888", marginBottom: "3px", letterSpacing: ".13em" }}>RESERVE</div>
                  <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
                    {player.reserve.map((piece, idx) => {
                      const sel     = active && isHuman && selected && selected.fromReserve && selected.idx === idx;
                      const canPlay = isHuman ? playability.reserve[idx] : true;
                      return (
                        <svg key={piece.id} width={44} height={44}
                          className={`hx${sel ? " sel" : ""}`}
                          onClick={() => isHuman && active && selectPiece(pi, idx, true)}
                          style={{ cursor: isHuman && active ? "pointer" : "default", opacity: .82 }}>
                          {isHuman && active && !sel && (
                            <polygon
                              points={hexCorners(22, 22, 19).map(p=>p.join(",")).join(" ")}
                              fill="none"
                              stroke={canPlay ? "rgba(100,220,130,.4)" : "rgba(220,80,80,.3)"}
                              strokeWidth={1.5}
                            />
                          )}
                          <HexPiece piece={piece} rotation={0} size={18} cx={22} cy={22} highlight={sel} mini />
                          {isHuman && active && !sel && !canPlay && (
                            <polygon
                              points={hexCorners(22, 22, 18).map(p=>p.join(",")).join(" ")}
                              fill="rgba(0,0,0,.42)"
                            />
                          )}
                        </svg>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pan controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", marginTop: "8px", opacity: 0.75 }}>
        <button className="pb" onClick={() => pan(PAN, 0)}>◀</button>
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          <button className="pb" onClick={() => pan(0, PAN)}>▲</button>
          <button className="pb" onClick={() => pan(0, -PAN)}>▼</button>
        </div>
        <button className="pb" onClick={() => pan(-PAN, 0)}>▶</button>
        <button className="pb" onClick={recenter} style={{ fontSize: ".6rem", color: "#aaa", marginLeft: "2px" }}>●</button>
      </div>

      {/* Legend */}
      <div style={{
        marginTop: "9px", display: "flex", gap: "10px", flexWrap: "wrap",
        justifyContent: "center", fontSize: ".59rem", color: "#666",
        fontFamily: "'Crimson Text',serif",
      }}>
        {ELEMENTS.map(el => (
          <span key={el} style={{ color: EC[el].light }}>{EC[el].sym} {EC[el].name}</span>
        ))}
        <span>· Bright = Light · Dim = Dark · Edge ring = visible pts · ? = hidden interior pts · Drag or ▲▼◀▶ to pan</span>
      </div>

      {/* Rules modal */}
      {showRules && (
        <div className="fu" style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.88)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 300, padding: "16px",
        }} onClick={() => setShowRules(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "linear-gradient(160deg,#1a1a2e,#141e14)",
            border: "1px solid rgba(255,255,255,.2)",
            borderRadius: "14px", padding: "28px 32px",
            maxWidth: "480px", width: "100%", maxHeight: "85vh", overflowY: "auto",
            fontFamily: "'Crimson Text',serif", color: "#ccc", lineHeight: 1.65,
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
              <h2 style={{
                margin: 0, fontFamily: "'Cinzel',serif", fontSize: "1.3rem",
                fontWeight: 800, letterSpacing: ".25em",
                background: "linear-gradient(90deg,#FF8C42,#FFE566,#72D475,#5CC8FF)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>HOW TO PLAY</h2>
              <button onClick={() => setShowRules(false)} style={{
                background: "none", border: "none", color: "#555", cursor: "pointer",
                fontSize: "1.2rem", lineHeight: 1, padding: "0 4px",
              }}>✕</button>
            </div>

            {/* Goal */}
            <Section title="🎯 Goal">
              Score points by placing hexes on the outer edge of the board. The player with the most points when no more moves are possible wins. If scores tie, fewest pieces held is the tiebreaker.
            </Section>

            {/* Setup */}
            <Section title="🎲 Setup">
              100 hexes are shuffled into a bag — 25 each of Fire 🔥, Water 💧, Earth 🌿, and Air 🌀. One hex is placed at the centre. Each player draws 5 hexes into their hand.
            </Section>

            {/* Your turn */}
            <Section title="▶ Your Turn">
              <strong style={{color:"#ddd"}}>1. Select</strong> a hex from your hand (green ring = playable, red ring = no valid placement).<br/>
              <strong style={{color:"#ddd"}}>2. Rotate</strong> using ↺ ↻ until valid spots appear (gold dashes). Purple dashes show where it can fit at a different rotation.<br/>
              <strong style={{color:"#ddd"}}>3. Click</strong> a valid spot to place it. You draw back up to 5 in hand.<br/>
              <strong style={{color:"#ddd"}}>No moves?</strong> You may draw <em>once</em> per turn from the bag. If playable it goes to your hand (you can still place this turn); if not, it goes to reserve and your turn passes. The Draw button locks after use.
            </Section>

            {/* Scoring */}
            <Section title="🏆 Scoring">
              The board has two scoring zones:
              <table style={{ width:"100%", marginTop:"8px", borderCollapse:"collapse", fontSize:".85rem" }}>
                <tbody>
                  {[
                    ["⭐⭐⭐ Corner cells (6)", "5 pts — visible", "rgba(255,200,60,.8)"],
                    ["⭐⭐ Near-corner (12)",   "3 pts — visible", "rgba(255,140,60,.7)"],
                    ["⭐ Mid-edge (12)",         "2 pts — visible", "rgba(100,180,255,.65)"],
                    ["? Interior cells (1–4)", "1–4 pts — hidden!", "rgba(200,200,200,.5)"],
                  ].map(([label, pts, col]) => (
                    <tr key={label}>
                      <td style={{ padding:"3px 10px 3px 0", color:col }}>{label}</td>
                      <td style={{ padding:"3px 0", color:"#777", fontWeight:700 }}>{pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <br/>Interior cells show <strong style={{color:"rgba(255,255,255,.4)"}}>?</strong> until a tile is placed — the hidden value (1–4) bursts onto the screen when revealed. The computer doesn't know interior values either, so interior play is a gamble for everyone!
            </Section>

            {/* Choke points */}
            <Section title="🚫 Choke Points">
              Seven interior cells are permanently blocked (shown as dark cells with ✕). They create corridors and force you to route carefully toward the high-value edge. You cannot place a hex on a choke point.
            </Section>

            {/* Edge rules */}
            <Section title="🔗 Edge Rules">
              Each hex has 6 edges — 3 <span style={{color:"#FFE566"}}>Light</span> (bright) and 3 <span style={{color:"#555"}}>Dark</span> (dim). Edges must match the edge they touch:
              <table style={{ width:"100%", marginTop:"8px", borderCollapse:"collapse", fontSize:".85rem" }}>
                <tbody>
                  {[
                    ["Light ↔ Light", "Same element only", "#72D475"],
                    ["Dark ↔ Dark",   "Must follow the cycle (see below)", "#aaa"],
                    ["Light ↔ Dark",  "Never valid", "#e06060"],
                  ].map(([pair, rule, col]) => (
                    <tr key={pair}>
                      <td style={{ padding:"3px 10px 3px 0", color:col, fontStyle:"italic", whiteSpace:"nowrap" }}>{pair}</td>
                      <td style={{ padding:"3px 0", color:"#777" }}>{rule}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            {/* Dark cycle */}
            <Section title="🌑 The Dark Cycle">
              Dark edges follow an elemental cycle — each element connects to its two neighbours in the chain:
              <div style={{
                display:"flex", alignItems:"center", justifyContent:"center",
                gap:"6px", margin:"10px 0 4px", fontSize:"1rem", flexWrap:"wrap",
              }}>
                {[
                  ["🔥", "#FF8C42"], ["↔", "#555"], ["🌀", "#FFE566"],
                  ["↔", "#555"], ["🌿", "#72D475"], ["↔", "#555"],
                  ["💧", "#5CC8FF"], ["↔", "#555"], ["🔥", "#FF8C42"],
                ].map(([sym, col], i) => (
                  <span key={i} style={{ color:col, fontFamily:"'Cinzel',serif", fontSize: sym==="↔"?".7rem":"1rem" }}>{sym}</span>
                ))}
              </div>
              <div style={{ fontSize:".82rem", color:"#555", textAlign:"center" }}>
                Dark Fire ↔ Air & Water &nbsp;·&nbsp; Dark Air ↔ Fire & Earth<br/>
                Dark Earth ↔ Air & Water &nbsp;·&nbsp; Dark Water ↔ Earth & Fire
              </div>
            </Section>

            {/* Board */}
            <Section title="🗺 The Board">
              The board is a hex grid with radius 5 (91 cells). Pieces cannot be placed outside this boundary. Drag the board or use the ▲▼◀▶ compass to pan. The ● button re-centres the view.
            </Section>

            {/* End game */}
            <Section title="🏁 End of Game">
              The game ends when neither player can place any piece at any rotation. Most points wins. If scores tie, fewest pieces held (hand + reserve) is the tiebreaker. Both tied = draw.
            </Section>

            <div style={{ textAlign:"center", marginTop:"18px" }}>
              <button onClick={() => setShowRules(false)} style={{
                background: "linear-gradient(135deg,#FF8C42,#FF3300)",
                border: "none", borderRadius: "6px", color: "#fff",
                padding: "8px 24px", cursor: "pointer",
                fontFamily: "'Cinzel',serif", fontSize: ".75rem", letterSpacing: ".1em",
              }}>GOT IT</button>
            </div>
          </div>
        </div>
      )}

      {/* Game over */}
      {over && winner && (
        <div className="fu" style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.9)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
        }}>
          <div style={{
            background: "linear-gradient(135deg,#181828,#281818)",
            border: "1px solid rgba(255,255,255,.22)",
            borderRadius: "14px", padding: "28px 36px", textAlign: "center", maxWidth: "380px",
          }}>
            <h2 style={{
              fontSize: "1.7rem", fontWeight: 800, letterSpacing: ".22em", margin: "0 0 6px",
              background: winner.winIdx === -1
                ? "linear-gradient(90deg,#5CC8FF,#FFE566)"
                : "linear-gradient(90deg,#FF8C42,#FFE566)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>{winner.winIdx === -1 ? "DRAW!" : "GAME OVER"}</h2>

            <p style={{ fontFamily: "'Crimson Text',serif", color: "#aaa", marginBottom: "18px", fontSize: ".9rem" }}>
              {winner.msg}
            </p>

            {/* Score + piece breakdown */}
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginBottom: "8px" }}>
              {players.map((p, pi) => {
                const isWinner = winner.winIdx === pi;
                return (
                  <div key={p.id} style={{
                    background: "rgba(255,255,255,.04)",
                    border: `1px solid ${isWinner ? "rgba(255,200,60,.4)" : "rgba(255,255,255,.07)"}`,
                    borderRadius: "8px", padding: "10px 16px", minWidth: "110px",
                  }}>
                    <div style={{ fontSize: ".7rem", letterSpacing: ".1em", color: isWinner ? "#FFE566" : "#555", marginBottom: "6px" }}>
                      {p.name} {isWinner ? "🏆" : ""}
                    </div>
                    <div style={{ fontSize: "1.6rem", fontWeight: 800, color: isWinner ? "#FFE566" : "#888", lineHeight: 1 }}>
                      {winner.scores[pi]}<span style={{ fontSize: ".7rem", fontWeight: 400, color: "#666" }}>pt</span>
                    </div>
                    <div style={{ fontSize: ".6rem", color: "#555", fontFamily: "'Crimson Text',serif", marginTop: "4px" }}>
                      {p.hand.length + p.reserve.length} pieces held
                    </div>
                    <div style={{ fontSize: ".58rem", color: "#444", fontFamily: "'Crimson Text',serif" }}>
                      {p.hand.length} hand · {p.reserve.length} reserve
                    </div>
                  </div>
                );
              })}
            </div>

            <button className="gb" onClick={reset} style={{
              marginTop: "16px", background: "linear-gradient(135deg,#FF8C42,#FF3300)",
              color: "#fff", padding: "9px 26px", fontSize: ".82rem", border: "none",
            }}>PLAY AGAIN</button>
          </div>
        </div>
      )}

      {/* Point flash — centered screen overlay */}
      {pointFlashes.map(flash => {
        const col = flash.owner === HUMAN_IDX ? "#88ddff" : "#ffaa55";
        const label = flash.owner === HUMAN_IDX ? "You scored" : "Computer scored";
        return (
          <div key={flash.id} className="pt-flash" style={{
            position: "fixed", inset: 0, zIndex: 500,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              background: "rgba(0,0,0,.55)", borderRadius: "18px",
              padding: "18px 40px 22px",
              border: `2px solid ${col}44`,
              boxShadow: `0 0 40px ${col}55`,
            }}>
              <span style={{
                fontSize: ".75rem", letterSpacing: ".25em", color: col,
                fontFamily: "'Cinzel',serif", opacity: 0.8, marginBottom: "4px",
              }}>{label}</span>
              <span style={{
                fontSize: "5rem", fontWeight: 800, lineHeight: 1,
                color: col, fontFamily: "'Cinzel',serif",
                textShadow: `0 0 30px ${col}, 0 0 60px ${col}88`,
              }}>+{flash.pts}</span>
              <span style={{
                fontSize: ".7rem", letterSpacing: ".2em", color: col,
                fontFamily: "'Cinzel',serif", opacity: 0.7, marginTop: "4px",
              }}>REVEALED</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// RULES SECTION HELPER
// ═══════════════════════════════════════════════════════════════════
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{
        fontFamily: "'Cinzel',serif", fontSize: ".72rem", letterSpacing: ".15em",
        color: "#666", marginBottom: "5px", textTransform: "uppercase",
      }}>{title}</div>
      <div style={{ fontSize: ".88rem", color: "#999" }}>{children}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HEX VISUAL
// ═══════════════════════════════════════════════════════════════════
function HexPiece({ piece, rotation = 0, size = SZ, cx, cy, highlight, mini = false }) {
  const c = EC[piece.element];
  const pts = hexCorners(cx, cy, size - 1.5);

  return (
    <g style={{ pointerEvents: "none" }}>
      {highlight && (
        <polygon
          points={hexCorners(cx, cy, size + 5).map(p => p.join(",")).join(" ")}
          fill="none" stroke={c.glow} strokeWidth={3} opacity={0.65} filter="url(#glow)"
        />
      )}
      <polygon
        points={pts.map(p => p.join(",")).join(" ")}
        fill={c.bg}
        stroke={highlight ? c.glow : "rgba(255,255,255,0.1)"}
        strokeWidth={highlight ? 1.5 : 1}
      />
      {DIRS.map((_, dir) => {
        const edge = getEdge(piece, rotation, dir);
        const col  = edge.isLight ? c.light : c.dark;
        const p1 = pts[dir];
        const p2 = pts[(dir + 1) % 6];
        const f  = 0.16;
        const i1 = [p1[0]*(1-f)+cx*f, p1[1]*(1-f)+cy*f];
        const i2 = [p2[0]*(1-f)+cx*f, p2[1]*(1-f)+cy*f];
        return (
          <g key={dir}>
            <line
              x1={i1[0]} y1={i1[1]} x2={i2[0]} y2={i2[1]}
              stroke={col} strokeWidth={mini ? size*0.17 : size*0.21}
              strokeLinecap="round" opacity={edge.isLight ? 1 : 0.8}
            />
            {!mini && (
              <circle
                cx={(i1[0]+i2[0])/2} cy={(i1[1]+i2[1])/2} r={size * 0.07}
                fill={edge.isLight ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.9)"}
                stroke={col} strokeWidth={0.5}
              />
            )}
          </g>
        );
      })}
      <text
        x={cx} y={cy + (mini ? size*0.3 : size*0.33)}
        textAnchor="middle" fontSize={mini ? size*0.58 : size*0.62}
        style={{ userSelect: "none" }}
      >{c.sym}</text>
    </g>
  );
}
