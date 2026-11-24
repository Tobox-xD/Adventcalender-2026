import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FORWARD_DIRECTIONS,
  generateWordSearch,
  isForwardLine,
  normalizeWord,
} from '../src/lib/wordSearch.js';
import {
  extractTurns,
  findSimplePath,
  generateLetterMaze,
  getCollectedLettersForPosition,
  normalizePhrase,
} from '../src/lib/maze.js';
import {
  createBrokenPathsPuzzle,
  evaluateBrokenPaths,
  getRotatedTileDef,
  OPPOSITE_PORT,
  PORT_DELTA,
} from '../src/lib/brokenPaths.js';

test('Station 1: 15x15 word search places all 10 words forward/diagonally', () => {
  const words = [
    'Maubs',
    'Liebhabelung',
    'Kitzelattacke',
    'Lieb',
    'Winter',
    'Schnee',
    'Kuscheln',
    'Advent',
    'Freude',
    'Schnuffel',
  ];

  const ws = generateWordSearch({ size: 15, words, seed: 20261201 });
  assert.equal(ws.size, 15);
  assert.equal(ws.grid.length, 15);
  assert.equal(ws.placements.length, words.length);

  const forwardNames = new Set(FORWARD_DIRECTIONS.map((d) => d.name));
  let diagonalCount = 0;

  for (const p of ws.placements) {
    assert.ok(forwardNames.has(p.direction), `Unexpected direction ${p.direction}`);
    assert.ok(isForwardLine(p.cells), `Word ${p.word} must be forward`);
    const read = p.cells.map(({ r, c }) => ws.grid[r][c]).join('');
    assert.equal(read, p.word);
    if (p.direction === 'diagDown' || p.direction === 'diagUp') {
      diagonalCount += 1;
    }
  }

  assert.ok(diagonalCount >= 2, 'Expected at least 2 diagonal placements');

  // Ensure LIEB is not completely buried inside LIEBHABELUNG
  const lieb = ws.placements.find((p) => p.word === normalizeWord('Lieb'));
  const liebhabelung = ws.placements.find(
    (p) => p.word === normalizeWord('Liebhabelung')
  );
  const longSet = new Set(liebhabelung.cells.map((c) => `${c.r},${c.c}`));
  const allInsideLong = lieb.cells.every((c) => longSet.has(`${c.r},${c.c}`));
  assert.equal(allInsideLong, false, 'LIEB must have its own distinct cells');
});

test('Station 3: Harder 19x19 maze places exact 20-letter phrase on turns with deep dead ends', () => {
  const phrase = 'EIN WEG DURCH DEN SCHNEE';
  const expected = normalizePhrase(phrase);
  assert.equal(expected.length, 20);

  const maze = generateLetterMaze({ phrase, cols: 19, rows: 19, seed: 20261203 });
  const path = findSimplePath(maze.cells, maze.start, maze.goal);
  const turns = extractTurns(path);

  assert.equal(turns.length, expected.length);
  assert.ok(maze.metrics.solutionForks >= 8, `Expected >=8 forks, got ${maze.metrics.solutionForks}`);
  assert.ok(maze.metrics.maxDeadEndDepth >= 11, `Expected deep dead ends, got ${maze.metrics.maxDeadEndDepth}`);

  // Every turn on the solution path carries the exact next letter
  const turnString = turns.map((pt) => maze.cells[pt.r][pt.c].letter).join('');
  assert.equal(turnString, expected);

  // Zero straight cells on the solution path carry letters
  const turnKeySet = new Set(turns.map((t) => `${t.r},${t.c}`));
  for (const pt of path) {
    if (!turnKeySet.has(`${pt.r},${pt.c}`)) {
      assert.equal(maze.cells[pt.r][pt.c].letter, null);
    }
  }

  // Collecting letters at the goal spells the exact phrase
  const collected = getCollectedLettersForPosition(maze, maze.goal).join('');
  assert.equal(collected, expected);

  // Off-path corners also carry plenty of decoy letters
  const pathSet = new Set(path.map((p) => `${p.r},${p.c}`));
  let offPathLetters = 0;
  for (let r = 0; r < maze.rows; r += 1) {
    for (let c = 0; c < maze.cols; c += 1) {
      if (!pathSet.has(`${r},${c}`) && maze.cells[r][c].letter) {
        offPathLetters += 1;
      }
    }
  }
  assert.ok(offPathLetters >= 80, `Expected many decoy letters off-path, got ${offPathLetters}`);
});

test('Station 6: Dense 8x8 Broken Paths solves uniquely to HEIMWEG with clean fixed borders', () => {
  const puzzle = createBrokenPathsPuzzle({
    solutionWord: 'HEIMWEG',
    decoyLetters: ['R', 'A', 'T', 'S'],
    seed: 20261206,
  });

  // Verify 64/64 cells are filled (no blank snow cells)
  let nonSnowCount = 0;
  for (const row of puzzle.grid) {
    for (const cell of row) {
      if (cell.kind !== 'snow') nonSnowCount += 1;
    }
  }
  assert.equal(nonSnowCount, 64, 'All 64 cells of 8x8 board should contain tracks or slots');

  // 1. Verify every fixed tile port points either to a slot or a matching fixed neighbor port
  for (let r = 0; r < puzzle.rows; r += 1) {
    for (let c = 0; c < puzzle.cols; c += 1) {
      const cell = puzzle.grid[r][c];
      if (cell.kind !== 'fixed') continue;
      const def = getRotatedTileDef(cell.type, cell.rotation);
      for (const port of def.ports) {
        const nr = r + PORT_DELTA[port].dr;
        const nc = c + PORT_DELTA[port].dc;
        assert.ok(
          nr >= 0 && nr < puzzle.rows && nc >= 0 && nc < puzzle.cols,
          `Fixed cell (${r},${c}) port ${port} goes out of bounds`
        );
        const neighbor = puzzle.grid[nr][nc];
        assert.notEqual(
          neighbor.kind,
          'snow',
          `Fixed cell (${r},${c}) port ${port} points into snow at (${nr},${nc})`
        );
        if (neighbor.kind === 'fixed') {
          const nDef = getRotatedTileDef(neighbor.type, neighbor.rotation);
          assert.ok(
            nDef.ports.includes(OPPOSITE_PORT[port]),
            `Fixed cell (${r},${c}) port ${port} mismatches fixed neighbor (${nr},${nc})`
          );
        }
      }
    }
  }

  // 2. Build the intended solution placements
  const solutionPlacements = {};
  for (const slot of puzzle.solutionSlots) {
    const matchingTile = puzzle.tiles.find(
      (t) => !t.isDecoy && t.type === slot.type && t.letter === slot.letter
    );
    assert.ok(matchingTile, `Missing tile for slot (${slot.r},${slot.c})`);
    solutionPlacements[`${slot.r},${slot.c}`] = {
      ...matchingTile,
      rotation: slot.expectedRotation,
    };
  }

  const solvedEval = evaluateBrokenPaths(puzzle, solutionPlacements);
  assert.equal(solvedEval.solved, true, 'Intended solution must connect Helmut to Hasenhaus');
  assert.equal(solvedEval.mismatchedSlots.size, 0, 'Intended solution must have zero mismatched ports');
  assert.equal(solvedEval.collectedWord, 'HEIMWEG');

  // 3. Removing any single required tile breaks the path
  for (const slot of puzzle.solutionSlots) {
    const partial = { ...solutionPlacements };
    delete partial[`${slot.r},${slot.c}`];
    assert.equal(
      evaluateBrokenPaths(puzzle, partial).solved,
      false,
      `Removing slot (${slot.r},${slot.c}) must break solution`
    );
  }

  // 4. No decoy tile can substitute for any required solution slot at any rotation
  const decoys = puzzle.tiles.filter((t) => t.isDecoy);
  for (const slot of puzzle.solutionSlots) {
    for (const decoy of decoys) {
      for (let rot = 0; rot < 4; rot += 1) {
        const testPlacements = {
          ...solutionPlacements,
          [`${slot.r},${slot.c}`]: { ...decoy, rotation: rot },
        };
        assert.equal(
          evaluateBrokenPaths(puzzle, testPlacements).solved,
          false,
          `Decoy ${decoy.type} must not substitute at (${slot.r},${slot.c}) rot ${rot}`
        );
      }
    }
  }

  // 5. Swapping any two of the 7 solution tiles cannot produce a clean solution at any rotations
  for (let i = 0; i < puzzle.solutionSlots.length; i += 1) {
    for (let j = i + 1; j < puzzle.solutionSlots.length; j += 1) {
      const slotA = puzzle.solutionSlots[i];
      const slotB = puzzle.solutionSlots[j];
      const keyA = `${slotA.r},${slotA.c}`;
      const keyB = `${slotB.r},${slotB.c}`;
      const tileA = solutionPlacements[keyA];
      const tileB = solutionPlacements[keyB];

      for (let rotA = 0; rotA < 4; rotA += 1) {
        for (let rotB = 0; rotB < 4; rotB += 1) {
          const swapped = {
            ...solutionPlacements,
            [keyA]: { ...tileB, rotation: rotA },
            [keyB]: { ...tileA, rotation: rotB },
          };
          assert.equal(
            evaluateBrokenPaths(puzzle, swapped).solved,
            false,
            `Swapping ${tileA.type} and ${tileB.type} must not solve cleanly`
          );
        }
      }
    }
  }
});
