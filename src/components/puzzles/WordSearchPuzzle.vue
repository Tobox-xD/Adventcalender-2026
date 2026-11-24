<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { PUZZLE_CONFIG } from '../../data/puzzles.js';
import {
  generateWordSearch,
  getSelectionLine,
  isForwardLine,
} from '../../lib/wordSearch.js';

const STORAGE_KEY = 'advent-2026-puzzle-1-found';

const puzzle = generateWordSearch(PUZZLE_CONFIG.wordSearch);

const foundWords = ref(loadSavedFound());
const dragStart = ref(null);
const dragEnd = ref(null);
const isDragging = ref(false);
const tapAnchor = ref(null);
const feedback = ref('');

function loadSavedFound() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const validSet = new Set(puzzle.placements.map((p) => p.word));
    return Array.isArray(parsed) ? parsed.filter((w) => validSet.has(w)) : [];
  } catch {
    return [];
  }
}

watch(
  foundWords,
  (val) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(val));
    } catch {
      // Ignore storage errors
    }
  },
  { deep: true }
);

const foundSet = computed(() => new Set(foundWords.value));

const foundCellKeys = computed(() => {
  const keys = new Set();
  for (const placement of puzzle.placements) {
    if (foundSet.value.has(placement.word)) {
      for (const cell of placement.cells) {
        keys.add(`${cell.r},${cell.c}`);
      }
    }
  }
  return keys;
});

const activeSelectionCells = computed(() => {
  if (dragStart.value && dragEnd.value) {
    return getSelectionLine(dragStart.value, dragEnd.value) || [];
  }
  if (tapAnchor.value) {
    return [tapAnchor.value];
  }
  return [];
});

const activeCellKeys = computed(
  () => new Set(activeSelectionCells.value.map((c) => `${c.r},${c.c}`))
);

const allFound = computed(
  () => foundWords.value.length === puzzle.placements.length
);

function sameCells(a, b) {
  if (a.length !== b.length) return false;
  return a.every((cell, idx) => cell.r === b[idx].r && cell.c === b[idx].c);
}

function tryCommitSelection(cells) {
  if (!cells || cells.length < 2) return false;

  const forwardText = cells.map((c) => puzzle.grid[c.r][c.c]).join('');
  const reversedCells = [...cells].reverse();
  const isFwd = isForwardLine(cells);

  let matchedPlacement = null;

  // 1. Exact coordinate match (forward, or backwards drag over a forward-placed word)
  for (const placement of puzzle.placements) {
    if (foundSet.value.has(placement.word)) continue;
    if (sameCells(cells, placement.cells) || sameCells(reversedCells, placement.cells)) {
      matchedPlacement = placement;
      break;
    }
  }

  // 2. Fallback: forward line spelling an unfound word (e.g. LIEB inside LIEBHABELUNG)
  if (!matchedPlacement && isFwd) {
    matchedPlacement = puzzle.placements.find(
      (p) => !foundSet.value.has(p.word) && p.word === forwardText
    );
  }

  if (matchedPlacement) {
    foundWords.value = [...foundWords.value, matchedPlacement.word];
    feedback.value = `Gefunden: ${matchedPlacement.displayWord}`;
    return true;
  }

  return false;
}

function handlePointerDown(r, c, event) {
  if (event.button && event.button !== 0) return;
  feedback.value = '';
  isDragging.value = true;
  dragStart.value = { r, c };
  dragEnd.value = { r, c };
}

function updateDragTarget(r, c) {
  if (!isDragging.value || !dragStart.value) return;
  const line = getSelectionLine(dragStart.value, { r, c });
  if (line) {
    dragEnd.value = { r, c };
  }
}

function handlePointerMove(event) {
  if (!isDragging.value) return;
  const el = document.elementFromPoint(event.clientX, event.clientY);
  const cellEl = el?.closest?.('[data-ws-cell]');
  if (!cellEl) return;
  const r = Number(cellEl.dataset.r);
  const c = Number(cellEl.dataset.c);
  if (!Number.isNaN(r) && !Number.isNaN(c)) {
    updateDragTarget(r, c);
  }
}

function finishDrag() {
  if (!isDragging.value) return;
  const start = dragStart.value;
  const end = dragEnd.value;
  isDragging.value = false;
  dragStart.value = null;
  dragEnd.value = null;

  if (!start || !end) return;

  // Single tap: support tap-start -> tap-end for comfortable mobile selection
  if (start.r === end.r && start.c === end.c) {
    if (!tapAnchor.value) {
      tapAnchor.value = start;
      return;
    }
    if (tapAnchor.value.r === start.r && tapAnchor.value.c === start.c) {
      tapAnchor.value = null;
      return;
    }
    const line = getSelectionLine(tapAnchor.value, start);
    if (line) {
      tryCommitSelection(line);
    }
    tapAnchor.value = null;
    return;
  }

  tapAnchor.value = null;
  const line = getSelectionLine(start, end);
  if (line) {
    tryCommitSelection(line);
  }
}

function resetPuzzle() {
  foundWords.value = [];
  tapAnchor.value = null;
  feedback.value = '';
}

onMounted(() => {
  window.addEventListener('pointerup', finishDrag);
  window.addEventListener('pointercancel', finishDrag);
});

onBeforeUnmount(() => {
  window.removeEventListener('pointerup', finishDrag);
  window.removeEventListener('pointercancel', finishDrag);
});
</script>

<template>
  <section class="puzzle-box" aria-label="Wortsuche">
    <div class="puzzle-header">
      <h2>Schneewand-Wortsuche</h2>
      <span class="puzzle-progress">
        {{ foundWords.length }} / {{ puzzle.placements.length }} gefunden
      </span>
    </div>

    <p class="puzzle-hint">
      Markiere Wörter vorwärts (waagerecht, senkrecht oder diagonal) durch Ziehen oder Antippen von Anfangs- und Endbuchstabe.
    </p>

    <div
      class="ws-grid"
      :style="{ '--ws-size': puzzle.size }"
      @pointermove="handlePointerMove"
    >
      <template v-for="(row, r) in puzzle.grid" :key="r">
        <button
          v-for="(letter, c) in row"
          :key="`${r}-${c}`"
          type="button"
          class="ws-cell"
          :class="{
            'is-found': foundCellKeys.has(`${r},${c}`),
            'is-selecting': activeCellKeys.has(`${r},${c}`),
            'is-anchor': tapAnchor && tapAnchor.r === r && tapAnchor.c === c,
          }"
          data-ws-cell
          :data-r="r"
          :data-c="c"
          @pointerdown.prevent="handlePointerDown(r, c, $event)"
          @pointerenter="updateDragTarget(r, c)"
        >
          {{ letter }}
        </button>
      </template>
    </div>

    <p v-if="feedback" class="puzzle-feedback">{{ feedback }}</p>

    <div v-if="allFound" class="puzzle-solved">
      Alle {{ puzzle.placements.length }} Wörter gefunden! Die Schneewand ist durchbrochen.
    </div>

    <div class="ws-found-list">
      <span
        v-for="placement in puzzle.placements"
        :key="placement.word"
        class="ws-word-chip"
        :class="{ 'is-discovered': foundSet.has(placement.word) }"
      >
        {{ foundSet.has(placement.word) ? placement.displayWord : `${placement.word.length} Buchstaben` }}
      </span>
    </div>

    <div class="puzzle-actions">
      <button type="button" class="puzzle-btn" @click="resetPuzzle">
        Zurücksetzen
      </button>
    </div>
  </section>
</template>
