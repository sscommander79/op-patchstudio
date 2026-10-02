import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StudioThemeProvider } from '../../context/StudioThemeContext';
import { useStudioTheme } from '../../context/StudioTheme';
import { AppearanceSwitch } from '../../components/common/AppearanceSwitch';

const APPEARANCE_KEY = 'opstudio-appearance';
const THEME_KEY = 'opstudio-theme';

function Probe() {
  const { appearance, preference, setPreference } = useStudioTheme();
  return <>
    <output data-testid="appearance">{appearance}</output>
    <output data-testid="preference">{preference}</output>
    <button type="button" onClick={() => setPreference('dark')}>Use dark</button>
  </>;
}

function renderWithProvider() {
  return render(<StudioThemeProvider><AppearanceSwitch /><Probe /></StudioThemeProvider>);
}

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: key => data.get(key) ?? null,
    key: index => [...data.keys()][index] ?? null,
    removeItem: key => { data.delete(key); },
    setItem: (key, value) => { data.set(key, String(value)); },
  };
}

function blockedStorage(): Storage {
  const blocked = () => { throw new DOMException('blocked', 'SecurityError'); };
  return { length: 0, clear: blocked, getItem: blocked, key: blocked, removeItem: blocked, setItem: blocked };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  delete document.documentElement.dataset.studioAppearance;
  delete document.body.dataset.studioAppearance;
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('studio appearance preference', () => {
  it('defaults to OP-1 Field and marks html and body', () => {
    renderWithProvider();
    expect(screen.getByTestId('appearance')).toHaveTextContent('field');
    expect(document.documentElement.dataset.studioAppearance).toBe('field');
    expect(document.body.dataset.studioAppearance).toBe('field');
    expect(screen.getByRole('radio', { name: 'OP-1 Field' })).toBeChecked();
  });

  it('ignores an invalid stored value and falls back to Field', () => {
    localStorage.setItem(APPEARANCE_KEY, 'studio');
    renderWithProvider();
    expect(screen.getByTestId('appearance')).toHaveTextContent('field');
    expect(document.documentElement.dataset.studioAppearance).toBe('field');
  });

  it('restores a stored OP-XY appearance', () => {
    localStorage.setItem(APPEARANCE_KEY, 'opxy');
    renderWithProvider();
    expect(screen.getByRole('radio', { name: 'OP-XY' })).toBeChecked();
    expect(document.documentElement.dataset.studioAppearance).toBe('opxy');
  });

  it('persists the choice under its own key without writing the theme key', () => {
    localStorage.setItem(THEME_KEY, 'light');
    renderWithProvider();
    fireEvent.click(screen.getByRole('radio', { name: 'OP-XY' }));
    expect(localStorage.getItem(APPEARANCE_KEY)).toBe('opxy');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
    expect(screen.getByTestId('preference')).toHaveTextContent('light');
    expect(document.documentElement.dataset.studioTheme).toBe('light');
  });

  it('changing the theme leaves the appearance untouched', () => {
    localStorage.setItem(APPEARANCE_KEY, 'opxy');
    renderWithProvider();
    fireEvent.click(screen.getByRole('button', { name: 'Use dark' }));
    expect(localStorage.getItem(APPEARANCE_KEY)).toBe('opxy');
    expect(screen.getByTestId('appearance')).toHaveTextContent('opxy');
    expect(document.documentElement.dataset.studioTheme).toBe('dark');
  });

  it('keeps working in memory when storage throws', () => {
    vi.stubGlobal('localStorage', blockedStorage());
    renderWithProvider();
    expect(screen.getByTestId('appearance')).toHaveTextContent('field');
    fireEvent.click(screen.getByRole('radio', { name: 'OP-XY' }));
    expect(screen.getByTestId('appearance')).toHaveTextContent('opxy');
    expect(document.documentElement.dataset.studioAppearance).toBe('opxy');
  });

  it('announces a change on the existing canvas repaint event after the attribute is applied', () => {
    renderWithProvider();
    const seen: Array<{ attr: string | undefined; appearance: unknown }> = [];
    const listener = (event: Event) => seen.push({ attr: document.documentElement.dataset.studioAppearance, appearance: (event as CustomEvent<{ appearance?: string }>).detail?.appearance });
    window.addEventListener('opstudio-theme-change', listener);
    act(() => { fireEvent.click(screen.getByRole('radio', { name: 'OP-XY' })); });
    window.removeEventListener('opstudio-theme-change', listener);
    expect(seen).toContainEqual({ attr: 'opxy', appearance: 'opxy' });
  });
});

describe('AppearanceSwitch', () => {
  it('is one named group of exactly two native radios, never a tablist', () => {
    renderWithProvider();
    const group = screen.getByRole('group', { name: 'Appearance' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map(radio => radio.getAttribute('value'))).toEqual(['field', 'opxy']);
    expect(radios.map(radio => (radio as HTMLInputElement).type)).toEqual(['radio', 'radio']);
    expect(within(group).getByText('OP-1 Field')).toBeVisible();
    expect(within(group).getByText('OP-XY')).toBeVisible();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('arrow keys move and select the appearance while focus stays on the radio', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    const field = screen.getByRole('radio', { name: 'OP-1 Field' });
    await user.click(field);
    await user.keyboard('{ArrowRight}');
    const opxy = screen.getByRole('radio', { name: 'OP-XY' });
    expect(opxy).toBeChecked();
    expect(opxy).toHaveFocus();
    expect(screen.getByTestId('appearance')).toHaveTextContent('opxy');
    await user.keyboard('{ArrowLeft}');
    expect(field).toBeChecked();
    expect(screen.getByTestId('appearance')).toHaveTextContent('field');
  });

  it('keeps a keyboard focus marker after arrow selection and clears it for pointer use', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    const group = screen.getByRole('group', { name: 'Appearance' });
    await user.click(screen.getByRole('radio', { name: 'OP-1 Field' }));
    expect(group).not.toHaveAttribute('data-keyboard-focus');
    await user.keyboard('{ArrowRight}');
    expect(group).toHaveAttribute('data-keyboard-focus', 'true');
    await user.click(screen.getByRole('radio', { name: 'OP-1 Field' }));
    expect(group).not.toHaveAttribute('data-keyboard-focus');
    await user.keyboard('{ArrowRight}');
    await user.tab();
    expect(group).not.toHaveAttribute('data-keyboard-focus');
  });
});
