<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import StoryPath from './components/StoryPath.vue';
import StoryView from './components/StoryView.vue';
import { isDayUnlocked, loadStories } from './lib/stories.js';

const STORAGE_KEY = 'advent-2026-access-pw';
const expectedPassword = (import.meta.env.VITE_ACCESS_PW || '').trim();

const stories = loadStories();
const selectedStory = ref(null);
const lastVisitedDay = ref(null);
const openedFromPath = ref(false);
const hasAccess = ref(!expectedPassword);

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
  if (!hasAccess.value) return;
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

function checkAccess() {
  if (!expectedPassword) {
    hasAccess.value = true;
    return true;
  }

  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  if (pathname === '/start') {
    const params = new URLSearchParams(window.location.search);
    const pw = params.get('pw');
    if (pw === expectedPassword) {
      try {
        localStorage.setItem(STORAGE_KEY, pw);
      } catch {
        // Ignore storage errors
      }
      hasAccess.value = true;
      window.history.replaceState({}, '', '/');
      return true;
    }
    hasAccess.value = false;
    return false;
  }

  try {
    const savedPw = localStorage.getItem(STORAGE_KEY);
    if (savedPw === expectedPassword) {
      hasAccess.value = true;
      return true;
    }
  } catch {
    // Ignore storage errors
  }

  hasAccess.value = false;
  return false;
}

onMounted(() => {
  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual';
  }

  const allowed = checkAccess();
  if (!allowed) {
    document.title = 'Domain unregistered';
    return;
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
  <main v-if="!hasAccess" class="unregistered-page">
    <h1>Domain unregistered</h1>
  </main>

  <main v-else class="container">
    <header class="page-header">
      <h1>Adventskalender 2026</h1>
    </header>

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
  </main>
</template>
