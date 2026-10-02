import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StudioShell } from '../../components/common/StudioShell';

const studio = vi.hoisted(() => ({
  state: { currentTab: 'drum', drumSamples: [] as Array<{ isLoaded: boolean } | null>, multisampleFiles: [], midiNoteMapping: {} },
  dispatch: vi.fn((action: { type: string; payload?: unknown }) => {
    if (action.type === 'SET_TAB') studio.state.currentTab = action.payload as string;
  }),
}));

vi.mock('../../context/AppContext', () => ({ useAppContext: () => studio }));
vi.mock('../../components/common/MainTabs', () => ({ MainTabs: ({ recorderRequest }: { recorderRequest?: unknown }) => <div data-testid="main-tabs" data-recorder-request={JSON.stringify(recorderRequest ?? null)} /> }));
vi.mock('../../components/common/ProjectToolbar', () => ({ ProjectToolbar: () => null }));

describe('StudioShell presentation landmarks', () => {
  beforeEach(() => {
    studio.state.currentTab = 'drum';
    studio.state.drumSamples = [];
    window.history.replaceState(null, '', '#/studio/overview');
    vi.stubGlobal('scrollTo', vi.fn());
  });

  it('renders compact primary and tool navigation in the application header', () => {
    render(<StudioShell />);

    expect(screen.getByRole('banner', { name: 'Studio navigation' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Workspace' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Tools' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(screen.getByText('Unofficial preset studio')).toBeInTheDocument();
    expect(document.querySelectorAll('.studio-shell-brand')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Devices' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'What are you working on?' })).toBeInTheDocument();
    expect(document.querySelectorAll('[data-start-diagram]').length).toBe(0);

    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Setup guide: multisample a synth' }));

    expect(window.location.hash).toBe('#/studio/create');
    expect(screen.getByRole('heading', { name: 'Where is your synth?' })).toBeInTheDocument();
    expect(document.querySelectorAll('[data-launch-diagram]').length).toBe(0);
  });

  it('renders one launch surface with four diagrammed modules, External gear and secondary shortcuts', () => {
    render(<StudioShell />);

    const launch = screen.getByRole('region', { name: 'What are you working on?' });
    const modules = within(launch).getAllByRole('article');
    expect(modules.map(module => within(module).getByRole('heading', { level: 2 }).textContent)).toEqual(['Multisample a synth', 'Sample a sound', 'Build a drum kit', 'Record OP-XY tracks']);
    expect(modules.map(module => module.querySelector('[data-launch-diagram]')?.getAttribute('data-launch-diagram'))).toEqual(['note-range', 'capture', 'pad-map', 'tracks']);
    expect(within(launch).getByRole('img', { name: 'Note range diagram: 24 zones across the keyboard, 0 loaded' })).toBeInTheDocument();
    expect(within(launch).getByRole('img', { name: 'Drum kit illustration: bass drum, snare and percussion on six colorful pads' })).toBeInTheDocument();
    expect(launch.querySelectorAll('[data-pad-illustration]')).toHaveLength(6);
    expect(launch.querySelectorAll('[data-percussion]')).toHaveLength(6);
    expect(launch.querySelector('[data-percussion="Bass drum"]')).toBeInTheDocument();
    expect(launch.querySelector('[data-percussion="Snare"]')).toBeInTheDocument();
    expect(new Set(Array.from(launch.querySelectorAll('[data-art-color]'), tile => tile.getAttribute('data-art-color'))).size).toBe(5);
    expect(launch.querySelector('[data-launch-diagram="pad-map"] text')).toBeNull();
    expect(launch.querySelectorAll('[data-zone]')).toHaveLength(24);
    expect(modules.map(module => within(module).getAllByRole('button').map(button => button.getAttribute('aria-label') ?? button.textContent))).toEqual([
      ['Setup guide: multisample a synth', 'Open capture →'],
      ['Setup guide: sample a sound', 'Open sampler →'],
      ['Setup guide: build a drum kit', 'Open kit →'],
      ['Record OP-XY tracks'],
    ]);
    expect(within(launch).getByRole('button', { name: 'External gear Open devices' })).toBeInTheDocument();
    expect(within(launch).getByRole('button', { name: 'Open library Browse saved instruments' })).toBeInTheDocument();
    expect(within(launch).getByRole('button', { name: 'Back up or transfer Keep an editable project copy' })).toBeInTheDocument();
  });

  it('opens the drum editor directly from Open kit, without a setup step', async () => {
    const { rerender } = render(<StudioShell />);
    fireEvent.click(screen.getByRole('button', { name: 'Open kit' }));
    rerender(<StudioShell />);

    expect(window.location.hash).toBe('#/studio/drum');
    expect(screen.getByRole('heading', { level: 1, name: 'Drum kit editor' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Build your kit' })).not.toBeInTheDocument();
    expect(JSON.parse(screen.getByTestId('main-tabs').getAttribute('data-recorder-request') ?? 'null')).toBeNull();
  });

  it.each([
    ['Open capture', true],
    ['Open sampler', false],
  ])('%s opens the multisample editor with the matching recorder request', (name, guided) => {
    render(<StudioShell />);
    fireEvent.click(screen.getByRole('button', { name }));

    expect(window.location.hash).toBe('#/studio/multisample');
    expect(JSON.parse(screen.getByTestId('main-tabs').getAttribute('data-recorder-request') ?? 'null')).toMatchObject({ tab: 'multisample', guided, source: 'hardware' });
  });

  it('keeps the optional setup guidance one step away from each launch module', () => {
    render(<StudioShell />);
    fireEvent.click(screen.getByRole('button', { name: 'Setup guide: build a drum kit' }));

    expect(window.location.hash).toBe('#/studio/create');
    expect(screen.getByRole('heading', { level: 1, name: 'Build your kit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open editor and Record takes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open editor to import audio' })).toBeInTheDocument();
  });

  it('routes External gear to Devices and the secondary shortcuts to Library and Transfer', () => {
    render(<StudioShell />);
    fireEvent.click(screen.getByRole('button', { name: 'External gear Open devices' }));
    expect(window.location.hash).toBe('#/studio/devices');

    fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back up or transfer Keep an editable project copy' }));
    expect(window.location.hash).toBe('#/studio/transfer');
    expect(screen.getByRole('heading', { level: 1, name: 'Back up or transfer' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open library Browse saved instruments' }));
    expect(window.location.hash).toBe('#/studio/library');
  });

  it.each([
    ['drum', 'Drum kit editor'],
    ['multisample', 'Multisample editor'],
  ])('gives the %s editor a level-one heading and moves focus to it on direct navigation', async (tab, heading) => {
    window.history.replaceState(null, '', `#/studio/${tab}`);
    studio.state.currentTab = tab;
    render(<StudioShell />);

    const title = screen.getByRole('heading', { level: 1, name: heading });
    await waitFor(() => expect(title).toHaveFocus());
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('leaves the Library to supply its own single level-one heading', () => {
    studio.state.currentTab = 'library';
    window.history.replaceState(null, '', '#/studio/library');
    render(<StudioShell />);

    expect(screen.getByTestId('main-tabs')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  it('counts only the 24 pads, not unassigned tray sounds, in the overview', () => {
    // 24 loaded pads plus two loaded unassigned tray sounds at indices 24 and 25.
    studio.state.drumSamples = Array.from({ length: 26 }, () => ({ isLoaded: true }));
    render(<StudioShell />);

    expect(screen.getByText('24 / 24 pads loaded')).toHaveAttribute('data-state', 'loaded');

  });

  it('includes the last actual slot in the simplified overview', () => {
    studio.state.drumSamples = Array.from({ length: 24 }, (_, index) => ({ isLoaded: index === 23 }));
    render(<StudioShell />);

    expect(screen.getByText('1 / 24 pads loaded')).toBeInTheDocument();

  });

  it('names the editor that Transfer actions actually open', () => {
    studio.state.currentTab = 'library';
    window.history.replaceState(null, '', '#/studio/transfer');
    const { unmount } = render(<StudioShell />);

    expect(screen.getByRole('button', { name: 'Open drum kit editor (Project menu)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open drum kit editor (Export OP-XY)' })).toBeInTheDocument();
    unmount();

    studio.state.currentTab = 'multisample';
    render(<StudioShell />);
    expect(screen.getByRole('button', { name: 'Open multisample editor (Project menu)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open multisample editor (Export OP-XY)' })).toBeInTheDocument();
  });
});
