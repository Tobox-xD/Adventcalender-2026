<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { getBagPuzzleImageUrl, PUZZLE_CONFIG } from '../../data/puzzles.js';

const STORAGE_KEY = 'advent-2026-puzzle-2-board';
const GRID_SIZE = PUZZLE_CONFIG.bagPuzzle.size; // 6 -> 6x6 = 36 tiles
const TOTAL_TILES = GRID_SIZE * GRID_SIZE;

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffledIds(seed) {
  const arr = Array.from({ length: TOTAL_TILES }, (_, i) => i);
  const rng = createRng(seed);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const tileImages = ref([]);
const loadError = ref(false);
const board = ref(loadSavedBoard()); // array of length 36: tileId (0..35) or null
const trayOrder = ref(shuffledIds(PUZZLE_CONFIG.bagPuzzle.seed));
const selected = ref(null); // { source: 'tray', tileId } | { source: 'board', slotIndex, tileId }
const dragPayload = ref(null);

function loadSavedBoard() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return Array(TOTAL_TILES).fill(null);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === TOTAL_TILES) {
      return parsed;
    }
  } catch {
    // Ignore storage errors
  }
  return Array(TOTAL_TILES).fill(null);
}

watch(
  board,
  (val) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(val));
    } catch {
      // Ignore storage errors
    }
  },
  { deep: true }
);

const placedSet = computed(() => new Set(board.value.filter((id) => id !== null)));
const trayTiles = computed(() =>
  trayOrder.value.filter((id) => !placedSet.value.has(id))
);

const placedCount = computed(() => placedSet.value.size);

const isSolved = computed(
  () =>
    board.value.length === TOTAL_TILES &&
    board.value.every((tileId, idx) => tileId === idx)
);

function sliceImageToSquareTiles(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const square = Math.min(img.naturalWidth, img.naturalHeight);
      const offsetX = Math.floor((img.naturalWidth - square) / 2);
      const offsetY = Math.floor((img.naturalHeight - square) / 2);
      const tilePx = Math.max(64, Math.floor(Math.min(square, 1200) / GRID_SIZE));
      const srcStep = square / GRID_SIZE;

      const slices = [];
      const canvas = document.createElement('canvas');
      canvas.width = tilePx;
      canvas.height = tilePx;
      const ctx = canvas.getContext('2d');

      for (let r = 0; r < GRID_SIZE; r += 1) {
        for (let c = 0; c < GRID_SIZE; c += 1) {
          ctx.clearRect(0, 0, tilePx, tilePx);
          ctx.drawImage(
            img,
            offsetX + c * srcStep,
            offsetY + r * srcStep,
            srcStep,
            srcStep,
            0,
            0,
            tilePx,
            tilePx
          );
          slices.push(canvas.toDataURL('image/jpeg', 0.88));
        }
      }
      resolve(slices);
    };
    img.onerror = reject;
    img.src = src;
  });
}

onMounted(async () => {
  const imageUrl = getBagPuzzleImageUrl();
  if (!imageUrl) {
    loadError.value = true;
    return;
  }
  try {
    tileImages.value = await sliceImageToSquareTiles(imageUrl);
  } catch {
    loadError.value = true;
  }
});

function placeIntoSlot(payload, targetSlot) {
  if (!payload) return;
  const next = [...board.value];

  if (payload.source === 'tray') {
    next[targetSlot] = payload.tileId;
  } else if (payload.source === 'board') {
    if (payload.slotIndex === targetSlot) return;
    const displaced = next[targetSlot];
    next[targetSlot] = payload.tileId;
    next[payload.slotIndex] = displaced;
  }

  board.value = next;
  selected.value = null;
}

function returnToTray(slotIndex) {
  const next = [...board.value];
  next[slotIndex] = null;
  board.value = next;
  selected.value = null;
}

function onTrayClick(tileId) {
  if (selected.value?.source === 'board') {
    returnToTray(selected.value.slotIndex);
    return;
  }
  if (selected.value?.source === 'tray' && selected.value.tileId === tileId) {
    selected.value = null;
    return;
  }
  selected.value = { source: 'tray', tileId };
}

function onSlotClick(slotIndex) {
  const occupant = board.value[slotIndex];

  if (selected.value) {
    if (selected.value.source === 'board' && selected.value.slotIndex === slotIndex) {
      selected.value = null;
      return;
    }
    placeIntoSlot(selected.value, slotIndex);
    return;
  }

  if (occupant !== null) {
    selected.value = { source: 'board', slotIndex, tileId: occupant };
  }
}

function onDragStartTray(tileId, event) {
  dragPayload.value = { source: 'tray', tileId };
  event.dataTransfer?.setData('text/plain', `tray:${tileId}`);
}

function onDragStartBoard(slotIndex, event) {
  const tileId = board.value[slotIndex];
  if (tileId === null) return;
  dragPayload.value = { source: 'board', slotIndex, tileId };
  event.dataTransfer?.setData('text/plain', `board:${slotIndex}:${tileId}`);
}

function onDropSlot(slotIndex) {
  if (!dragPayload.value) return;
  placeIntoSlot(dragPayload.value, slotIndex);
  dragPayload.value = null;
}

function onDropTray() {
  if (dragPayload.value?.source === 'board') {
    returnToTray(dragPayload.value.slotIndex);
  }
  dragPayload.value = null;
}

function resetPuzzle() {
  board.value = Array(TOTAL_TILES).fill(null);
  trayOrder.value = shuffledIds(PUZZLE_CONFIG.bagPuzzle.seed + Date.now() % 1000);
  selected.value = null;
}
</script>

<template>
  <section class="puzzle-box" aria-label="Taschen-Puzzle">
    <div class="puzzle-header">
      <h2>Taschen-Puzzle ({{ GRID_SIZE }}×{{ GRID_SIZE }})</h2>
      <span class="puzzle-progress">{{ placedCount }} / {{ TOTAL_TILES }} Teile</span>
    </div>

    <p class="puzzle-hint">
      Ziehe die Puzzleteile in die Tasche oder tippe erst ein Teil und dann das Zielfeld an. Zwei Felder auf dem Brett lassen sich einfach tauschen.
    </p>

    <p v-if="loadError" class="error-text">Bild konnte nicht geladen werden.</p>

    <div v-else class="bag-puzzle-layout">
      <div class="bag-frame" :class="{ 'is-solved': isSolved }">
        <div class="bag-handle" aria-hidden="true"></div>
        <div
          class="bag-grid"
          :class="{ 'is-solved': isSolved }"
          :style="{ '--bag-size': GRID_SIZE }"
        >
          <button
            v-for="(tileId, slotIndex) in board"
            :key="slotIndex"
            type="button"
            class="bag-slot"
            :class="{
              'is-filled': tileId !== null,
              'is-selected':
                selected?.source === 'board' && selected.slotIndex === slotIndex,
            }"
            :draggable="tileId !== null"
            @click="onSlotClick(slotIndex)"
            @dblclick="tileId !== null && returnToTray(slotIndex)"
            @dragstart="onDragStartBoard(slotIndex, $event)"
            @dragover.prevent
            @drop.prevent="onDropSlot(slotIndex)"
          >
            <img
              v-if="tileId !== null && tileImages[tileId]"
              :src="tileImages[tileId]"
              :alt="`Puzzleteil ${tileId + 1}`"
              draggable="false"
            />
          </button>
        </div>
      </div>

      <div v-if="isSolved" class="puzzle-solved">
        Fertig gepackt! Alle {{ TOTAL_TILES }} Teile sitzen an ihrem Platz.
      </div>

      <div
        v-if="trayTiles.length > 0 || selected?.source === 'board'"
        class="bag-tray-wrap"
        @dragover.prevent
        @drop.prevent="onDropTray"
      >
        <div class="tray-label-row">
          <span class="tray-label">Übrige Teile ({{ trayTiles.length }})</span>
          <button
            v-if="selected?.source === 'board'"
            type="button"
            class="puzzle-btn-inline"
            @click="returnToTray(selected.slotIndex)"
          >
            Ausgewähltes Teil zurücklegen
          </button>
        </div>

        <div class="bag-tray">
          <button
            v-for="tileId in trayTiles"
            :key="tileId"
            type="button"
            class="bag-tray-piece"
            :class="{
              'is-selected':
                selected?.source === 'tray' && selected.tileId === tileId,
            }"
            draggable="true"
            @click="onTrayClick(tileId)"
            @dragstart="onDragStartTray(tileId, $event)"
          >
            <img
              v-if="tileImages[tileId]"
              :src="tileImages[tileId]"
              :alt="`Puzzleteil ${tileId + 1}`"
              draggable="false"
            />
          </button>
        </div>
      </div>
    </div>

    <div class="puzzle-actions">
      <button type="button" class="puzzle-btn" @click="resetPuzzle">
        Neu mischen
      </button>
    </div>
  </section>
</template>
