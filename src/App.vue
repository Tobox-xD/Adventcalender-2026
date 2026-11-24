<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import StoryPath from './components/StoryPath.vue';
import StoryView from './components/StoryView.vue';
import { isDayUnlocked, loadStories } from './lib/stories.js';

const STORAGE_KEY = 'advent-2026-access-key';
const expectedKey = (import.meta.env.VITE_ACCESS_KEY || '').trim();

const stories = loadStories();
const selectedStory = ref(null);
const lastVisitedDay = ref(null);
const openedFromPath = ref(false);
const hasAccess = ref(!expectedKey);
const codeInput = ref('');
const codeError = ref(false);

function findUnlockedStoryByDay(day) {
  if (!Number.isInteger(day)) return null;
  const match = stories.find((s) => s.day === day);
  return match && isDayUnlocked(match) ? match : null;
}

function getDayFromUrl() {
  const hashMatch = window.location.hash.match(/^#station-(\d+)$/);
  if (!hashMatch) return null;
  return Number.parseInt(hashMatch[1], 10);
}

async function scrollToDayOnPath(day) {
  if (!day) return;
  await nextTick();
  requestAnimationFrame(() => {
    const el = document.querySelector(`[data-day="${day}"]`);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
  });
}

function syncFromHistory(event) {
  const targetDay = event?.state?.day ?? getDayFromUrl();
  const story = findUnlockedStoryByDay(targetDay);

  if (story) {
    lastVisitedDay.value = story.day;
    selectedStory.value = story;
    window.scrollTo({ top: 0, behavior: 'instant' });
    return;
  }

  const returnDay = selectedStory.value?.day || lastVisitedDay.value;
  selectedStory.value = null;
  scrollToDayOnPath(returnDay);
}

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
  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual';
  }

  if (expectedKey) {
    const params = new URLSearchParams(window.location.search);
    const queryKey = params.get('key');

    if (queryKey && unlockWithKey(queryKey.trim())) {
      params.delete('key');
      const nextQuery = params.toString();
      const cleanUrl =
        window.location.pathname +
        (nextQuery ? `?${nextQuery}` : '') +
        window.location.hash;
      window.history.replaceState(window.history.state, '', cleanUrl);
    } else {
      const savedKey = localStorage.getItem(STORAGE_KEY);
      if (savedKey) {
        unlockWithKey(savedKey);
      }
    }
  }

  // Support direct link / refresh on #station-N
  const initialDay = getDayFromUrl();
  const initialStory = findUnlockedStoryByDay(initialDay);
  if (initialStory) {
    lastVisitedDay.value = initialStory.day;
    selectedStory.value = initialStory;
    openedFromPath.value = false;
  }

  window.addEventListener('popstate', syncFromHistory);
});

onBeforeUnmount(() => {
  window.removeEventListener('popstate', syncFromHistory);
});

function submitCode() {
  if (!unlockWithKey(codeInput.value.trim())) {
    codeError.value = true;
  }
}

function handleSelectStory(story) {
  if (!isDayUnlocked(story)) return;
  lastVisitedDay.value = story.day;
  openedFromPath.value = true;
  selectedStory.value = story;

  const targetUrl =
    window.location.pathname + window.location.search + `#station-${story.day}`;
  window.history.pushState({ day: story.day }, '', targetUrl);
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function handleBackToPath() {
  const returnDay = selectedStory.value?.day || lastVisitedDay.value;

  if (openedFromPath.value && window.history.state?.day === returnDay) {
    window.history.back();
    return;
  }

  const baseUrl = window.location.pathname + window.location.search;
  window.history.replaceState({}, '', baseUrl);
  selectedStory.value = null;
  scrollToDayOnPath(returnDay);
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
        @back="handleBackToPath"
      />
      <StoryPath
        v-else
        :stories="stories"
        @select="handleSelectStory"
      />
    </template>
  </main>
</template>
