// Seeded Growing-Tree (DFS + Prim hybrid) labyrinth generator:
// High branching factor with long deceptive dead ends, where every turn carries a letter
// and only the true path's turns spell the exact configured secret phrase.

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIRS = [
  { name: 'top', opp: 'bottom', dr: -1, dc: 0 },
  { name: 'right', opp: 'left', dr: 0, dc: 1 },
  { name: 'bottom', opp: 'top', dr: 1, dc: 0 },
  { name: 'left', opp: 'right', dr: 0, dc: -1 },
];

const DECOY_LETTERS = 'ABCDEFGHIJKLMNOPRSTUVWZ';

export function normalizePhrase(phrase) {
  return phrase
    .trim()
    .toUpperCase()
    .replace(/[^A-ZÄÖÜ]/g, '');
}

function cellKey(r, c) {
  return `${r},${c}`;
}

/**
 * Growing-Tree algorithm mixing 60% newest (winding corridors) and 40% random active cell
 * (frequent misleading forks & long dead-end branches).
 */
function buildGrowingTreeMaze(rows, cols, rng) {
  const cells = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      r,
      c,
      top: true,
      right: true,
      bottom: true,
      left: true,
      letter: null,
    }))
  );

  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  const active = [{ r: 0, c: 0 }];
  visited[0][0] = true;

  while (active.length > 0) {
    const pickIdx =
      rng() < 0.62 ? active.length - 1 : Math.floor(rng() * active.length);
    const curr = active[pickIdx];
    const neighbors = [];

    for (const dir of DIRS) {
      const nr = curr.r + dir.dr;
      const nc = curr.c + dir.dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc]) {
        neighbors.push({ nr, nc, dir });
      }
    }

    if (neighbors.length === 0) {
      active.splice(pickIdx, 1);
      continue;
    }

    const pick = neighbors[Math.floor(rng() * neighbors.length)];
    cells[curr.r][curr.c][pick.dir.name] = false;
    cells[pick.nr][pick.nc][pick.dir.opp] = false;
    visited[pick.nr][pick.nc] = true;
    active.push({ r: pick.nr, c: pick.nc });
  }

  return cells;
}

export function findSimplePath(cells, start, goal) {
  const rows = cells.length;
  const cols = cells[0].length;
  const queue = [start];
  const parent = new Map();
  parent.set(cellKey(start.r, start.c), null);

  while (queue.length > 0) {
    const curr = queue.shift();
    if (curr.r === goal.r && curr.c === goal.c) break;

    const cell = cells[curr.r][curr.c];
    for (const dir of DIRS) {
      if (cell[dir.name]) continue;
      const nr = curr.r + dir.dr;
      const nc = curr.c + dir.dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const key = cellKey(nr, nc);
      if (!parent.has(key)) {
        parent.set(key, curr);
        queue.push({ r: nr, c: nc });
      }
    }
  }

  const path = [];
  let step = goal;
  while (step) {
    path.push(step);
    step = parent.get(cellKey(step.r, step.c));
  }
  path.reverse();
  return path;
}

export function extractTurns(path) {
  const turns = [];
  for (let i = 1; i < path.length - 1; i += 1) {
    const prev = path[i - 1];
    const curr = path[i];
    const next = path[i + 1];
    const dr1 = curr.r - prev.r;
    const dc1 = curr.c - prev.c;
    const dr2 = next.r - curr.r;
    const dc2 = next.c - curr.c;
    if (dr1 !== dr2 || dc1 !== dc2) {
      turns.push(curr);
    }
  }
  return turns;
}

function isCornerOrBranchTurn(cell) {
  const open = DIRS.filter((d) => !cell[d.name]).map((d) => d.name);
  if (open.length < 2) return false;
  if (open.length >= 3) return true;
  const isStraight =
    (open.includes('top') && open.includes('bottom')) ||
    (open.includes('left') && open.includes('right'));
  return !isStraight;
}

function measureMazeChallenge(cells, solutionPath) {
  const rows = cells.length;
  const cols = cells[0].length;
  const solSet = new Set(solutionPath.map((p) => cellKey(p.r, p.c)));

  // Count how many decision forks branch off the true solution path
  let solutionForks = 0;
  for (const pt of solutionPath) {
    const cell = cells[pt.r][pt.c];
    const openCount = DIRS.filter((d) => !cell[d.name]).length;
    if (openCount >= 3) {
      solutionForks += 1;
    }
  }

  // BFS from all solution cells into off-path dead ends to measure max dead-end depth
  const dist = new Map();
  const queue = [];
  for (const pt of solutionPath) {
    const k = cellKey(pt.r, pt.c);
    dist.set(k, 0);
    queue.push(pt);
  }

  let maxDeadEndDepth = 0;
  while (queue.length > 0) {
    const curr = queue.shift();
    const d0 = dist.get(cellKey(curr.r, curr.c));
    const cell = cells[curr.r][curr.c];
    for (const dir of DIRS) {
      if (cell[dir.name]) continue;
      const nr = curr.r + dir.dr;
      const nc = curr.c + dir.dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const nk = cellKey(nr, nc);
      if (!dist.has(nk)) {
        const nd = d0 + 1;
        dist.set(nk, nd);
        if (!solSet.has(nk) && nd > maxDeadEndDepth) {
          maxDeadEndDepth = nd;
        }
        queue.push({ r: nr, c: nc });
      }
    }
  }

  return { solutionForks, maxDeadEndDepth };
}

export function generateLetterMaze({
  phrase,
  cols = 19,
  rows = 19,
  seed = 20261203,
}) {
  const letters = normalizePhrase(phrase);
  const start = { r: 0, c: 0 };
  const goal = { r: rows - 1, c: cols - 1 };

  const minPathLength = Math.max(letters.length * 2 + 4, Math.floor((rows + cols) * 1.35));
  const minForks = Math.min(8, Math.max(4, Math.floor(cols / 2)));
  const minDeadEndDepth = Math.min(12, Math.max(6, Math.floor(cols * 0.6)));

  for (let attempt = 0; attempt < 8000; attempt += 1) {
    const rng = createRng(seed + attempt * 131);
    const cells = buildGrowingTreeMaze(rows, cols, rng);
    const solutionPath = findSimplePath(cells, start, goal);
    const turns = extractTurns(solutionPath);

    if (turns.length !== letters.length) continue;
    if (solutionPath.length < minPathLength) continue;

    const { solutionForks, maxDeadEndDepth } = measureMazeChallenge(
      cells,
      solutionPath
    );
    if (solutionForks < minForks || maxDeadEndDepth < minDeadEndDepth) continue;

    const solutionSet = new Set(solutionPath.map((p) => cellKey(p.r, p.c)));
    turns.forEach((turnCell, idx) => {
      cells[turnCell.r][turnCell.c].letter = letters[idx];
    });

    // Assign decoy letters to every corner/branch turn off the true solution path
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (solutionSet.has(cellKey(r, c))) continue;
        if (isCornerOrBranchTurn(cells[r][c])) {
          cells[r][c].letter =
            DECOY_LETTERS[Math.floor(rng() * DECOY_LETTERS.length)];
        }
      }
    }

    return {
      rows,
      cols,
      start,
      goal,
      phrase: letters,
      cells,
      solutionPath,
      solutionTurns: turns,
      metrics: { solutionForks, maxDeadEndDepth },
    };
  }

  throw new Error(
    `Could not generate challenging maze with ${letters.length} turns on ${rows}x${cols} grid.`
  );
}

/**
 * Returns the letters collected at every turn along the unique loop-free path
 * from start to currentPos (automatically drops dead-end letters when backtracking).
 */
export function getCollectedLettersForPosition(maze, currentPos) {
  const path = findSimplePath(maze.cells, maze.start, currentPos);
  const turns = extractTurns(path);
  return turns
    .map((pt) => maze.cells[pt.r][pt.c].letter)
    .filter(Boolean);
}

export function canMoveBetween(maze, from, to) {
  const dr = to.r - from.r;
  const dc = to.c - from.c;
  const dir = DIRS.find((d) => d.dr === dr && d.dc === dc);
  if (!dir) return false;
  if (to.r < 0 || to.r >= maze.rows || to.c < 0 || to.c >= maze.cols) {
    return false;
  }
  return !maze.cells[from.r][from.c][dir.name];
}
