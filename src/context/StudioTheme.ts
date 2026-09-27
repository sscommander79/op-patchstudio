import { createContext, useContext } from 'react';

export type StudioThemePreference = 'light' | 'dark' | 'system';
export interface StudioThemeValue {
  preference: StudioThemePreference;
  resolved: 'light' | 'dark';
  setPreference: (value: StudioThemePreference) => void;
}

export const StudioThemeContext = createContext<StudioThemeValue | null>(null);

export function useStudioTheme() {
  const context = useContext(StudioThemeContext);
  if (!context) throw new Error('useStudioTheme must be used inside StudioThemeProvider');
  return context;
}
