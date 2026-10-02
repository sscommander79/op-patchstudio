import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StudioShell } from '../../components/common/StudioShell';
import { StudioThemeProvider } from '../../context/StudioThemeContext';
import { AppearanceSwitch } from '../../components/common/AppearanceSwitch';

const studio = vi.hoisted(() => ({
  state: { currentTab: 'drum', drumSamples: [] as Array<{ isLoaded: boolean } | null>, multisampleFiles: [] as Array<{ isLoaded: boolean }>, midiNoteMapping: {} },
  dispatch: vi.fn(),
}));

vi.mock('../../context/AppContext', () => ({ useAppContext: () => studio }));
vi.mock('../../components/common/MainTabs', () => ({ MainTabs: () => <div data-testid="main-tabs" /> }));
vi.mock('../../components/common/ProjectToolbar', () => ({ ProjectToolbar: () => null }));

const renderShell = () => render(<StudioThemeProvider><StudioShell themePicker={<AppearanceSwitch />} /></StudioThemeProvider>);
const launch = () => screen.getByRole('region', { name: 'What are you working on?' });
const diagramIds = () => within(launch()).getAllByRole('article').map(module => module.querySelector('[data-launch-diagram]')?.getAttribute('data-launch-diagram'));

afterEach(() => vi.unstubAllGlobals());

describe('StudioShell appearance artwork', () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); }, clear: () => data.clear(), key: () => null, length: 0 });
    studio.state.drumSamples = [];
    studio.state.multisampleFiles = [];
    window.history.replaceState(null, '', '#/studio/overview');
    vi.stubGlobal('scrollTo', vi.fn());
  });

  it('keeps the original Field artwork by default', () => {
    renderShell();
    expect(diagramIds()).toEqual(['note-range', 'capture', 'pad-map', 'tracks']);
    expect(launch().querySelectorAll('[data-appearance-art="opxy"]')).toHaveLength(0);
    expect(within(launch()).getByRole('img', { name: 'Drum kit illustration: bass drum, snare and percussion on six colorful pads' })).toBeInTheDocument();
    expect(launch().querySelectorAll('[data-percussion]')).toHaveLength(6);
    expect(document.querySelector('.studio-opxy-display')).toBeNull();
  });

  it('switches all four launch cards to distinct original OP-XY artwork without changing actions', () => {
    renderShell();
    const fieldButtons = within(launch()).getAllByRole('button').map(button => button.getAttribute('aria-label') ?? button.textContent);
    fireEvent.click(screen.getByRole('radio', { name: 'OP-XY' }));

    expect(diagramIds()).toEqual(['note-range', 'capture', 'pad-map', 'tracks']);
    const art = Array.from(launch().querySelectorAll('[data-appearance-art="opxy"]'));
    expect(art).toHaveLength(4);
    // Field-only percussion drawings and colour palettes are gone in OP-XY.
    expect(launch().querySelectorAll('[data-percussion]')).toHaveLength(0);
    expect(launch().querySelectorAll('[data-art-color]')).toHaveLength(0);
    const names = art.map(node => node.getAttribute('aria-label') ?? '');
    expect(new Set(names).size).toBe(4);
    expect(names.join(' ')).not.toMatch(/colorful/i);
    // Idle launch artwork never shows a live recording indicator or invented parameter locks.
    expect(launch().textContent).not.toMatch(/\bREC\b/);
    expect(names.join(' ')).not.toMatch(/p-lock|parameter lock|recording now/i);
    expect(within(launch()).getAllByRole('button').map(button => button.getAttribute('aria-label') ?? button.textContent)).toEqual(fieldButtons);
    expect(document.querySelector('.studio-opxy-display')).toHaveAttribute('aria-hidden', 'true');
  });

  it('OP-XY note range reflects the loaded zone count from project data', () => {
    studio.state.multisampleFiles = [{ isLoaded: true }, { isLoaded: true }, { isLoaded: false }];
    localStorage.setItem('opstudio-appearance', 'opxy');
    renderShell();
    const noteRange = launch().querySelector('[data-launch-diagram="note-range"]')!;
    expect(noteRange).toHaveAttribute('data-appearance-art', 'opxy');
    expect(noteRange.getAttribute('aria-label')).toMatch(/2 loaded/);
    expect(noteRange.querySelectorAll('[data-zone-state="loaded"]')).toHaveLength(2);
    expect(noteRange.querySelectorAll('[data-zone]')).toHaveLength(24);
  });

  it('switching back restores the Field artwork and keeps the route', () => {
    localStorage.setItem('opstudio-appearance', 'opxy');
    renderShell();
    fireEvent.click(screen.getByRole('radio', { name: 'OP-1 Field' }));
    expect(launch().querySelectorAll('[data-appearance-art="opxy"]')).toHaveLength(0);
    expect(launch().querySelectorAll('[data-percussion]')).toHaveLength(6);
    expect(window.location.hash).toBe('#/studio/overview');
  });
});
