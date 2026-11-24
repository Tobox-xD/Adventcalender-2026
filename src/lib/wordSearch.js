// Deterministic forward-only (+ diagonal) word search generator
// Guarantees zero overlapping cells between words and spreads words evenly across the grid.

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Forward-only directions: right, down, diagonal down-right, diagonal up-right
export const FORWARD_DIRECTIONS = [
  { name: 'right', dr: 0, dc: 1 },
  { name: 'down', dr: 1, dc: 0 },
  { name: 'diagDown', dr: 1, dc: 1 },
  { name: 'diagUp', dr: -1, dc: 1 },
];

const FILLER_ALPHABET = 'EEENNNIIISSSRRAAATTDDHHUULLCCGGMMOOBBWWFFKKZPV';

export function normalizeWord(word) {
  return word.trim().toUpperCase().replace(/\s+/g, '');
}

function measureSpreadScore(cells, occupiedCells) {
  if (occupiedCells.length === 0) return 0;
  let totalMinDist = 0;
  for (const cell of cells) {
    let minDist = Infinity;
    for (const occ of occupiedCells) {
      const d = Math.abs(cell.r - occ.r) + Math.abs(cell.c - occ.c);
      if (d < minDist) minDist = d;
    }
    totalMinDist += minDist;
  }
  return totalMinDist / cells.length;
}

export function generateWordSearch({ size = 13, words = [], seed = 20261201 }) {
  const normalizedList = words
    .map((displayWord) => ({
      displayWord: displayWord.trim(),
      word: normalizeWord(displayWord),
    }))
    .filter((entry) => entry.word.length > 0 && entry.word.length <= size);

  // Place longer words first for reliable non-overlapping packing
  const sorted = [...normalizedList].sort((a, b) => b.word.length - a.word.length);

  for (let attempt = 0; attempt < 300; attempt += 1) {
    const rng = createRng(seed + attempt * 97);
    const grid = Array.from({ length: size }, () => Array(size).fill(''));
    const dirUsage = new Map(FORWARD_DIRECTIONS.map((d) => [d.name, 0]));
    const occupiedCells = [];
    const placements = [];
    let failed = false;

    for (const entry of sorted) {
      const candidates = [];

      for (const dir of FORWARD_DIRECTIONS) {
        for (let r = 0; r < size; r += 1) {
          for (let c = 0; c < size; c += 1) {
            const endR = r + dir.dr * (entry.word.length - 1);
            const endC = c + dir.dc * (entry.word.length - 1);
            if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue;

            // Strict zero-overlap check: every cell must be empty
            let fits = true;
            const cells = [];
            for (let i = 0; i < entry.word.length; i += 1) {
              const rr = r + dir.dr * i;
              const cc = c + dir.dc * i;
              if (grid[rr][cc] !== '') {
                fits = false;
                break;
              }
              cells.push({ r: rr, c: cc });
            }
            if (!fits) continue;

            const spread = measureSpreadScore(cells, occupiedCells);
            // Lower weight is better: balance directions + maximize distance from existing words
            const weight =
              (dirUsage.get(dir.name) || 0) * 14 - spread * 2.5 + rng() * 3.5;

            candidates.push({ r, c, dir, cells, weight });
          }
        }
      }

      if (candidates.length === 0) {
        failed = true;
        break;
      }

      candidates.sort((a, b) => a.weight - b.weight);
      const chosen = candidates[0];

      for (let i = 0; i < entry.word.length; i += 1) {
        const { r: rr, c: cc } = chosen.cells[i];
        grid[rr][cc] = entry.word[i];
        occupiedCells.push({ r: rr, c: cc });
      }

      dirUsage.set(chosen.dir.name, (dirUsage.get(chosen.dir.name) || 0) + 1);
      placements.push({
        word: entry.word,
        displayWord: entry.displayWord,
        direction: chosen.dir.name,
        start: chosen.cells[0],
        end: chosen.cells[chosen.cells.length - 1],
        cells: chosen.cells,
      });
    }

    if (!failed) {
      // Ensure words aren't clustered on just one side of the board
      const leftSideCount = placements.filter(
        (p) => (p.start.c + p.end.c) / 2 < size / 2
      ).length;
      const rightSideCount = placements.length - leftSideCount;
      if (placements.length >= 4 && (leftSideCount < 2 || rightSideCount < 2)) {
        continue;
      }

      // Fill empty cells with weighted German filler letters
      for (let r = 0; r < size; r += 1) {
        for (let c = 0; c < size; c += 1) {
          if (grid[r][c] === '') {
            const idx = Math.floor(rng() * FILLER_ALPHABET.length);
            grid[r][c] = FILLER_ALPHABET[idx];
          }
        }
      }

      const byWord = new Map(placements.map((p) => [p.word, p]));
      const orderedPlacements = normalizedList.map((e) => byWord.get(e.word));

      return { size, grid, placements: orderedPlacements };
    }
  }

  throw new Error('Could not generate non-overlapping word search grid.');
}

/**
 * Returns cells along a straight horizontal, vertical, or 45-degree diagonal line
 * between start and end (or null if not aligned).
 */
export function getSelectionLine(start, end) {
  if (!start || !end) return null;
  const dr = end.r - start.r;
  const dc = end.c - start.c;

  const absR = Math.abs(dr);
  const absC = Math.abs(dc);

  if (dr === 0 && dc === 0) {
    return [{ r: start.r, c: start.c }];
  }

  const isHorizontal = dr === 0;
  const isVertical = dc === 0;
  const isDiagonal = absR === absC;

  if (!isHorizontal && !isVertical && !isDiagonal) {
    return null;
  }

  const steps = Math.max(absR, absC);
  const stepR = Math.sign(dr);
  const stepC = Math.sign(dc);

  const cells = [];
  for (let i = 0; i <= steps; i += 1) {
    cells.push({ r: start.r + stepR * i, c: start.c + stepC * i });
  }
  return cells;
}

export function isForwardLine(cells) {
  if (!cells || cells.length < 2) return false;
  const dr = Math.sign(cells[cells.length - 1].r - cells[0].r);
  const dc = Math.sign(cells[cells.length - 1].c - cells[0].c);
  return FORWARD_DIRECTIONS.some((d) => d.dr === dr && d.dc === dc);
}
