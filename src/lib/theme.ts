import { useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light';

const THEME_KEY = 'hishab-theme';
const listeners = new Set<() => void>();

function current(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function setTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* private mode: the choice just won't survive a reload */
  }
  listeners.forEach((l) => l());
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    current
  );
}
