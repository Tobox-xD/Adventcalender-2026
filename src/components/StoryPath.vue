<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  formatShortDate,
  isDayUnlocked,
  scrambleTitle,
} from '../lib/stories.js';
import { removeBlackBackground } from '../lib/spriteTransparency.js';
import cursor1RawUrl from '../content/pictures/cursor1.jpeg';
import cursor2RawUrl from '../content/pictures/cursor2.jpeg';
import lockImgUrl from '../content/pictures/lock.jpeg';

const props = defineProps({
  stories: {
    type: Array,
    required: true,
  },
  debugRevealDay: {
    type: Number,
    default: null,
  },
});

const emit = defineEmits(['select']);

function isRevealed(story) {
  return isDayUnlocked(story, { maxRevealedDay: props.debugRevealDay });
}

const SVG_WIDTH = 800;
const TOP_PAD = 185;
const BOTTOM_PAD = 215;

// Desktop: organic, C1-smooth winding trail through the center corridor (37%–63%)
// with varied left/right rhythm and Polaroids on the outside of every bend.
// Incoming handle uses -tx and outgoing handle uses +tx for zero sharp corners.
const DESKTOP_LAYOUT = [
  { xPercent: 38, yGap: 0, side: 'left', tx: 0 },
  { xPercent: 63, yGap: 360, side: 'right', tx: 0 },
  { xPercent: 58, yGap: 345, side: 'right', tx: -26 },
  { xPercent: 37, yGap: 375, side: 'left', tx: 0 },
  { xPercent: 42, yGap: 350, side: 'left', tx: 26 },
  { xPercent: 63, yGap: 375, side: 'right', tx: 0 },
  { xPercent: 38, yGap: 365, side: 'left', tx: 0 },
  { xPercent: 61, yGap: 355, side: 'right', tx: 0 },
];

// Compact/mobile: smooth S-curves keeping Polaroids inside the viewport.
const COMPACT_LAYOUT = [
  { xPercent: 58, yGap: 0, side: 'left', tx: 0 },
  { xPercent: 42, yGap: 350, side: 'right', tx: 0 },
  { xPercent: 45, yGap: 340, side: 'right', tx: 16 },
  { xPercent: 58, yGap: 355, side: 'left', tx: 0 },
  { xPercent: 55, yGap: 345, side: 'left', tx: -16 },
  { xPercent: 42, yGap: 355, side: 'right', tx: 0 },
  { xPercent: 58, yGap: 350, side: 'left', tx: 0 },
  { xPercent: 43, yGap: 345, side: 'right', tx: 0 },
];

const isCompact = ref(
  typeof window !== 'undefined' ? window.innerWidth <= 680 : false
);

const points = computed(() => {
  const layoutTable = isCompact.value ? COMPACT_LAYOUT : DESKTOP_LAYOUT;
  let currentY = TOP_PAD;

  return props.stories.map((story, index) => {
    const layout = layoutTable[index % layoutTable.length];
    if (index > 0) {
      currentY += layout.yGap || 350;
    }

    const xPercent = layout.xPercent;
    const x = (xPercent / 100) * SVG_WIDTH;

    return {
      story,
      x,
      y: currentY,
      xPercent,
      side: layout.side,
      tx: layout.tx || 0,
      index,
    };
  });
});

const totalHeight = computed(() => {
  const pts = points.value;
  if (pts.length === 0) return 320;
  return pts[pts.length - 1].y + BOTTOM_PAD;
});

function getSegmentControlPoints(curr, next, offsetX = 0, offsetY = 0) {
  const dy = next.y - curr.y;
  const handleY = dy * 0.46;
  return {
    p0x: curr.x + offsetX,
    p0y: curr.y + offsetY,
    p1x: curr.x + curr.tx + offsetX,
    p1y: curr.y + handleY + offsetY,
    p2x: next.x - next.tx + offsetX,
    p2y: next.y - handleY + offsetY,
    p3x: next.x + offsetX,
    p3y: next.y + offsetY,
  };
}

function buildSketchPath(offsetX = 0, offsetY = 0) {
  const pts = points.value;
  if (pts.length === 0) return '';

  const segments = [`M ${pts[0].x + offsetX} ${pts[0].y + offsetY}`];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const seg = getSegmentControlPoints(pts[i], pts[i + 1], offsetX, offsetY);
    segments.push(
      `C ${seg.p1x} ${seg.p1y}, ${seg.p2x} ${seg.p2y}, ${seg.p3x} ${seg.p3y}`
    );
  }
  return segments.join(' ');
}

const mainPathD = computed(() => buildSketchPath(0, 0));

// Scroll-following cursor along the cubic Bezier trail
const trailRef = ref(null);
const cursor1Src = ref('');
const cursor2Src = ref('');
const cursorXPercent = ref(points.value[0]?.xPercent ?? 20);
const cursorY = ref(points.value[0]?.y ?? TOP_PAD);
const facingRight = ref(false);

const withCompanion = computed(() => {
  const pts = points.value;
  const day5 = pts.find((p) => p.story.day === 5);
  const day6 = pts.find((p) => p.story.day === 6);
  if (!day5 || !day6) return false;
  return cursorY.value >= day5.y - 24 && cursorY.value <= day6.y + 40;
});

const lastRevealedPoint = computed(() => {
  let last = null;
  for (const pt of points.value) {
    if (isRevealed(pt.story)) {
      last = pt;
    }
  }
  return last;
});

const activeCursorSrc = computed(() =>
  withCompanion.value ? cursor2Src.value : cursor1Src.value
);

const showCursor = computed(() =>
  Boolean(activeCursorSrc.value && lastRevealedPoint.value)
);

function evalCubic(a, b, c, d, t) {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
}

function evalCubicDeriv(a, b, c, d, t) {
  const u = 1 - t;
  return 3 * u * u * (b - a) + 6 * u * t * (c - b) + 3 * t * t * (d - c);
}

function sampleTrailAtY(rawY) {
  const pts = points.value;
  if (pts.length === 0) return { xPercent: 50, y: TOP_PAD, dx: 0 };
  if (pts.length === 1) return { xPercent: pts[0].xPercent, y: pts[0].y, dx: 0 };

  const minY = pts[0].y;
  const maxY = pts[pts.length - 1].y;
  const clampedY = Math.min(maxY, Math.max(minY, rawY));

  let segIdx = 0;
  for (let i = 0; i < pts.length - 1; i += 1) {
    if (clampedY <= pts[i + 1].y || i === pts.length - 2) {
      segIdx = i;
      break;
    }
  }

  const { p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y } = getSegmentControlPoints(
    pts[segIdx],
    pts[segIdx + 1]
  );

  let lo = 0;
  let hi = 1;
  for (let iter = 0; iter < 18; iter += 1) {
    const mid = (lo + hi) * 0.5;
    if (evalCubic(p0y, p1y, p2y, p3y, mid) < clampedY) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const t = (lo + hi) * 0.5;
  const x = evalCubic(p0x, p1x, p2x, p3x, t);
  const dx = evalCubicDeriv(p0x, p1x, p2x, p3x, t);

  return {
    xPercent: (x / SVG_WIDTH) * 100,
    y: clampedY,
    dx,
  };
}

let targetY = TOP_PAD;
let currentY = TOP_PAD;
let rafId = null;

function computeTargetY() {
  const el = trailRef.value;
  const pts = points.value;
  const lastPt = lastRevealedPoint.value;
  if (!el || pts.length === 0 || !lastPt) return TOP_PAD;

  const rect = el.getBoundingClientRect();
  const maxScroll = Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight
  );
  const progress =
    maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;
  const anchorRatio = 0.22 + progress * 0.56;
  const rawY = window.innerHeight * anchorRatio - rect.top;

  return Math.min(lastPt.y, Math.max(pts[0].y, rawY));
}

function applyCursorAtY(y) {
  const sample = sampleTrailAtY(y);
  cursorXPercent.value = sample.xPercent;
  cursorY.value = sample.y;
  if (sample.dx > 12) {
    facingRight.value = true;
  } else if (sample.dx < -12) {
    facingRight.value = false;
  }
}

function stepCursor() {
  const diff = targetY - currentY;
  if (Math.abs(diff) < 0.6) {
    currentY = targetY;
    applyCursorAtY(currentY);
    rafId = null;
    return;
  }

  currentY += diff * 0.22;
  applyCursorAtY(currentY);
  rafId = requestAnimationFrame(stepCursor);
}

function handleScrollOrResize() {
  isCompact.value = window.innerWidth <= 680;
  targetY = computeTargetY();
  if (rafId === null) {
    rafId = requestAnimationFrame(stepCursor);
  }
}

function snapCursorToScroll() {
  if (!lastRevealedPoint.value) return;
  targetY = computeTargetY();
  currentY = targetY;
  applyCursorAtY(currentY);
}

watch(lastRevealedPoint, (nextPt, prevPt) => {
  if (!nextPt) return;
  if (!prevPt) {
    snapCursorToScroll();
    return;
  }
  targetY = computeTargetY();
  if (rafId === null) {
    rafId = requestAnimationFrame(stepCursor);
  }
});

onMounted(async () => {
  snapCursorToScroll();
  // Snap again after scroll restoration from StoryView settles
  requestAnimationFrame(snapCursorToScroll);

  window.addEventListener('scroll', handleScrollOrResize, { passive: true });
  window.addEventListener('resize', handleScrollOrResize, { passive: true });

  const [c1, c2] = await Promise.all([
    removeBlackBackground(cursor1RawUrl),
    removeBlackBackground(cursor2RawUrl),
  ]);
  cursor1Src.value = c1;
  cursor2Src.value = c2;
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScrollOrResize);
  window.removeEventListener('resize', handleScrollOrResize);
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
});
</script>

<template>
  <div ref="trailRef" class="trail" :style="{ height: `${totalHeight}px` }">
    <svg
      class="trail-svg"
      :viewBox="`0 0 ${SVG_WIDTH} ${totalHeight}`"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <filter id="sketch-stroke" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.025"
            numOctaves="3"
            seed="7"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="3.2"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>

      <path
        class="trail-snow"
        :d="mainPathD"
        vector-effect="non-scaling-stroke"
        filter="url(#sketch-stroke)"
      />
    </svg>

    <div
      v-if="showCursor"
      class="trail-cursor"
      :class="{ 'facing-right': facingRight }"
      :style="{ left: `${cursorXPercent}%`, top: `${cursorY}px` }"
      aria-hidden="true"
    >
      <img :src="activeCursorSrc" alt="" />
    </div>

    <ol class="trail-stops">
      <li
        v-for="pt in points"
        :key="pt.story.day"
        :data-day="pt.story.day"
        class="trail-stop"
        :class="[
          `card-${pt.side}`,
          `sketch-v${(pt.index % 4) + 1}`,
          { locked: !isRevealed(pt.story) },
        ]"
        :style="{ left: `${pt.xPercent}%`, top: `${pt.y}px` }"
      >
        <button
          type="button"
          class="waypoint"
          :disabled="!isRevealed(pt.story)"
          :aria-label="
            isRevealed(pt.story)
              ? `Kapitel ${pt.story.day}: ${pt.story.title}`
              : `Kapitel ${pt.story.day} (gesperrt)`
          "
          @click="isRevealed(pt.story) && emit('select', pt.story)"
        >
          {{ pt.story.day }}
        </button>

        <button
          type="button"
          class="polaroid-card"
          :disabled="!isRevealed(pt.story)"
          @click="isRevealed(pt.story) && emit('select', pt.story)"
        >
          <span class="polaroid-photo">
            <img
              v-if="isRevealed(pt.story) ? pt.story.imageUrl : lockImgUrl"
              :src="isRevealed(pt.story) ? pt.story.imageUrl : lockImgUrl"
              :alt="isRevealed(pt.story) ? pt.story.title : `Kapitel ${pt.story.day} (gesperrt)`"
              loading="lazy"
            />
          </span>
          <span class="polaroid-caption">
            <span class="polaroid-title">
              {{
                isRevealed(pt.story)
                  ? pt.story.title
                  : scrambleTitle(pt.story.title, pt.story.day)
              }}
            </span>
          </span>
          <span class="polaroid-date">
            {{ formatShortDate(pt.story.unlockDate) }}
          </span>
        </button>
      </li>
    </ol>
  </div>
</template>
