<script setup>
import { computed } from 'vue';
import { formatUnlockDate } from '../lib/stories.js';
import WordSearchPuzzle from './puzzles/WordSearchPuzzle.vue';
import BagPicturePuzzle from './puzzles/BagPicturePuzzle.vue';
import MazePuzzle from './puzzles/MazePuzzle.vue';
import BrokenPathsPuzzle from './puzzles/BrokenPathsPuzzle.vue';

const props = defineProps({
  story: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['back']);

const PUZZLE_BY_DAY = {
  1: WordSearchPuzzle,
  2: BagPicturePuzzle,
  3: MazePuzzle,
  6: BrokenPathsPuzzle,
};

const activePuzzle = computed(() => PUZZLE_BY_DAY[props.story.day] || null);
</script>

<template>
  <section class="story-view">
    <button type="button" class="back-button" @click="emit('back')">
      ← Zurück zum Pfad
    </button>

    <p class="story-date">{{ formatUnlockDate(story.unlockDate) }}</p>

    <div class="audio-box">
      <audio
        v-if="story.audioUrl"
        controls
        preload="metadata"
        :src="story.audioUrl"
      >
        Dein Browser unterstützt keinen Audio-Player.
      </audio>
      <p v-else class="audio-placeholder">
        Audioaufnahme für Kapitel {{ story.day }} folgt noch.
      </p>
    </div>

    <article class="story-text" v-html="story.html" />

    <component :is="activePuzzle" v-if="activePuzzle" :key="story.day" />
  </section>
</template>
