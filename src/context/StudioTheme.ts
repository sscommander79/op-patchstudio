import { createContext, useContext } from 'react';

export type StudioThemePreference = 'light' | 'dark' | 'system';
/** Visual identity, independent of the light/dark preference. `field` is the original presentation. */
export type StudioAppearance = 'field' | 'opxy';
export interface StudioThemeValue {
  preference: StudioThemePreference;
  resolved: 'light' | 'dark';
  setPreference: (value: StudioThemePreference) => void;
  appearance: StudioAppearance;
  setAppearance: (value: StudioAppearance) => void;
}

export const StudioThemeContext = createContext<StudioThemeValue | null>(null);

export function useStudioTheme() {
  const context = useContext(StudioThemeContext);
  if (!context) throw new Error('useStudioTheme must be used inside StudioThemeProvider');
  return context;
}

/** Appearance for presentation branches; components rendered outside the provider keep Field. */
export function useStudioAppearance(): StudioAppearance {
  return useContext(StudioThemeContext)?.appearance ?? 'field';
}
