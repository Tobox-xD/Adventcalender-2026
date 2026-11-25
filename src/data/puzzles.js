// Central configuration for all interactive puzzles.
// Edit words, phrases, grid sizes, or the Lösungswort here anytime.

// Optional dedicated picture for Station 2 (Proviant):
// Drop any quadratic image into src/content/puzzles/ (e.g. proviant.jpg / .png / .webp).
// If empty, falls back to the placeholder picture in src/content/pictures/.
const puzzlePictures = import.meta.glob(
  '../content/puzzles/*.{webp,png,jpg,jpeg,avif}',
  {
    query: '?url',
    import: 'default',
    eager: true,
  }
);

const fallbackPictures = import.meta.glob(
  '../content/pictures/*.{webp,png,jpg,jpeg,avif}',
  {
    query: '?url',
    import: 'default',
    eager: true,
  }
);

export function getBagPuzzleImageUrl() {
  const dedicated = Object.values(puzzlePictures)[0];
  if (dedicated) return dedicated;

  const entries = Object.entries(fallbackPictures).filter(
    ([path]) => !/\/cursor[^/]*$/i.test(path)
  );
  const dayTwo = entries.find(([path]) => /\/0?2\.[^.]+$/.test(path));
  if (dayTwo) return dayTwo[1];

  return entries[0]?.[1] || null;
}

export const PUZZLE_CONFIG = {
  // Station 1: 13x13 Word Search (forward horizontal, vertical, and diagonal)
  wordSearch: {
    size: 13,
    seed: 20261201,
    words: [
      'Maubs',
      'Liebhabelung',
      'Kitzelattacke',
      'Kuscheln',
      'Freude',
      'Schnuffel',
    ],
  },

  // Station 2: 6x6 quadratic picture puzzle
  bagPuzzle: {
    size: 6,
    seed: 20261202,
  },

  // Station 3: Harder 19x19 Labyrinth with a letter at every turn (~20 letters, spaces ignored)
  maze: {
    // Placeholder 20-letter phrase — change anytime; the maze adapts automatically!
    phrase: 'EIN WEG DURCH DEN SCHNEE',
    cols: 19,
    rows: 19,
    seed: 20261203,
  },

  // Station 6: Broken Paths (Helmuts Heimweg) — dense 8x8 board with false trails & crossings
  // 7-letter Lösungswort (one letter per required missing tile along Helmut's true path)
  brokenPaths: {
    solutionWord: 'HEIMWEG',
    decoyLetters: ['R', 'A', 'T', 'S'],
    seed: 20261206,
  },
};
