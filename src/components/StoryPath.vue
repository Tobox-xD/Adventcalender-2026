<script setup>
import { computed } from 'vue';
import { formatShortDate, isDayUnlocked } from '../lib/stories.js';

const props = defineProps({
  stories: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(['select']);

const SVG_WIDTH = 800;
const TOP_PAD = 185;
const BOTTOM_PAD = 215;

// Spacious, varied meandering trail with generous vertical and horizontal breathing room
const WAYPOINT_LAYOUT = [
  { xPercent: 20, yGap: 0, side: 'right', bendOut: 105, bendIn: -35 },
  { xPercent: 80, yGap: 375, side: 'left', bendOut: 110, bendIn: 95 },
  { xPercent: 66, yGap: 345, side: 'left', bendOut: -85, bendIn: -125 },
  { xPercent: 18, yGap: 400, side: 'right', bendOut: -100, bendIn: -65 },
  { xPercent: 34, yGap: 355, side: 'right', bendOut: 130, bendIn: 55 },
  { xPercent: 82, yGap: 390, side: 'left', bendOut: 60, bendIn: -115 },
  { xPercent: 20, yGap: 375, side: 'right', bendOut: -85, bendIn: 80 },
  { xPercent: 72, yGap: 365, side: 'left', bendOut: 0, bendIn: 0 },
];

const points = computed(() => {
  let currentY = TOP_PAD;

  return props.stories.map((story, index) => {
    const layout = WAYPOINT_LAYOUT[index % WAYPOINT_LAYOUT.length];
    if (index > 0) {
      currentY += layout.yGap || 330;
    }

    const xPercent = layout.xPercent;
    const x = (xPercent / 100) * SVG_WIDTH;

    return {
      story,
      x,
      y: currentY,
      xPercent,
      side: layout.side,
      bendOut: layout.bendOut,
      bendIn: layout.bendIn,
      index,
    };
  });
});

const totalHeight = computed(() => {
  const pts = points.value;
  if (pts.length === 0) return 320;
  return pts[pts.length - 1].y + BOTTOM_PAD;
});

function buildSketchPath(offsetX = 0, offsetY = 0) {
  const pts = points.value;
  if (pts.length === 0) return '';

  const segments = [`M ${pts[0].x + offsetX} ${pts[0].y + offsetY}`];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const curr = pts[i];
    const next = pts[i + 1];
    const dy = next.y - curr.y;

    const cp1x = curr.x + curr.bendOut + offsetX;
    const cp1y = curr.y + dy * 0.44 + offsetY;
    const cp2x = next.x + curr.bendIn + offsetX;
    const cp2y = curr.y + dy * 0.62 + offsetY;

    segments.push(
      `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x + offsetX} ${next.y + offsetY}`
    );
  }
  return segments.join(' ');
}

const mainPathD = computed(() => buildSketchPath(0, 0));
</script>

<template>
  <div class="trail" :style="{ height: `${totalHeight}px` }">
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

    <ol class="trail-stops">
      <li
        v-for="pt in points"
        :key="pt.story.day"
        :data-day="pt.story.day"
        class="trail-stop"
        :class="[
          `card-${pt.side}`,
          `sketch-v${(pt.index % 4) + 1}`,
          { locked: !isDayUnlocked(pt.story) },
        ]"
        :style="{ left: `${pt.xPercent}%`, top: `${pt.y}px` }"
      >
        <button
          type="button"
          class="waypoint"
          :disabled="!isDayUnlocked(pt.story)"
          :aria-label="
            isDayUnlocked(pt.story)
              ? `Kapitel ${pt.story.day}: ${pt.story.title}`
              : `Kapitel ${pt.story.day} (gesperrt)`
          "
          @click="emit('select', pt.story)"
        >
          {{ pt.story.day }}
        </button>

        <button
          type="button"
          class="polaroid-card"
          :disabled="!isDayUnlocked(pt.story)"
          @click="emit('select', pt.story)"
        >
          <span class="polaroid-photo">
            <img
              v-if="pt.story.imageUrl"
              :src="pt.story.imageUrl"
              :alt="isDayUnlocked(pt.story) ? pt.story.title : `Kapitel ${pt.story.day}`"
              loading="lazy"
            />
          </span>
          <span class="polaroid-caption">
            <span class="polaroid-title">
              {{ isDayUnlocked(pt.story) ? pt.story.title : `Kapitel ${pt.story.day}` }}
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
