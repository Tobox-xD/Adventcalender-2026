import { marked } from 'marked';
import storyMarkdown from '../../Geschichte.md?raw';

const CALENDAR_YEAR = 2026;
const CALENDAR_MONTH_INDEX = 11; // December (0-indexed)
// Set VITE_ENFORCE_UNLOCK_DATES=true when you want date-locking active
const ENFORCE_UNLOCK_DATES = import.meta.env.VITE_ENFORCE_UNLOCK_DATES === 'true';

// Optional audio files: drop e.g. src/content/audio/01.mp3 (or .m4a, .ogg, .wav)
const audioModules = import.meta.glob('../content/audio/*.{mp3,m4a,ogg,wav}', {
  query: '?url',
  import: 'default',
  eager: true,
});

// Pictures: numbered files (01.jpg, 02.webp, ...) match chapters; any other image acts as placeholder
const pictureModules = import.meta.glob(
  '../content/pictures/*.{webp,png,jpg,jpeg,avif}',
  {
    query: '?url',
    import: 'default',
    eager: true,
  }
);

function buildAudioLookup() {
  const byDay = new Map();
  let placeholder = null;

  for (const [path, url] of Object.entries(audioModules)) {
    const numberedMatch = path.match(/\/(\d+)\.[^.]+$/);
    if (numberedMatch) {
      const day = Number.parseInt(numberedMatch[1], 10);
      if (!Number.isNaN(day) && !byDay.has(day)) {
        byDay.set(day, url);
      }
    } else if (!placeholder) {
      placeholder = url;
    }
  }

  return { byDay, placeholder };
}

function buildPictureLookup() {
  const byDay = new Map();
  let placeholder = null;

  for (const [path, url] of Object.entries(pictureModules)) {
    const numberedMatch = path.match(/\/(\d+)\.[^.]+$/);
    if (numberedMatch) {
      const day = Number.parseInt(numberedMatch[1], 10);
      if (!Number.isNaN(day) && !byDay.has(day)) {
        byDay.set(day, url);
      }
    } else if (!placeholder) {
      placeholder = url;
    }
  }

  return { byDay, placeholder };
}

function parseChapters(markdown) {
  const normalized = markdown.replace(/\r\n/g, '\n').trim();
  const sections = normalized.split(/(?=^#\s+)/m).filter((s) => s.trim().length > 0);
  const { byDay: audioMap, placeholder: placeholderAudio } = buildAudioLookup();
  const { byDay: pictureMap, placeholder: placeholderPicture } = buildPictureLookup();

  return sections
    .map((section, index) => {
      const lines = section.split('\n');
      const rawHeading = lines[0].replace(/^#\s+/, '').trim();
      const body = lines.slice(1).join('\n').trim();

      const numberMatch = rawHeading.match(/\((\d+)\)/);
      const day = numberMatch ? Number.parseInt(numberMatch[1], 10) : index + 1;
      const title = rawHeading
        .replace(/\(\d+\)/g, '')
        .replace(/:\s*$/, '')
        .trim();

      const fullMarkdown = `# ${title}\n\n${body}`;

      return {
        day,
        title: title || `Kapitel ${day}`,
        markdown: fullMarkdown,
        html: marked.parse(fullMarkdown, { breaks: true }),
        audioUrl: audioMap.get(day) || placeholderAudio,
        imageUrl: pictureMap.get(day) || placeholderPicture,
        unlockDate: new Date(CALENDAR_YEAR, CALENDAR_MONTH_INDEX, day, 0, 0, 0),
      };
    })
    .sort((a, b) => a.day - b.day);
}

export function loadStories() {
  return parseChapters(storyMarkdown);
}

export function isDayUnlocked(story, now = new Date()) {
  if (!ENFORCE_UNLOCK_DATES || import.meta.env.VITE_UNLOCK_ALL === 'true') {
    return true;
  }
  return now.getTime() >= story.unlockDate.getTime();
}

export function formatUnlockDate(date) {
  return new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatShortDate(date) {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}
