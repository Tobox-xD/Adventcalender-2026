<script setup>
import { onMounted, ref } from 'vue';
import StoryPath from './components/StoryPath.vue';
import StoryView from './components/StoryView.vue';
import { isDayUnlocked, loadStories } from './lib/stories.js';

const STORAGE_KEY = 'advent-2026-access-key';
const expectedKey = (import.meta.env.VITE_ACCESS_KEY || '').trim();

const stories = loadStories();
const selectedStory = ref(null);
const hasAccess = ref(!expectedKey);
const codeInput = ref('');
const codeError = ref(false);

function unlockWithKey(candidate) {
  if (!expectedKey || candidate === expectedKey) {
    hasAccess.value = true;
    codeError.value = false;
    if (expectedKey) {
      localStorage.setItem(STORAGE_KEY, candidate);
    }
    return true;
  }
  return false;
}

onMounted(() => {
  if (!expectedKey) return;

  const params = new URLSearchParams(window.location.search);
  const queryKey = params.get('key');

  if (queryKey && unlockWithKey(queryKey.trim())) {
    params.delete('key');
    const nextQuery = params.toString();
    const cleanUrl = window.location.pathname + (nextQuery ? `?${nextQuery}` : '');
    window.history.replaceState({}, '', cleanUrl);
    return;
  }

  const savedKey = localStorage.getItem(STORAGE_KEY);
  if (savedKey) {
    unlockWithKey(savedKey);
  }
});

function submitCode() {
  if (!unlockWithKey(codeInput.value.trim())) {
    codeError.value = true;
  }
}

function handleSelectStory(story) {
  if (isDayUnlocked(story)) {
    selectedStory.value = story;
    window.scrollTo({ top: 0 });
  }
}
</script>

<template>
  <main class="container">
    <header class="page-header">
      <h1>Adventskalender 2026</h1>
    </header>

    <section v-if="!hasAccess" class="access-gate">
      <p>Diese Seite ist privat. Bitte öffne deinen persönlichen Link oder gib den Code ein.</p>
      <form class="access-form" @submit.prevent="submitCode">
        <input
          v-model="codeInput"
          type="password"
          placeholder="Code"
          autocomplete="off"
        />
        <button type="submit">Öffnen</button>
      </form>
      <p v-if="codeError" class="error-text">Ungültiger Code.</p>
    </section>

    <template v-else>
      <StoryView
        v-if="selectedStory"
        :story="selectedStory"
        @back="selectedStory = null"
      />
      <StoryPath
        v-else
        :stories="stories"
        @select="handleSelectStory"
      />
    </template>
  </main>
</template>
