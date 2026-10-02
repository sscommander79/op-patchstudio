import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { StudioThemeContext, type StudioAppearance, type StudioThemePreference } from './StudioTheme';
const STORAGE_KEY = 'opstudio-theme';
const APPEARANCE_STORAGE_KEY = 'opstudio-appearance';

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

function readStoredAppearance(): StudioAppearance {
  try {
    return localStorage.getItem(APPEARANCE_STORAGE_KEY) === 'opxy' ? 'opxy' : 'field';
  } catch {
    return 'field';
  }
}

export function StudioThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<StudioThemePreference>(readStoredPreference);
  const [appearance, setAppearanceState] = useState<StudioAppearance>(readStoredAppearance);
  const [darkSystem, setDarkSystem] = useState(systemIsDark);
  const resolved = preference === 'system' ? (darkSystem ? 'dark' : 'light') : preference;

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;
    const update = (event: MediaQueryListEvent) => setDarkSystem(event.matches);
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  // Layout effect: attributes land before paint, so the canvas repaint event below reads the new tokens.
  useLayoutEffect(() => {
    document.documentElement.dataset.studioTheme = resolved;
    document.body.dataset.studioTheme = resolved;
    document.documentElement.dataset.studioAppearance = appearance;
    document.body.dataset.studioAppearance = appearance;
    document.documentElement.style.colorScheme = resolved;
    window.dispatchEvent(new CustomEvent('opstudio-theme-change', { detail: { resolved, appearance } }));
  }, [resolved, appearance]);

  const setPreference = useCallback((value: StudioThemePreference) => {
    try { localStorage.setItem(STORAGE_KEY, value); } catch { /* Keep the presentation preference in memory. */ }
    setPreferenceState(value);
  }, []);
  const setAppearance = useCallback((value: StudioAppearance) => {
    const next: StudioAppearance = value === 'opxy' ? 'opxy' : 'field';
    try { localStorage.setItem(APPEARANCE_STORAGE_KEY, next); } catch { /* Keep the appearance in memory. */ }
    setAppearanceState(next);
  }, []);
  const value = useMemo(() => ({ preference, resolved, setPreference, appearance, setAppearance }), [preference, resolved, setPreference, appearance, setAppearance]);
  return <StudioThemeContext.Provider value={value}>{children}</StudioThemeContext.Provider>;
}
