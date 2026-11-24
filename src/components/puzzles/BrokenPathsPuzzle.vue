<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { PUZZLE_CONFIG } from '../../data/puzzles.js';
import {
  createBrokenPathsPuzzle,
  evaluateBrokenPaths,
  getRotatedTileDef,
} from '../../lib/brokenPaths.js';

const STORAGE_KEY = 'advent-2026-puzzle-6-state-v2';
const DRAG_THRESHOLD_PX = 8;

const puzzle = createBrokenPathsPuzzle(PUZZLE_CONFIG.brokenPaths);

const initialRotations = Object.fromEntries(
  puzzle.tiles.map((t) => [t.id, t.initialRotation])
);

const saved = loadSavedState();
// Map of `"r,c"` -> tileId
const placements = ref(saved.placements);
// Map of tileId -> rotation (0..3)
const rotations = ref({ ...initialRotations, ...saved.rotations });

// Active pointer drag state (supports both mouse and touch)
const dragState = ref(null);
const hoverSlotKey = ref(null);
const hoverTray = ref(false);

function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { placements: {}, rotations: {} };
    const parsed = JSON.parse(raw);
    return {
      placements:
        parsed.placements && typeof parsed.placements === 'object'
          ? parsed.placements
          : {},
      rotations:
        parsed.rotations && typeof parsed.rotations === 'object'
          ? parsed.rotations
          : {},
    };
  } catch {
    return { placements: {}, rotations: {} };
  }
}

watch(
  [placements, rotations],
  () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ placements: placements.value, rotations: rotations.value })
      );
    } catch {
      // Ignore storage errors
    }
  },
  { deep: true }
);

const tilesById = Object.fromEntries(puzzle.tiles.map((t) => [t.id, t]));

const placedTileIds = computed(() => new Set(Object.values(placements.value)));

const trayTiles = computed(() =>
  puzzle.tiles.filter((t) => !placedTileIds.value.has(t.id))
);

const resolvedPlacements = computed(() => {
  const out = {};
  for (const [key, tileId] of Object.entries(placements.value)) {
    const tile = tilesById[tileId];
    if (!tile) continue;
    out[key] = {
      ...tile,
      rotation: rotations.value[tileId] ?? tile.initialRotation,
    };
  }
  return out;
});

const evaluation = computed(() =>
  evaluateBrokenPaths(puzzle, resolvedPlacements.value)
);

const draggedTile = computed(() => {
  if (!dragState.value?.hasMoved) return null;
  const tile = tilesById[dragState.value.tileId];
  if (!tile) return null;
  return {
    ...tile,
    rotation: rotations.value[tile.id] ?? tile.initialRotation,
  };
});

function rotateTile(tileId) {
  rotations.value = {
    ...rotations.value,
    [tileId]: ((rotations.value[tileId] ?? 0) + 1) % 4,
  };
}

function placeTile(source, tileId, fromKey, targetKey) {
  const next = { ...placements.value };

  if (source === 'tray') {
    next[targetKey] = tileId;
  } else if (source === 'board') {
    if (fromKey === targetKey) return;
    const displaced = next[targetKey];
    next[targetKey] = tileId;
    if (displaced) {
      next[fromKey] = displaced;
    } else {
      delete next[fromKey];
    }
  }

  placements.value = next;
}

function removeFromSlot(key) {
  const next = { ...placements.value };
  delete next[key];
  placements.value = next;
}

function startPointerDrag(source, tileId, fromKey, event) {
  if (event.button && event.button !== 0) return;
  event.preventDefault();

  dragState.value = {
    source,
    tileId,
    fromKey,
    startX: event.clientX,
    startY: event.clientY,
    x: event.clientX,
    y: event.clientY,
    hasMoved: false,
  };
}

function handlePointerMove(event) {
  if (!dragState.value) return;
  const dx = event.clientX - dragState.value.startX;
  const dy = event.clientY - dragState.value.startY;
  const hasMoved =
    dragState.value.hasMoved || Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX;

  dragState.value = {
    ...dragState.value,
    x: event.clientX,
    y: event.clientY,
    hasMoved,
  };

  if (!hasMoved) return;

  const targetEl = document.elementFromPoint(event.clientX, event.clientY);
  const slotEl = targetEl?.closest?.('[data-bp-slot]');
  const trayEl = targetEl?.closest?.('[data-bp-tray]');

  hoverSlotKey.value = slotEl ? slotEl.dataset.bpSlot : null;
  hoverTray.value = Boolean(!slotEl && trayEl && dragState.value.source === 'board');
}

function handlePointerUp(event) {
  const state = dragState.value;
  if (!state) return;

  dragState.value = null;
  hoverSlotKey.value = null;
  hoverTray.value = false;

  // Tap / click without dragging -> rotate 90° clockwise
  if (!state.hasMoved) {
    rotateTile(state.tileId);
    return;
  }

  // Dropped after dragging -> check drop target
  const targetEl = document.elementFromPoint(event.clientX, event.clientY);
  const slotEl = targetEl?.closest?.('[data-bp-slot]');
  if (slotEl?.dataset.bpSlot) {
    placeTile(state.source, state.tileId, state.fromKey, slotEl.dataset.bpSlot);
    return;
  }

  const trayEl = targetEl?.closest?.('[data-bp-tray]');
  if (trayEl && state.source === 'board' && state.fromKey) {
    removeFromSlot(state.fromKey);
  }
}

function resetPuzzle() {
  placements.value = {};
  rotations.value = { ...initialRotations };
  dragState.value = null;
}

onMounted(() => {
  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);
  window.addEventListener('pointercancel', handlePointerUp);
});

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', handlePointerMove);
  window.removeEventListener('pointerup', handlePointerUp);
  window.removeEventListener('pointercancel', handlePointerUp);
});

// SVG path geometry helper for any tile type + rotation in a 100x100 viewBox
const EDGE_MID = {
  N: [50, 0],
  E: [100, 50],
  S: [50, 100],
  W: [0, 50],
};

const STUB_TIP = {
  N: [50, 28],
  E: [72, 50],
  S: [50, 72],
  W: [28, 50],
};

function getTileRenderData(type, rotation) {
  const def = getRotatedTileDef(type, rotation);
  const paths = [];
  const stubs = [];

  if (def.isOverpass) {
    const [under, over] = def.pairs;
    const [u1, u2] = under;
    const [o1, o2] = over;
    const [ux1, uy1] = EDGE_MID[u1];
    const [ux2, uy2] = EDGE_MID[u2];
    const [ox1, oy1] = EDGE_MID[o1];
    const [ox2, oy2] = EDGE_MID[o2];

    const gap1x = ux1 + (50 - ux1) * 0.64;
    const gap1y = uy1 + (50 - uy1) * 0.64;
    const gap2x = ux2 + (50 - ux2) * 0.64;
    const gap2y = uy2 + (50 - uy2) * 0.64;

    paths.push({ d: `M ${ux1} ${uy1} L ${gap1x} ${gap1y}`, layer: 'under' });
    paths.push({ d: `M ${ux2} ${uy2} L ${gap2x} ${gap2y}`, layer: 'under' });
    paths.push({ d: `M ${ox1} ${oy1} L ${ox2} ${oy2}`, layer: 'over' });
  } else {
    for (const group of def.pairs) {
      if (group.length === 2) {
        const [a, b] = group;
        const [ax, ay] = EDGE_MID[a];
        const [bx, by] = EDGE_MID[b];
        const isOpposite =
          (a === 'N' && b === 'S') ||
          (a === 'S' && b === 'N') ||
          (a === 'E' && b === 'W') ||
          (a === 'W' && b === 'E');

        if (isOpposite) {
          paths.push({ d: `M ${ax} ${ay} L ${bx} ${by}`, layer: 'normal' });
        } else {
          paths.push({ d: `M ${ax} ${ay} Q 50 50 ${bx} ${by}`, layer: 'normal' });
        }
      } else if (group.length === 3) {
        for (const port of group) {
          const [px, py] = EDGE_MID[port];
          paths.push({ d: `M ${px} ${py} L 50 50`, layer: 'normal' });
        }
      }
    }
  }

  for (const stubPort of def.stubs) {
    const [px, py] = EDGE_MID[stubPort];
    const [tx, ty] = STUB_TIP[stubPort];
    stubs.push({
      d: `M ${px} ${py} L ${tx} ${ty}`,
      cx: tx,
      cy: ty,
    });
  }

  return { paths, stubs, type };
}
</script>

<template>
  <section class="puzzle-box" aria-label="Unterbrochene Wege">
    <div class="puzzle-header">
      <h2>Helmuts Heimweg</h2>
      <span class="puzzle-progress">
        {{ Object.keys(placements).length }} Teile eingesetzt
      </span>
    </div>

    <p class="puzzle-hint">
      Ziehe die Wegteile per Drag-and-Drop in die leeren Felder (oder zurück in die Ablage). Tippe bzw. klicke auf ein Teil, um es um 90° zu drehen. Achtung: Manche Wege kreuzen sich nur als Brücke oder führen in Sackgassen!
    </p>

    <div class="bp-board" :style="{ '--bp-cols': puzzle.cols }">
      <template v-for="(row, r) in puzzle.grid" :key="`bp-row-${r}`">
        <div
          v-for="(cell, c) in row"
          :key="`bp-${r}-${c}`"
          class="bp-cell"
          :class="{
            'is-snow': cell.kind === 'snow',
            'is-fixed': cell.kind === 'fixed',
            'is-slot': cell.kind === 'slot',
            'is-filled': cell.kind === 'slot' && Boolean(placements[`${r},${c}`]),
            'is-drop-hover': cell.kind === 'slot' && hoverSlotKey === `${r},${c}`,
            'is-dragging-source':
              dragState?.hasMoved &&
              dragState.source === 'board' &&
              dragState.fromKey === `${r},${c}`,
            'is-on-solution': evaluation.pathCells.has(`${r},${c}`),
            'is-mismatched': evaluation.mismatchedSlots.has(`${r},${c}`),
          }"
          :data-bp-slot="cell.kind === 'slot' ? `${r},${c}` : null"
          @pointerdown="
            cell.kind === 'slot' &&
              placements[`${r},${c}`] &&
              startPointerDrag('board', placements[`${r},${c}`], `${r},${c}`, $event)
          "
        >
          <!-- Fixed board tiles -->
          <template v-if="cell.kind === 'fixed'">
            <svg class="bp-svg" viewBox="0 0 100 100" aria-hidden="true">
              <template
                v-for="(p, idx) in getTileRenderData(cell.type, cell.rotation).paths"
                :key="`fp-${idx}`"
              >
                <path :d="p.d" class="bp-track" :class="`layer-${p.layer}`" />
              </template>
              <template
                v-for="(s, idx) in getTileRenderData(cell.type, cell.rotation).stubs"
                :key="`fs-${idx}`"
              >
                <path :d="s.d" class="bp-track" />
                <circle
                  v-if="
                    cell.type === 'deadend' ||
                    cell.type === 'blockedCorner' ||
                    cell.type === 'blockedStraight'
                  "
                  :cx="s.cx"
                  :cy="s.cy"
                  r="8"
                  class="bp-cap"
                />
              </template>
            </svg>
            <span v-if="cell.type === 'start'" class="bp-endpoint bp-start">
              Helmut
            </span>
            <span v-else-if="cell.type === 'goal'" class="bp-endpoint bp-goal">
              Haus
            </span>
          </template>

          <!-- Placed player tiles -->
          <template v-else-if="cell.kind === 'slot' && resolvedPlacements[`${r},${c}`]">
            <svg class="bp-svg" viewBox="0 0 100 100" aria-hidden="true">
              <template
                v-for="(p, idx) in getTileRenderData(
                  resolvedPlacements[`${r},${c}`].type,
                  resolvedPlacements[`${r},${c}`].rotation
                ).paths"
                :key="`pp-${idx}`"
              >
                <path :d="p.d" class="bp-track is-placed" :class="`layer-${p.layer}`" />
              </template>
              <template
                v-for="(s, idx) in getTileRenderData(
                  resolvedPlacements[`${r},${c}`].type,
                  resolvedPlacements[`${r},${c}`].rotation
                ).stubs"
                :key="`ps-${idx}`"
              >
                <path :d="s.d" class="bp-track is-placed" />
                <circle :cx="s.cx" :cy="s.cy" r="7" class="bp-cap" />
              </template>
            </svg>
            <span class="bp-tile-letter">
              {{ resolvedPlacements[`${r},${c}`].letter }}
            </span>
          </template>
        </div>
      </template>
    </div>

    <div v-if="evaluation.solved" class="puzzle-solved">
      Helmut ist sicher zuhause angekommen! Lösungswort:
      <strong>{{ evaluation.collectedWord }}</strong>
    </div>

    <div
      class="bp-tray-wrap"
      :class="{ 'is-drop-hover': hoverTray }"
      data-bp-tray
    >
      <span class="tray-label">Verfügbare Wegteile ({{ trayTiles.length }})</span>
      <div class="bp-tray">
        <div
          v-for="tile in trayTiles"
          :key="tile.id"
          class="bp-tray-item"
          :class="{
            'is-dragging-source':
              dragState?.hasMoved &&
              dragState.source === 'tray' &&
              dragState.tileId === tile.id,
          }"
          @pointerdown="startPointerDrag('tray', tile.id, null, $event)"
        >
          <svg class="bp-svg" viewBox="0 0 100 100" aria-hidden="true">
            <template
              v-for="(p, idx) in getTileRenderData(
                tile.type,
                rotations[tile.id] ?? tile.initialRotation
              ).paths"
              :key="`tp-${idx}`"
            >
              <path :d="p.d" class="bp-track is-placed" :class="`layer-${p.layer}`" />
            </template>
            <template
              v-for="(s, idx) in getTileRenderData(
                tile.type,
                rotations[tile.id] ?? tile.initialRotation
              ).stubs"
              :key="`ts-${idx}`"
            >
              <path :d="s.d" class="bp-track is-placed" />
              <circle :cx="s.cx" :cy="s.cy" r="7" class="bp-cap" />
            </template>
          </svg>
          <span class="bp-tile-letter">{{ tile.letter }}</span>
        </div>
      </div>
    </div>

    <!-- Floating ghost while dragging -->
    <div
      v-if="draggedTile"
      class="bp-drag-ghost"
      :style="{ left: `${dragState.x}px`, top: `${dragState.y}px` }"
      aria-hidden="true"
    >
      <svg class="bp-svg" viewBox="0 0 100 100">
        <template
          v-for="(p, idx) in getTileRenderData(
            draggedTile.type,
            draggedTile.rotation
          ).paths"
          :key="`gp-${idx}`"
        >
          <path :d="p.d" class="bp-track is-placed" :class="`layer-${p.layer}`" />
        </template>
        <template
          v-for="(s, idx) in getTileRenderData(
            draggedTile.type,
            draggedTile.rotation
          ).stubs"
          :key="`gs-${idx}`"
        >
          <path :d="s.d" class="bp-track is-placed" />
          <circle :cx="s.cx" :cy="s.cy" r="7" class="bp-cap" />
        </template>
      </svg>
      <span class="bp-tile-letter">{{ draggedTile.letter }}</span>
    </div>

    <div class="puzzle-actions">
      <button type="button" class="puzzle-btn" @click="resetPuzzle">
        Zurücksetzen
      </button>
    </div>
  </section>
</template>
