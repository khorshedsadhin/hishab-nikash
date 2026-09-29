import { todayISO } from './dates';
import { migrate, seed, type State } from './model';

const STORAGE_KEY = 'hishab';

export function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.months || !parsed.activeMonth) return seed();
    return migrate(parsed);
  } catch {
    return seed();
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
export function save(state: State) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked: nothing useful to do */
    }
  }, 300);
}

export function exportData(state: State) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'hishab-' + todayISO() + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* Returns the parsed backup, or the Bangla error message to show. */
export function parseImport(text: string): { state: State } | { error: string } {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: 'ফাইলটা পড়া গেল না, এটা সঠিক JSON না।' };
  }
  if (!parsed || typeof parsed.months !== 'object' || typeof parsed.activeMonth !== 'string') {
    return { error: 'ফাইলের গঠন মিলছে না, এটা হিসাবের ব্যাকআপ বলে মনে হচ্ছে না।' };
  }
  return { state: parsed };
}
