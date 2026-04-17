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



// ═══════════════════════════════════════════════════════════════════
// CPU PERSONALITIES
// ═══════════════════════════════════════════════════════════════════
const CPU_PERSONALITIES = [
  {
    id: "vex",
    name: "Vex",
    emoji: "😈",
    style: "Corner Hunter",
    desc: "Obsessed with high-value edge cells. Ruthless and predictable.",
    bias: { edgeMult: 2.5, neighbourMult: 2, reservePenalty: 6 },
    taunts: ["Corner secured. 😈", "That's mine now.", "Five points. Delicious.", "You can't stop me."],
    sulks:  ["...fine.", "Temporary setback.", "Enjoy it while it lasts.", "That won't happen again."],
  },
  {
    id: "mire",
    name: "Mire",
    emoji: "🌿",
    style: "Interior Builder",
    desc: "Plays deep and slow, building interior chains. Patient and hard to read.",
    bias: { edgeMult: 1.0, neighbourMult: 4, reservePenalty: 4 },
    taunts: ["Roots go deep.", "You don't see the pattern yet.", "Interior secured.", "Growing…"],
    sulks:  ["Unexpected.", "The soil shifts.", "I adapt.", "Hmm."],
  },
  {
    id: "flux",
    name: "Flux",
    emoji: "🌀",
    style: "Chaotic",
    desc: "Plays semi-randomly. You never know what it'll do. Occasionally brilliant.",
    bias: { edgeMult: 1.0, neighbourMult: 1.0, reservePenalty: 0 },
    taunts: ["Chaos reigns!", "Did I mean to do that? Yes.", "Order is an illusion.", "Wheee!"],
    sulks:  ["Entropy wins eventually.", "All part of the plan.", "Oops? Or not?", "🌀"],
  },
];

// Safe display name for any piece
function pieceName(piece) {
  return EC[piece.element].name;
}

const HUMAN_IDX = 0;
const CPU_IDX   = 1;

// ═══════════════════════════════════════════════════════════════════
// SOUND ENGINE — Web Audio API, no external deps
// Each element has a distinct procedural sound on placement.
// A soft chime plays when hidden points are revealed.
// All sounds respect a muted flag stored in module scope.
// ═══════════════════════════════════════════════════════════════════
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}

const SoundEngine = {
  muted: false,

  // Fire — sharp crackle: burst of noise filtered to high-mid freq, fast decay
  fire() {
    if (this.muted) return;
    try {
      const ctx = getAudioCtx();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.5);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1800;
      filter.Q.value = 0.8;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.28, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      src.start();
    } catch(e) {}
  },

  // Water — soft splash: sine wave with quick pitch drop, gentle attack
  water() {
    if (this.muted) return;
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.22);
      gain.gain.setValueAtTime(0.0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      // Add a second droplet for richness
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(380, ctx.currentTime + 0.05);
      osc2.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.25);
      gain2.gain.setValueAtTime(0.0, ctx.currentTime + 0.05);
      gain2.gain.linearRampToValueAtTime(0.11, ctx.currentTime + 0.07);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.connect(gain); gain.connect(ctx.destination);
      osc2.connect(gain2); gain2.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
      osc2.start(ctx.currentTime + 0.05); osc2.stop(ctx.currentTime + 0.3);
    } catch(e) {}
  },

  // Earth — deep thud: low sine + noise burst, solid and weighty
  earth() {
    if (this.muted) return;
    try {
      const ctx = getAudioCtx();
      // Low thud
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(90, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      // Rustle layer
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++)
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.8) * 0.4;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass"; filter.frequency.value = 600;
      const ng = ctx.createGain(); ng.gain.value = 0.18;
      osc.connect(gain); gain.connect(ctx.destination);
      src.connect(filter); filter.connect(ng); ng.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.25);
      src.start();
    } catch(e) {}
  },

  // Air — bright wind chime: high triangle wave, two pitches, long ring
  air() {
    if (this.muted) return;
    try {
      const ctx = getAudioCtx();
      [[880, 0], [1108, 0.06]].forEach(([freq, delay]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0, ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(0.13, ctx.currentTime + delay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.55);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.6);
      });
    } catch(e) {}
  },

  // Score reveal chime — soft bell ping
  reveal(pts) {
    if (this.muted) return;
    try {
      const ctx = getAudioCtx();
      const freq = 440 + pts * 80; // higher pitch for bigger reveals
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.75);
    } catch(e) {}
  },

  // Gamble jackpot — ascending arpeggio
  jackpot() {
    if (this.muted) return;
    try {
      const ctx = getAudioCtx();
      [523, 659, 784, 1047].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0.0, t);
        gain.gain.linearRampToValueAtTime(0.16, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.4);
      });
    } catch(e) {}
  },

  play(element) {
    this[element]?.();
  },
};

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
  const interiorKeys = [];
  // Interior cells (dist 1–4): random 1–4, hidden from CPU
  for (let q = -BOARD_RADIUS+1; q <= BOARD_RADIUS-1; q++) {
    for (let r = -BOARD_RADIUS+1; r <= BOARD_RADIUS-1; r++) {
      const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(q+r));
      if (dist >= 1 && dist < BOARD_RADIUS && !chokeSet.has(hkey(q, r))) {
        map[hkey(q, r)] = Math.floor(Math.random() * 4) + 1; // 1–4
        interiorKeys.push(hkey(q, r));
      }
    }
  }
  // Pick one random interior cell as the Gamble Cell — its value is doubled on reveal
  const gambleKey = interiorKeys[Math.floor(Math.random() * interiorKeys.length)];
  map[gambleKey] = map[gambleKey] * 2; // double the hidden value
  return { map, gambleKey };
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
// Behaviour shaped by personality bias.
// ═══════════════════════════════════════════════════════════════════
function cpuBestMove(board, player, chokeSet, personality) {
  const bias = personality?.bias ?? { edgeMult: 1, neighbourMult: 5, reservePenalty: 8 };
  const isFlux = personality?.id === "flux";

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

        const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
        const ptVal = dist === BOARD_RADIUS
          ? (OUTER_TIERS[hkey(q, r)] || 2)
          : 2;

        // Flux plays semi-randomly — adds big noise to scoring
        const noise = isFlux ? (Math.random() * 60 - 30) : 0;
        const score = ptVal * 20 * bias.edgeMult
          + neighbours * bias.neighbourMult
          - (fromReserve ? bias.reservePenalty : 0)
          + noise;

        if (score > bestScore) {
          bestScore = score;
          best = { piece, idx, fromReserve, q, r, rot };
        }
      }
    }
  }
  return best;
}

function initGame(personalityId) {
  const chokeSet = makeChokeSet();
  const { map: pointMap, gambleKey } = makePointMap(chokeSet);
  const bag   = makePieces();
  const first = bag.pop();
  const board = { "0,0": { piece: first, rotation: 0, q: 0, r: 0 } };
  const personality = CPU_PERSONALITIES.find(p => p.id === personalityId) || CPU_PERSONALITIES[0];
  const players = [
    { id: HUMAN_IDX, name: "You",             hand: bag.splice(0, HAND_SIZE), reserve: [] },
    { id: CPU_IDX,   name: personality.name,  hand: bag.splice(0, HAND_SIZE), reserve: [] },
  ];
  return {
    bag, board, players, chokeSet, pointMap, gambleKey,
    personality,
    turn: HUMAN_IDX,
    drawnThisTurn: false,
    peeked: false,
    selected: null,
    rotation: 0,
    spots: [],
    hintSpots: [],
    gameOver: false,
    winner: null,
    msg: "Your turn — pick a hex from your hand",
    cpuLastMove: null,
    cpuTaunt: null,
    scoreHistory: [],
    tilesPlaced: [0, 0],
    highestSingle: [0, 0],
    mvpCell: null,
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

  // Point flash
  const earned = g.pointMap[hkey(q, r)] || 0;
  const isGamble = hkey(q, r) === g.gambleKey;
  const newFlash = { key: hkey(q, r), pts: earned, owner: g.turn, id: Date.now(), isGamble, element: piece.element };

  // Score history entry (keep last 5)
  const histEntry = { owner: g.turn, element: piece.element, pts: earned, id: Date.now() + 1, isGamble };
  const newHistory = [histEntry, ...g.scoreHistory].slice(0, 5);

  // Running stats
  const newTilesPlaced = [...g.tilesPlaced];
  newTilesPlaced[g.turn]++;
  const newHighest = [...g.highestSingle];
  if (earned > newHighest[g.turn]) newHighest[g.turn] = earned;

  // MVP cell tracking
  let newMvp = g.mvpCell;
  if (!newMvp || earned > newMvp.pts) newMvp = { q, r, pts: earned, owner: g.turn };

  // CPU taunt on high score
  let cpuTaunt = null;
  if (g.turn === CPU_IDX && earned >= 4) {
    const lines = g.personality.taunts;
    cpuTaunt = { text: lines[Math.floor(Math.random() * lines.length)], id: Date.now() + 2 };
  }
  // CPU sulk when human gets high score
  if (g.turn === HUMAN_IDX && earned >= 4) {
    const lines = g.personality.sulks;
    cpuTaunt = { text: lines[Math.floor(Math.random() * lines.length)], id: Date.now() + 2 };
  }

  const placedMsg = earned > 0 && g.turn === HUMAN_IDX
    ? ` · +${earned}pt${isGamble ? " 🎰 JACKPOT!" : " revealed!"}`
    : "";

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
    nextMsg = `${g.personality.name} is thinking…`;
  }

  return {
    ...g,
    board: newBoard, bag: newBag, players: newPlayers,
    turn: over ? g.turn : next,
    drawnThisTurn: false,
    peeked: false,
    selected: null, rotation: 0, spots: [], hintSpots: [],
    gameOver: !!over, winner: over || null,
    cpuLastMove: g.turn === CPU_IDX ? { q, r } : null,
    newFlash,
    cpuTaunt,
    scoreHistory: newHistory,
    tilesPlaced: newTilesPlaced,
    highestSingle: newHighest,
    mvpCell: newMvp,
    msg: nextMsg,
  };
}

// ═══════════════════════════════════════════════════════════════════
// AUDIO ENGINE — Web Audio API, no external files
// ═══════════════════════════════════════════════════════════════════
function getAudioCtx() {
  if (!window._flawedAudioCtx) {
    window._flawedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return window._flawedAudioCtx;
}

function playTone(opts) {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === "suspended") ctx.resume();
    const { type = "sine", freq = 440, freq2, duration = 0.25, vol = 0.18, attack = 0.01, decay = 0.08, delay = 0 } = opts;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    const t = ctx.currentTime + delay;
    osc.frequency.setValueAtTime(freq, t);
    if (freq2) osc.frequency.exponentialRampToValueAtTime(freq2, t + duration * 0.6);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, t + attack + decay);
    osc.start(t);
    osc.stop(t + duration);
  } catch(e) {}
}

function playNoise(opts) {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === "suspended") ctx.resume();
    const { duration = 0.15, vol = 0.08, freq = 800, q = 8, delay = 0 } = opts;
    const bufSize = ctx.sampleRate * duration;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src    = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain   = ctx.createGain();
    src.buffer = buf;
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = q;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime + delay;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.start(t);
    src.stop(t + duration);
  } catch(e) {}
}

const SOUNDS = {
  fire: () => {
    // Crackling fire — layered noise bursts
    playNoise({ freq: 180, q: 3, vol: 0.12, duration: 0.18 });
    playNoise({ freq: 320, q: 5, vol: 0.08, duration: 0.14, delay: 0.04 });
    playTone({ type: "sawtooth", freq: 120, freq2: 60, duration: 0.2, vol: 0.06, attack: 0.01, decay: 0.18 });
  },
  water: () => {
    // Soft water splash — high filtered noise with gentle sine drop
    playNoise({ freq: 2200, q: 6, vol: 0.10, duration: 0.22 });
    playNoise({ freq: 1600, q: 4, vol: 0.07, duration: 0.28, delay: 0.05 });
    playTone({ type: "sine", freq: 880, freq2: 440, duration: 0.3, vol: 0.07, attack: 0.02, decay: 0.25 });
  },
  earth: () => {
    // Thud — low noise burst + low tone
    playNoise({ freq: 80, q: 4, vol: 0.18, duration: 0.18 });
    playTone({ type: "triangle", freq: 110, freq2: 70, duration: 0.25, vol: 0.10, attack: 0.005, decay: 0.2 });
  },
  air: () => {
    // Wind chime — two bright tones
    playTone({ type: "sine", freq: 1320, freq2: 1100, duration: 0.4, vol: 0.10, attack: 0.01, decay: 0.35 });
    playTone({ type: "sine", freq: 1760, duration: 0.3, vol: 0.07, attack: 0.02, decay: 0.25, delay: 0.06 });
    playNoise({ freq: 3200, q: 12, vol: 0.05, duration: 0.15 });
  },
  reveal: () => {
    // Score reveal chime — ascending two-note bell
    playTone({ type: "sine", freq: 660, duration: 0.35, vol: 0.13, attack: 0.01, decay: 0.32 });
    playTone({ type: "sine", freq: 990, duration: 0.4, vol: 0.10, attack: 0.01, decay: 0.38, delay: 0.12 });
  },
  gamble: () => {
    // Jackpot — quick ascending arpeggio
    [523, 659, 784, 1047].forEach((f, i) =>
      playTone({ type: "sine", freq: f, duration: 0.25, vol: 0.13, attack: 0.01, decay: 0.22, delay: i * 0.08 })
    );
  },
  draw: () => {
    // Soft draw click
    playNoise({ freq: 600, q: 10, vol: 0.08, duration: 0.1 });
    playTone({ type: "triangle", freq: 330, duration: 0.15, vol: 0.07, attack: 0.005, decay: 0.12 });
  },
  win: () => {
    // Victory fanfare
    [392, 523, 659, 784, 1047].forEach((f, i) =>
      playTone({ type: "triangle", freq: f, duration: 0.3, vol: 0.14, attack: 0.02, decay: 0.26, delay: i * 0.1 })
    );
  },
  lose: () => {
    // Descending deflation
    playTone({ type: "sawtooth", freq: 330, freq2: 196, duration: 0.5, vol: 0.10, attack: 0.02, decay: 0.46 });
    playTone({ type: "sawtooth", freq: 247, freq2: 147, duration: 0.5, vol: 0.07, attack: 0.05, decay: 0.44, delay: 0.15 });
  },
};

// ═══════════════════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════════════════
export default function App() {
  const [pickingPersonality, setPickingPersonality] = useState(true);
  const [G, setG]           = useState(() => initGame("vex"));
  const [off, setOff]       = useState({ x: 0, y: 0 });
  const [showRules, setShowRules] = useState(false);
  const [pointFlashes, setPointFlashes] = useState([]);
  const [tauntText, setTauntText] = useState(null);
  const [muted, setMuted]   = useState(false);
  const drag = useRef(null);

  // Patch SOUNDS to respect mute
  const snd = useCallback((name) => {
    if (!muted && SOUNDS[name]) SOUNDS[name]();
  }, [muted]);

  const W = 580, H = 390;
  const ox = W / 2 + off.x;
  const oy = H / 2 + off.y;

  // ── CPU auto-play ─────────────────────────────────────────────
  useEffect(() => {
    if (G.gameOver || G.turn !== CPU_IDX) return;
    const timer = setTimeout(() => {
      setG(g => {
        if (g.gameOver || g.turn !== CPU_IDX) return g;
        const move = cpuBestMove(g.board, g.players[CPU_IDX], g.chokeSet, g.personality);
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
            drawnThisTurn: false, peeked: false,
            gameOver: !!over, winner: over || null,
            cpuLastMove: null, hintSpots: [],
            msg: over ? `Game Over! ${over.msg}` : "Your turn — pick a hex from your hand",
          };
        }

        // Nothing to draw — check if fully over
        {
          const over = checkEnd(g.bag, g.players, g.board, g.chokeSet, g.pointMap);
          if (over) {
            return { ...g, gameOver: true, winner: over, msg: `Game Over! ${over.msg}`, cpuLastMove: null };
          }
        }

        return {
          ...g, turn: HUMAN_IDX,
          drawnThisTurn: false, peeked: false,
          msg: `${g.personality.name} passed — your turn`,
          cpuLastMove: null,
        };
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [G.turn, G.gameOver]);

  // Clear CPU highlight
  useEffect(() => {
    if (!G.cpuLastMove) return;
    const t = setTimeout(() => setG(g => ({ ...g, cpuLastMove: null })), 900);
    return () => clearTimeout(t);
  }, [G.cpuLastMove]);

  // Point flash + placement sound
  useEffect(() => {
    if (!G.newFlash) return;
    const flash = G.newFlash;
    const el = flash.element || "air";
    snd(el);
    setTimeout(() => {
      if (flash.isGamble) snd("gamble");
      else snd("reveal");
    }, 180);
    setPointFlashes(f => [...f, flash]);
    setG(g => ({ ...g, newFlash: null }));
    const t = setTimeout(() => setPointFlashes(f => f.filter(x => x.id !== flash.id)), 2000);
    return () => clearTimeout(t);
  }, [G.newFlash, snd]);

  // Game over sound
  useEffect(() => {
    if (!G.gameOver || !G.winner) return;
    setTimeout(() => {
      if (G.winner.winIdx === HUMAN_IDX) snd("win");
      else if (G.winner.winIdx === CPU_IDX) snd("lose");
      else snd("reveal");
    }, 400);
  }, [G.gameOver]);

  // CPU taunt display
  useEffect(() => {
    if (!G.cpuTaunt) return;
    setTauntText(G.cpuTaunt);
    setG(g => ({ ...g, cpuTaunt: null }));
    const t = setTimeout(() => setTauntText(null), 3000);
    return () => clearTimeout(t);
  }, [G.cpuTaunt]);

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
      snd("draw");
      const newBag   = [...g.bag];
      const drawn    = newBag.pop();
      const playable = hasAnyValidPlacement(g.board, drawn, g.chokeSet);
      const newPlayers = g.players.map((p, i) => {
        if (i !== HUMAN_IDX) return p;
        return playable ? { ...p, hand: [...p.hand, drawn] } : { ...p, reserve: [...p.reserve, drawn] };
      });
      const next = playable ? HUMAN_IDX : CPU_IDX;
      const over = checkEnd(newBag, newPlayers, g.board, g.chokeSet, g.pointMap);
      return {
        ...g, bag: newBag, players: newPlayers,
        turn: over ? g.turn : next,
        drawnThisTurn: playable ? true : false,
        peeked: false,
        selected: null, rotation: 0, spots: [], hintSpots: [],
        gameOver: !!over, winner: over || null,
        cpuLastMove: null,
        msg: over ? `Game Over! ${over.msg}`
          : playable ? `Drew ${pieceName(drawn)} — added to hand. Now place it or pass.`
          : `Drew ${pieceName(drawn)} — unplayable, sent to reserve. Computer's turn…`,
      };
    });
  }, []);

  // Peek at next bag tile (once per turn)
  const peek = useCallback(() => {
    setG(g => {
      if (g.peeked || g.bag.length === 0 || g.turn !== HUMAN_IDX) return g;
      return { ...g, peeked: true };
    });
  }, []);

  const cancel = () => setG(g => ({
    ...g, selected: null, rotation: 0, spots: [], hintSpots: [],
    msg: "Your turn — pick a hex from your hand",
  }));

  const reset = (personalityId) => {
    setG(initGame(personalityId || G.personality.id));
    setOff({ x: 0, y: 0 });
    setPointFlashes([]);
    setTauntText(null);
    setPickingPersonality(true);
  };

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

  const { board, players, turn, selected, rotation, spots, hintSpots, gameOver: over, winner, msg, bag, cpuLastMove, scoreHistory, personality, peeked, gambleKey } = G;
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
        @keyframes taunt-in{0%{opacity:0;transform:translateY(8px)}15%{opacity:1;transform:translateY(0)}85%{opacity:1}100%{opacity:0}}
        .taunt{animation:taunt-in 3s ease forwards;pointer-events:none}
        @keyframes tile-drop{0%{opacity:0;transform:scale(1.4)}60%{transform:scale(.95)}100%{opacity:1;transform:scale(1)}}
        .tile-drop{animation:tile-drop .32s cubic-bezier(.22,1.1,.36,1) forwards}
        @keyframes gamble-glow{0%,100%{filter:drop-shadow(0 0 4px #ffd700)}50%{filter:drop-shadow(0 0 12px #ffd700)}}
        .gamble-cell{animation:gamble-glow 1.8s ease-in-out infinite}
      `}</style>

      {/* Personality picker */}
      {pickingPersonality && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.92)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300,
        }}>
          <div className="fu" style={{
            background: "linear-gradient(160deg,#1a1a2e,#141e14)",
            border: "1px solid rgba(255,255,255,.2)", borderRadius: "14px",
            padding: "28px 32px", maxWidth: "420px", width: "100%", textAlign: "center",
          }}>
            <h2 style={{
              margin: "0 0 4px", fontFamily: "'Cinzel',serif", fontSize: "1.2rem",
              letterSpacing: ".2em",
              background: "linear-gradient(90deg,#FF8C42,#FFE566,#72D475)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>CHOOSE YOUR OPPONENT</h2>
            <p style={{ fontFamily: "'Crimson Text',serif", color: "#666", fontSize: ".85rem", marginBottom: "20px" }}>
              Each opponent plays differently. Choose wisely.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {CPU_PERSONALITIES.map(p => (
                <button key={p.id} onClick={() => {
                  setG(initGame(p.id));
                  setPickingPersonality(false);
                }} style={{
                  background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.15)",
                  borderRadius: "10px", padding: "12px 18px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "14px", textAlign: "left",
                  transition: "all .2s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.12)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,.05)"}
                >
                  <span style={{ fontSize: "2rem" }}>{p.emoji}</span>
                  <div>
                    <div style={{ fontFamily: "'Cinzel',serif", color: "#e8e0d5", fontSize: ".85rem", letterSpacing: ".1em" }}>
                      {p.name} <span style={{ color: "#555", fontSize: ".7rem" }}>· {p.style}</span>
                    </div>
                    <div style={{ fontFamily: "'Crimson Text',serif", color: "#777", fontSize: ".82rem", marginTop: "2px" }}>
                      {p.desc}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CPU Taunt */}
      {tauntText && (
        <div key={tauntText.id} className="taunt" style={{
          position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)",
          background: "rgba(20,16,30,.92)", border: "1px solid rgba(255,200,100,.2)",
          borderRadius: "8px", padding: "8px 18px", zIndex: 400,
          fontFamily: "'Crimson Text',serif", fontStyle: "italic",
          color: "#FFE566", fontSize: ".9rem",
        }}>
          {personality.emoji} {tauntText.text}
        </div>
      )}

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
                    <g className={hkey(q,r) === gambleKey ? "gamble-cell" : ""}>
                      <text x={ox+x} y={oy+y+1} textAnchor="middle" dominantBaseline="middle"
                        fontSize={7} fill={hkey(q,r) === gambleKey ? "rgba(255,215,0,.55)" : "rgba(255,255,255,.18)"}
                        style={{ pointerEvents:"none", userSelect:"none" }}>
                        {hkey(q,r) === gambleKey ? "🎰" : "?"}
                      </text>
                    </g>
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
              const isLatest = G.cpuLastMove && G.cpuLastMove.q === q && G.cpuLastMove.r === r;
              return (
                <g key={piece.id} className="tile-drop">
                  <HexPiece piece={piece} rotation={rot} size={SZ} cx={ox+x} cy={oy+y} highlight={isLatest} />
                </g>
              );
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
        <button className="gb" onClick={() => reset()}
          style={{ background: "rgba(255,70,20,.07)", color: "#FF8C42", border: "1px solid rgba(255,70,20,.2)" }}>
          New Game
        </button>
        <button className="gb" onClick={() => setShowRules(true)}
          style={{ background: "rgba(100,160,255,.07)", color: "#88aaff", border: "1px solid rgba(100,160,255,.2)" }}>
          How to Play
        </button>
        <button className="gb" onClick={() => setMuted(m => !m)}
          style={{ background: "rgba(255,255,255,.04)", color: muted ? "#555" : "#aaa", border: "1px solid rgba(255,255,255,.1)" }}
          title={muted ? "Unmute" : "Mute"}>
          {muted ? "🔇" : "🔊"}
        </button>
      </div>

      {/* Score history ticker */}
      {scoreHistory.length > 0 && (
        <div style={{
          display: "flex", gap: "5px", marginBottom: "6px", alignItems: "center",
          maxWidth: "580px", width: "100%", overflowX: "auto",
        }}>
          <span style={{ fontSize: ".58rem", color: "#555", letterSpacing: ".1em", flexShrink: 0 }}>LAST PLAYS</span>
          {scoreHistory.map((h, i) => {
            const col = h.owner === HUMAN_IDX ? "#88ddff" : "#ffaa55";
            const sym = EC[h.element].sym;
            return (
              <div key={h.id} style={{
                background: "rgba(255,255,255,.04)", border: `1px solid ${col}33`,
                borderRadius: "5px", padding: "2px 7px", flexShrink: 0,
                opacity: 1 - i * 0.15,
                fontFamily: "'Crimson Text',serif", fontSize: ".72rem",
              }}>
                <span style={{ color: col }}>{h.owner === HUMAN_IDX ? "You" : personality.name}</span>
                <span style={{ color: "#666" }}> · {sym} · </span>
                <span style={{ color: h.isGamble ? "#ffd700" : "#aaa" }}>+{h.pts}{h.isGamble ? " 🎰" : ""}</span>
              </div>
            );
          })}
        </div>
      )}

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
                <span>{!isHuman ? personality.emoji + " " : ""}{player.name} {active ? (isHuman ? "▶" : "⚙") : ""}</span>
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
          position: "fixed", inset: 0, background: "rgba(0,0,0,.92)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
          padding: "16px",
        }}>
          <div style={{
            background: "linear-gradient(135deg,#181828,#281818)",
            border: "1px solid rgba(255,255,255,.22)",
            borderRadius: "14px", padding: "26px 30px", textAlign: "center",
            maxWidth: "420px", width: "100%",
          }}>
            <h2 style={{
              fontSize: "1.7rem", fontWeight: 800, letterSpacing: ".22em", margin: "0 0 4px",
              background: winner.winIdx === -1
                ? "linear-gradient(90deg,#5CC8FF,#FFE566)"
                : "linear-gradient(90deg,#FF8C42,#FFE566)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>{winner.winIdx === -1 ? "DRAW!" : "GAME OVER"}</h2>
            <p style={{ fontFamily: "'Crimson Text',serif", color: "#888", marginBottom: "16px", fontSize: ".9rem" }}>
              {winner.msg}
            </p>

            {/* Score cards */}
            <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginBottom: "16px" }}>
              {players.map((p, pi) => {
                const isWinner = winner.winIdx === pi;
                const isCpu = pi === CPU_IDX;
                return (
                  <div key={p.id} style={{
                    flex: 1, background: "rgba(255,255,255,.04)",
                    border: `1px solid ${isWinner ? "rgba(255,200,60,.4)" : "rgba(255,255,255,.07)"}`,
                    borderRadius: "8px", padding: "10px 12px",
                  }}>
                    <div style={{ fontSize: ".7rem", letterSpacing: ".1em", color: isWinner ? "#FFE566" : "#555", marginBottom: "5px" }}>
                      {isCpu ? personality.emoji + " " : ""}{p.name} {isWinner ? "🏆" : ""}
                    </div>
                    <div style={{ fontSize: "1.9rem", fontWeight: 800, color: isWinner ? "#FFE566" : "#888", lineHeight: 1 }}>
                      {winner.scores[pi]}<span style={{ fontSize: ".65rem", fontWeight: 400, color: "#555" }}>pt</span>
                    </div>
                    <div style={{ borderTop: "1px solid rgba(255,255,255,.07)", marginTop: "8px", paddingTop: "7px" }}>
                      {[
                        ["Tiles placed", G.tilesPlaced[pi]],
                        ["Best single", `+${G.highestSingle[pi]}pt`],
                        ["Held", `${p.hand.length + p.reserve.length} pcs`],
                      ].map(([label, val]) => (
                        <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: ".65rem", color: "#555", marginTop: "3px", fontFamily: "'Crimson Text',serif" }}>
                          <span>{label}</span><span style={{ color: "#888" }}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* MVP cell */}
            {G.mvpCell && (
              <div style={{
                background: "rgba(255,215,0,.06)", border: "1px solid rgba(255,215,0,.2)",
                borderRadius: "7px", padding: "7px 14px", marginBottom: "14px",
                fontFamily: "'Crimson Text',serif", fontSize: ".8rem", color: "#aaa",
              }}>
                🏅 <strong style={{ color: "#ffd700" }}>MVP Cell</strong> — scored <strong style={{ color: "#ffd700" }}>+{G.mvpCell.pts}pt</strong> by {G.mvpCell.owner === HUMAN_IDX ? "You" : personality.name}
              </div>
            )}

            <button className="gb" onClick={() => reset()} style={{
              background: "linear-gradient(135deg,#FF8C42,#FF3300)",
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
