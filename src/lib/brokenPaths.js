// Station 6 — Helmuts Heimweg (Dense 8x8 Broken Paths with 8 Overpasses & Many False Trails)
// 64/64 cells filled with interwoven paths, 8 overlapping bridge crossings, 3 trap slots,
// 7 uniquely-shaped required solution slots, and 4 decoy tiles.

export const PORT_ORDER = ['N', 'E', 'S', 'W'];

export const OPPOSITE_PORT = {
  N: 'S',
  E: 'W',
  S: 'N',
  W: 'E',
};

export const PORT_DELTA = {
  N: { dr: -1, dc: 0 },
  E: { dr: 0, dc: 1 },
  S: { dr: 1, dc: 0 },
  W: { dr: 0, dc: -1 },
};

export const TILE_SHAPES = {
  empty: { pairs: [], stubs: [] },
  start: { pairs: [], stubs: ['S'] }, // Helmut exits South
  goal: { pairs: [], stubs: ['E'] },  // Hasenhaus entered from East
  straight: { pairs: [['N', 'S']], stubs: [] },
  corner: { pairs: [['N', 'E']], stubs: [] },
  tee: { pairs: [['N', 'E', 'W']], stubs: [] },
  cross: { pairs: [['N', 'S'], ['E', 'W']], stubs: [], isOverpass: true },
  doubleCorner: { pairs: [['N', 'E'], ['S', 'W']], stubs: [] },
  straightStub: { pairs: [['N', 'S']], stubs: ['E'] },
  cornerStubCW: { pairs: [['N', 'E']], stubs: ['W'] },  // bend N-E, dead-end stub W
  cornerStubCCW: { pairs: [['N', 'E']], stubs: ['S'] }, // bend N-E, dead-end stub S
  deadend: { pairs: [], stubs: ['N'] },
  blockedStraight: { pairs: [], stubs: ['N', 'S'] },
  blockedCorner: { pairs: [], stubs: ['N', 'E'] },
};

export function rotatePort(port, rotation) {
  const idx = PORT_ORDER.indexOf(port);
  return PORT_ORDER[(idx + (((rotation % 4) + 4) % 4)) % 4];
}

export function getRotatedTileDef(type, rotation = 0) {
  const base = TILE_SHAPES[type] || TILE_SHAPES.empty;
  const rot = ((rotation % 4) + 4) % 4;

  const pairs = base.pairs.map((group) => group.map((p) => rotatePort(p, rot)));
  const stubs = base.stubs.map((p) => rotatePort(p, rot));
  const ports = [...new Set([...pairs.flat(), ...stubs])];

  return {
    type,
    rotation: rot,
    pairs,
    stubs,
    ports,
    isOverpass: Boolean(base.isOverpass),
  };
}

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Dense 8x8 board (all 64 cells occupied by tracks/slots):
 * - 8 overlapping overpass crossings (cross)
 * - 10+ false dead-end trails & loops leading to nothing
 * - 3 empty trap slots on false trails
 * - 7 uniquely-shaped required solution slots along Helmut's true path
 */
export function createBrokenPathsPuzzle({
  solutionWord = 'HEIMWEG',
  decoyLetters = ['R', 'A', 'T', 'S'],
  seed = 20261206,
} = {}) {
  const letters = solutionWord
    .trim()
    .toUpperCase()
    .replace(/[^A-ZÄÖÜ]/g, '');

  if (letters.length !== 7) {
    throw new Error('Broken Paths board expects a 7-letter solutionWord.');
  }

  const rows = 8;
  const cols = 8;

  const fixedCells = [
    // Row 0 — dense upper false trails & northern overpass arch
    { r: 0, c: 0, type: 'deadend', rotation: 2 }, // S -> (1,0)
    { r: 0, c: 1, type: 'start', rotation: 0 },   // Helmut exits S -> (1,1)
    { r: 0, c: 2, type: 'corner', rotation: 1 },  // E↔S -> (0,3), (1,2)
    { r: 0, c: 3, type: 'corner', rotation: 2 },  // S↔W -> (1,3), (0,2)
    { r: 0, c: 4, type: 'corner', rotation: 1 },  // E↔S -> (0,5), (1,4)
    { r: 0, c: 5, type: 'straight', rotation: 1 },// E↔W -> (0,6), (0,4)
    { r: 0, c: 6, type: 'corner', rotation: 2 },  // S↔W -> (1,6), (0,5)
    { r: 0, c: 7, type: 'deadend', rotation: 2 }, // S -> (1,7)

    // Row 1 — False Branch A weaving through 2 overpasses + Trap Slot C loop
    { r: 1, c: 0, type: 'straight', rotation: 0 },// N↔S -> (0,0), (2,0)
    { r: 1, c: 1, type: 'tee', rotation: 1 },     // N,E,S -> (0,1), (1,2), (2,1)
    { r: 1, c: 2, type: 'cross', rotation: 0 },   // OVERPASS #7: W↔E & N↔S
    { r: 1, c: 3, type: 'cross', rotation: 0 },   // OVERPASS #8: W↔E & N↔S
    { r: 1, c: 4, type: 'tee', rotation: 0 },     // N,E,W -> (0,4), (1,5) Trap C, (1,3)
    // (1,5) TRAP SLOT C (on false loop between (1,4) and (1,6))
    { r: 1, c: 6, type: 'corner', rotation: 3 },  // W↔N -> (1,5) Trap C, (0,6)
    { r: 1, c: 7, type: 'straight', rotation: 0 },// N↔S -> (0,7), (2,7)

    // Row 2 — True path crosses Slot 1, Slot 2 (Overpass #1), Overpass #2, then False Branch B east
    { r: 2, c: 0, type: 'straight', rotation: 0 },// N↔S -> (1,0), (3,0)
    // (2,1) SLOT 1: corner (rot 0: N↔E)
    // (2,2) SLOT 2: cross (rot 0: W↔E & N↔S) [OVERPASS #1]
    { r: 2, c: 3, type: 'cross', rotation: 0 },   // OVERPASS #2: W↔E (true) & N↔S (false)
    { r: 2, c: 4, type: 'tee', rotation: 2 },     // E,S,W -> (2,5) false, (3,4) Slot 3, (2,3)
    { r: 2, c: 5, type: 'straight', rotation: 1 },// E↔W -> (2,6), (2,4)
    { r: 2, c: 6, type: 'straight', rotation: 1 },// E↔W -> (2,7), (2,5)
    { r: 2, c: 7, type: 'tee', rotation: 3 },     // N,S,W -> (1,7), (3,7), (2,6)

    // Row 3 — Left-side false trap branch, Slot 3, False Branch C splitting South
    { r: 3, c: 0, type: 'tee', rotation: 1 },     // N,E,S -> (2,0), (3,1) Trap A, (4,0)
    // (3,1) TRAP SLOT A (on false branch between (3,0) and (3,2))
    { r: 3, c: 2, type: 'corner', rotation: 3 },  // W↔N -> (3,1) Trap A, (2,2)
    { r: 3, c: 3, type: 'tee', rotation: 1 },     // N,E,S -> (2,3), (3,4) stub W, (4,3)
    // (3,4) SLOT 3: cornerStubCW (rot 0: N↔E, stub W)
    { r: 3, c: 5, type: 'tee', rotation: 2 },     // E,S,W -> (3,6) true, (4,5) false C, (3,4)
    { r: 3, c: 6, type: 'corner', rotation: 2 },  // S↔W -> (4,6) Slot 4, (3,5)
    { r: 3, c: 7, type: 'deadend', rotation: 0 }, // N -> (2,7)

    // Row 4 — True path reverses West across Overpass #3, Slot 5, Overpass #4
    { r: 4, c: 0, type: 'straight', rotation: 0 },// N↔S -> (3,0), (5,0)
    { r: 4, c: 1, type: 'deadend', rotation: 2 }, // S -> (5,1)
    { r: 4, c: 2, type: 'corner', rotation: 1 },  // E↔S -> (4,3), (5,2) Slot 6
    { r: 4, c: 3, type: 'cross', rotation: 0 },   // OVERPASS #4: E↔W (true) & N↔S (false)
    // (4,4) SLOT 5: straight (rot 1: E↔W)
    { r: 4, c: 5, type: 'cross', rotation: 0 },   // OVERPASS #3: E↔W (true) & N↔S (false C)
    // (4,6) SLOT 4: doubleCorner (rot 1: W↔N true & E↔S false)
    { r: 4, c: 7, type: 'deadend', rotation: 3 }, // W -> (4,6) false E port

    // Row 5 — True path returns East across Slot 6, Overpass #5, Overpass #6, Slot 7
    { r: 5, c: 0, type: 'tee', rotation: 1 },     // N,E,S -> (4,0), (5,1), (6,0)
    { r: 5, c: 1, type: 'corner', rotation: 3 },  // W↔N -> (5,0), (4,1)
    // (5,2) SLOT 6: cornerStubCCW (rot 0: N↔E, stub S)
    { r: 5, c: 3, type: 'cross', rotation: 0 },   // OVERPASS #5: W↔E (true) & N↔S (false)
    { r: 5, c: 4, type: 'straight', rotation: 1 },// E↔W -> (5,5), (5,3)
    { r: 5, c: 5, type: 'cross', rotation: 0 },   // OVERPASS #6: W↔E (true) & N↔S (false C)
    // (5,6) SLOT 7: straightStub (rot 3: W↔E, stub N -> (4,6) false S port)
    { r: 5, c: 7, type: 'corner', rotation: 2 },  // S↔W -> (6,7), (5,6)

    // Row 6 — Dense dead-end branches right above the Hasenhaus!
    { r: 6, c: 0, type: 'tee', rotation: 1 },     // N,E,S -> (5,0), (6,1), (7,0)
    { r: 6, c: 1, type: 'deadend', rotation: 3 }, // W -> (6,0)
    { r: 6, c: 2, type: 'blockedCorner', rotation: 0 }, // N stub -> (5,2); E stub -> (6,3)
    { r: 6, c: 3, type: 'tee', rotation: 3 },     // N,S,W -> (5,3), (7,3), (6,2)
    { r: 6, c: 4, type: 'deadend', rotation: 1 }, // E -> (6,5)
    { r: 6, c: 5, type: 'tee', rotation: 0 },     // N,E,W -> (5,5), (6,6), (6,4)
    { r: 6, c: 6, type: 'deadend', rotation: 3 }, // W -> (6,5) — teasing right above Hasenhaus!
    { r: 6, c: 7, type: 'straight', rotation: 0 },// N↔S -> (5,7), (7,7)

    // Row 7 — Bottom dead-end trail, Trap Slot B, and final approach into Hasenhaus
    { r: 7, c: 0, type: 'corner', rotation: 0 },  // N↔E -> (6,0), (7,1)
    { r: 7, c: 1, type: 'straight', rotation: 1 },// E↔W -> (7,2), (7,0)
    { r: 7, c: 2, type: 'deadend', rotation: 3 }, // W -> (7,1)
    { r: 7, c: 3, type: 'corner', rotation: 0 },  // N↔E -> (6,3), (7,4) Trap B
    // (7,4) TRAP SLOT B (on false trail leading straight toward Hasenhaus!)
    { r: 7, c: 5, type: 'deadend', rotation: 3 }, // W -> (7,4) Trap B — stops 1 tile short of Hasenhaus!
    { r: 7, c: 6, type: 'goal', rotation: 0 },    // Hasenhaus: enters from E -> (7,7)
    { r: 7, c: 7, type: 'corner', rotation: 3 },  // W↔N -> (7,6), (6,7)
  ];

  // 7 solution slots in exact traversal order along Helmut's true path
  const solutionSlots = [
    { r: 2, c: 1, type: 'corner', expectedRotation: 0, letter: letters[0] },
    { r: 2, c: 2, type: 'cross', expectedRotation: 0, letter: letters[1] },
    { r: 3, c: 4, type: 'cornerStubCW', expectedRotation: 0, letter: letters[2] },
    { r: 4, c: 6, type: 'doubleCorner', expectedRotation: 1, letter: letters[3] },
    { r: 4, c: 4, type: 'straight', expectedRotation: 1, letter: letters[4] },
    { r: 5, c: 2, type: 'cornerStubCCW', expectedRotation: 0, letter: letters[5] },
    { r: 5, c: 6, type: 'straightStub', expectedRotation: 3, letter: letters[6] },
  ];

  // 3 empty trap slots sitting on false branches
  const trapSlots = [
    { r: 1, c: 5 }, // Trap C: upper-right false loop
    { r: 3, c: 1 }, // Trap A: left-side false labyrinth
    { r: 7, c: 4 }, // Trap B: tempting bottom path stopping 1 step left of Hasenhaus
  ];

  const grid = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      r,
      c,
      kind: 'snow',
      type: 'empty',
      rotation: 0,
    }))
  );

  for (const cell of fixedCells) {
    grid[cell.r][cell.c] = {
      r: cell.r,
      c: cell.c,
      kind: 'fixed',
      type: cell.type,
      rotation: cell.rotation,
    };
  }

  for (const slot of [...solutionSlots, ...trapSlots]) {
    grid[slot.r][slot.c] = {
      r: slot.r,
      c: slot.c,
      kind: 'slot',
      type: 'empty',
      rotation: 0,
    };
  }

  const rng = createRng(seed);
  const decoySpecs = [
    { type: 'blockedStraight', letter: decoyLetters[0] || 'R' },
    { type: 'blockedCorner', letter: decoyLetters[1] || 'A' },
    { type: 'deadend', letter: decoyLetters[2] || 'T' },
    { type: 'blockedStraight', letter: decoyLetters[3] || 'S' },
  ];

  const rawTiles = [
    ...solutionSlots.map((slot, idx) => ({
      id: `tile-${idx + 1}`,
      type: slot.type,
      letter: slot.letter,
      initialRotation: (slot.expectedRotation + 1 + Math.floor(rng() * 3)) % 4,
      isDecoy: false,
    })),
    ...decoySpecs.map((decoy, idx) => ({
      id: `decoy-${idx + 1}`,
      type: decoy.type,
      letter: decoy.letter,
      initialRotation: Math.floor(rng() * 4),
      isDecoy: true,
    })),
  ];

  for (let i = rawTiles.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [rawTiles[i], rawTiles[j]] = [rawTiles[j], rawTiles[i]];
  }

  return {
    rows,
    cols,
    start: { r: 0, c: 1, exitPort: 'S' },
    goal: { r: 7, c: 6, enterPort: 'E' },
    solutionWord: letters,
    grid,
    solutionSlots,
    trapSlots,
    tiles: rawTiles,
  };
}

export function evaluateBrokenPaths(puzzle, placements) {
  const getTileAt = (r, c) => {
    if (r < 0 || r >= puzzle.rows || c < 0 || c >= puzzle.cols) return null;
    const cell = puzzle.grid[r][c];
    if (cell.kind === 'fixed') {
      return { ...getRotatedTileDef(cell.type, cell.rotation), kind: 'fixed', letter: null };
    }
    if (cell.kind === 'slot') {
      const placed = placements[`${r},${c}`];
      if (!placed) return null;
      return {
        ...getRotatedTileDef(placed.type, placed.rotation),
        kind: 'placed',
        letter: placed.letter,
        id: placed.id,
      };
    }
    return null;
  };

  // Validate bidirectional port matching for every placed tile
  const mismatchedSlots = new Set();
  for (const [key, placed] of Object.entries(placements)) {
    if (!placed) continue;
    const [r, c] = key.split(',').map(Number);
    const def = getRotatedTileDef(placed.type, placed.rotation);

    for (const port of PORT_ORDER) {
      const delta = PORT_DELTA[port];
      const nr = r + delta.dr;
      const nc = c + delta.dc;
      const hasOwnPort = def.ports.includes(port);
      const neighbor = getTileAt(nr, nc);
      const neighborHasPort = Boolean(
        neighbor && neighbor.ports.includes(OPPOSITE_PORT[port])
      );
      const neighborCell =
        nr >= 0 && nr < puzzle.rows && nc >= 0 && nc < puzzle.cols
          ? puzzle.grid[nr][nc]
          : null;
      const isUnfilledSlot =
        neighborCell?.kind === 'slot' && !placements[`${nr},${nc}`];

      if (hasOwnPort && !neighborHasPort && !isUnfilledSlot) {
        mismatchedSlots.add(key);
      } else if (!hasOwnPort && neighborHasPort) {
        mismatchedSlots.add(key);
      }
    }
  }

  // BFS from Helmut's exit port respecting independent overpass crossings
  const startR = puzzle.start.r + PORT_DELTA[puzzle.start.exitPort].dr;
  const startC = puzzle.start.c + PORT_DELTA[puzzle.start.exitPort].dc;
  const startEnterPort = OPPOSITE_PORT[puzzle.start.exitPort];

  const queue = [
    {
      r: startR,
      c: startC,
      enterPort: startEnterPort,
      trail: [{ r: puzzle.start.r, c: puzzle.start.c, letter: null }],
    },
  ];
  const visited = new Set([`${startR},${startC},${startEnterPort}`]);

  while (queue.length > 0) {
    const curr = queue.shift();
    const tile = getTileAt(curr.r, curr.c);
    if (!tile) continue;

    if (
      curr.r === puzzle.goal.r &&
      curr.c === puzzle.goal.c &&
      curr.enterPort === puzzle.goal.enterPort
    ) {
      const fullTrail = [...curr.trail, { r: curr.r, c: curr.c, letter: null }];
      const pathCells = new Set(fullTrail.map((t) => `${t.r},${t.c}`));
      const placedOnPath = fullTrail.filter((t) => t.letter);
      const pathHasMismatch = placedOnPath.some((t) =>
        mismatchedSlots.has(`${t.r},${t.c}`)
      );

      if (!pathHasMismatch) {
        return {
          solved: true,
          pathCells,
          collectedWord: placedOnPath.map((t) => t.letter).join(''),
          mismatchedSlots,
        };
      }
    }

    const matchingGroup = tile.pairs.find((group) => group.includes(curr.enterPort));
    if (!matchingGroup) continue;

    const nextTrail = [
      ...curr.trail,
      { r: curr.r, c: curr.c, letter: tile.kind === 'placed' ? tile.letter : null },
    ];

    for (const exitPort of matchingGroup) {
      if (exitPort === curr.enterPort) continue;
      const delta = PORT_DELTA[exitPort];
      const nr = curr.r + delta.dr;
      const nc = curr.c + delta.dc;
      const nextEnter = OPPOSITE_PORT[exitPort];
      const stateKey = `${nr},${nc},${nextEnter}`;

      if (!visited.has(stateKey)) {
        visited.add(stateKey);
        queue.push({ r: nr, c: nc, enterPort: nextEnter, trail: nextTrail });
      }
    }
  }

  return {
    solved: false,
    pathCells: new Set(),
    collectedWord: '',
    mismatchedSlots,
  };
}
