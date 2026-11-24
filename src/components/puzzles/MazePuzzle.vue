<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { PUZZLE_CONFIG } from '../../data/puzzles.js';
import {
  canMoveBetween,
  findSimplePath,
  generateLetterMaze,
  getCollectedLettersForPosition,
} from '../../lib/maze.js';

const STORAGE_KEY = 'advent-2026-puzzle-3-pos-v2';

const maze = generateLetterMaze(PUZZLE_CONFIG.maze);
const CELL_SIZE = 28;
const PAD = 8;

const svgWidth = maze.cols * CELL_SIZE + PAD * 2;
const svgHeight = maze.rows * CELL_SIZE + PAD * 2;

const playerPos = ref(loadSavedPos());
const mazeFocused = ref(false);

function loadSavedPos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (
      parsed &&
      Number.isInteger(parsed.r) &&
      Number.isInteger(parsed.c) &&
      parsed.r >= 0 &&
      parsed.r < maze.rows &&
      parsed.c >= 0 &&
      parsed.c < maze.cols
    ) {
      return parsed;
    }
  } catch {
    // Ignore storage errors
  }
  return { ...maze.start };
}

watch(
  playerPos,
  (val) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(val));
    } catch {
      // Ignore storage errors
    }
  },
  { deep: true }
);

const activePath = computed(() =>
  findSimplePath(maze.cells, maze.start, playerPos.value)
);

const activePathKeys = computed(
  () => new Set(activePath.value.map((p) => `${p.r},${p.c}`))
);

const collectedLetters = computed(() =>
  getCollectedLettersForPosition(maze, playerPos.value)
);

const isAtGoal = computed(
  () => playerPos.value.r === maze.goal.r && playerPos.value.c === maze.goal.c
);

const activePolyline = computed(() =>
  activePath.value
    .map(
      (p) =>
        `${PAD + p.c * CELL_SIZE + CELL_SIZE / 2},${PAD + p.r * CELL_SIZE + CELL_SIZE / 2}`
    )
    .join(' ')
);

function tryStep(dr, dc) {
  const target = { r: playerPos.value.r + dr, c: playerPos.value.c + dc };
  if (canMoveBetween(maze, playerPos.value, target)) {
    playerPos.value = target;
  }
}

// Click/tap a cell in the same row or column with an unobstructed corridor to walk straight there
function handleCellClick(r, c) {
  const curr = playerPos.value;
  if (curr.r === r && curr.c === c) return;

  if (curr.r === r) {
    const step = Math.sign(c - curr.c);
    let pos = { ...curr };
    while (pos.c !== c) {
      const next = { r: pos.r, c: pos.c + step };
      if (!canMoveBetween(maze, pos, next)) break;
      pos = next;
    }
    playerPos.value = pos;
    return;
  }

  if (curr.c === c) {
    const step = Math.sign(r - curr.r);
    let pos = { ...curr };
    while (pos.r !== r) {
      const next = { r: pos.r + step, c: pos.c };
      if (!canMoveBetween(maze, pos, next)) break;
      pos = next;
    }
    playerPos.value = pos;
  }
}

function handleKeyDown(event) {
  const tag = event.target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  const map = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
    w: [-1, 0],
    W: [-1, 0],
    s: [1, 0],
    S: [1, 0],
    a: [0, -1],
    A: [0, -1],
    d: [0, 1],
    D: [0, 1],
  };

  const delta = map[event.key];
  if (!delta) return;

  // Arrow keys move the mouse when maze is focused; WASD always moves
  if (event.key.startsWith('Arrow') && !mazeFocused.value) return;

  event.preventDefault();
  tryStep(delta[0], delta[1]);
}

function resetMaze() {
  playerPos.value = { ...maze.start };
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <section class="puzzle-box" aria-label="Schnee-Labyrinth">
    <div class="puzzle-header">
      <h2>Labyrinth zum großen Baum</h2>
      <span class="puzzle-progress">
        {{ collectedLetters.length }} Buchstaben gesammelt
      </span>
    </div>

    <p class="puzzle-hint">
      Tippe auf ein Feld entlang des Ganges, nutze die Pfeil-Buttons oder klicke ins Labyrinth und steuere mit Pfeiltasten / WASD. An jeder Kurve wartet ein Buchstabe.
    </p>

    <div
      class="maze-frame"
      tabindex="0"
      @focus="mazeFocused = true"
      @blur="mazeFocused = false"
    >
      <svg
        class="maze-svg"
        :viewBox="`0 0 ${svgWidth} ${svgHeight}`"
        role="img"
        aria-label="Labyrinth mit Buchstaben an jeder Kurve"
      >
        <!-- Clickable cells -->
        <g v-for="(row, r) in maze.cells" :key="`row-${r}`">
          <rect
            v-for="(cell, c) in row"
            :key="`cell-${r}-${c}`"
            :x="PAD + c * CELL_SIZE"
            :y="PAD + r * CELL_SIZE"
            :width="CELL_SIZE"
            :height="CELL_SIZE"
            class="maze-cell"
            :class="{
              'is-trail': activePathKeys.has(`${r},${c}`),
              'is-goal': r === maze.goal.r && c === maze.goal.c,
            }"
            @click="handleCellClick(r, c)"
          />
        </g>

        <!-- Walked trail line -->
        <polyline
          v-if="activePath.length > 1"
          :points="activePolyline"
          class="maze-trail-line"
        />

        <!-- Maze walls -->
        <g v-for="(row, r) in maze.cells" :key="`walls-${r}`" class="maze-walls">
          <template v-for="(cell, c) in row" :key="`w-${r}-${c}`">
            <line
              v-if="cell.top"
              :x1="PAD + c * CELL_SIZE"
              :y1="PAD + r * CELL_SIZE"
              :x2="PAD + (c + 1) * CELL_SIZE"
              :y2="PAD + r * CELL_SIZE"
            />
            <line
              v-if="cell.right"
              :x1="PAD + (c + 1) * CELL_SIZE"
              :y1="PAD + r * CELL_SIZE"
              :x2="PAD + (c + 1) * CELL_SIZE"
              :y2="PAD + (r + 1) * CELL_SIZE"
            />
            <line
              v-if="cell.bottom"
              :x1="PAD + c * CELL_SIZE"
              :y1="PAD + (r + 1) * CELL_SIZE"
              :x2="PAD + (c + 1) * CELL_SIZE"
              :y2="PAD + (r + 1) * CELL_SIZE"
            />
            <line
              v-if="cell.left"
              :x1="PAD + c * CELL_SIZE"
              :y1="PAD + r * CELL_SIZE"
              :x2="PAD + c * CELL_SIZE"
              :y2="PAD + (r + 1) * CELL_SIZE"
            />
          </template>
        </g>

        <!-- Turn letters -->
        <g v-for="(row, r) in maze.cells" :key="`letters-${r}`">
          <template v-for="(cell, c) in row" :key="`l-${r}-${c}`">
            <text
              v-if="cell.letter"
              :x="PAD + c * CELL_SIZE + CELL_SIZE / 2"
              :y="PAD + r * CELL_SIZE + CELL_SIZE / 2 + 4"
              text-anchor="middle"
              class="maze-letter"
              :class="{ 'is-active': activePathKeys.has(`${r},${c}`) }"
            >
              {{ cell.letter }}
            </text>
          </template>
        </g>

        <!-- Goal tree icon -->
        <g
          :transform="`translate(${PAD + maze.goal.c * CELL_SIZE + CELL_SIZE / 2}, ${PAD + maze.goal.r * CELL_SIZE + CELL_SIZE / 2})`"
          class="maze-tree"
        >
          <polygon points="0,-8 -6.5,3.5 6.5,3.5" />
          <rect x="-1.8" y="3.5" width="3.6" height="4.5" />
        </g>

        <!-- Mouse marker -->
        <circle
          :cx="PAD + playerPos.c * CELL_SIZE + CELL_SIZE / 2"
          :cy="PAD + playerPos.r * CELL_SIZE + CELL_SIZE / 2"
          r="6"
          class="maze-player"
        />
      </svg>
    </div>

    <div class="maze-controls">
      <div class="dpad" aria-label="Steuerung">
        <button type="button" class="dpad-btn dpad-up" @click="tryStep(-1, 0)">↑</button>
        <button type="button" class="dpad-btn dpad-left" @click="tryStep(0, -1)">←</button>
        <button type="button" class="dpad-btn dpad-down" @click="tryStep(1, 0)">↓</button>
        <button type="button" class="dpad-btn dpad-right" @click="tryStep(0, 1)">→</button>
      </div>

      <div class="maze-collected">
        <span class="collected-label">Gesammelte Buchstaben auf deinem Weg:</span>
        <div class="collected-letters">
          <span v-if="collectedLetters.length === 0" class="collected-empty">
            Noch keine Kurve passiert
          </span>
          <span
            v-for="(ch, idx) in collectedLetters"
            :key="idx"
            class="letter-badge"
          >
            {{ ch }}
          </span>
        </div>
      </div>
    </div>

    <div v-if="isAtGoal" class="puzzle-solved">
      Am großen Baum angekommen! Dein Lösungssatz:
      <strong>{{ PUZZLE_CONFIG.maze.phrase }}</strong>
    </div>

    <div class="puzzle-actions">
      <button type="button" class="puzzle-btn" @click="resetMaze">
        Zurück zum Start
      </button>
    </div>
  </section>
</template>
