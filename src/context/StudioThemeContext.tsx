import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { StudioThemeContext, type StudioThemePreference } from './StudioTheme';
const STORAGE_KEY = 'opstudio-theme';

function systemIsDark() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

function readStoredPreference(): StudioThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function StudioThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<StudioThemePreference>(readStoredPreference);
  const [darkSystem, setDarkSystem] = useState(systemIsDark);
  const resolved = preference === 'system' ? (darkSystem ? 'dark' : 'light') : preference;

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;
    const update = (event: MediaQueryListEvent) => setDarkSystem(event.matches);
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.studioTheme = resolved;
    document.body.dataset.studioTheme = resolved;
    document.documentElement.style.colorScheme = resolved;
    window.dispatchEvent(new CustomEvent('opstudio-theme-change', { detail: { resolved } }));
  }, [resolved]);

  const setPreference = (value: StudioThemePreference) => {
    try { localStorage.setItem(STORAGE_KEY, value); } catch { /* Keep the presentation preference in memory. */ }
    setPreferenceState(value);
  };
  const value = useMemo(() => ({ preference, resolved, setPreference }), [preference, resolved]);
  return <StudioThemeContext.Provider value={value}>{children}</StudioThemeContext.Provider>;
}
