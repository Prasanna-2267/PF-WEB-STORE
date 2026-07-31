import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeMode } from '@/config/theme';
import { APP_CONSTANTS } from '@/config/constants';

interface ThemeState {
  mode: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const applyThemeToDOM = (mode: ThemeMode) => {
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'light',
      setTheme: (mode: ThemeMode) => {
        applyThemeToDOM(mode);
        set({ mode });
      },
      toggleTheme: () => {
        const nextMode: ThemeMode = get().mode === 'dark' ? 'light' : 'dark';
        applyThemeToDOM(nextMode);
        set({ mode: nextMode });
      },
    }),
    {
      name: APP_CONSTANTS.STORAGE_KEYS.THEME,
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyThemeToDOM(state.mode);
        }
      },
    }
  )
);
