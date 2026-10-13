import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationSystem } from '../../components/common/NotificationSystem';
import { FeedbackPage } from '../../components/common/FeedbackPage';
import { DonatePage } from '../../components/common/DonatePage';
import { PatchSizeIndicator } from '../../components/common/PatchSizeIndicator';
import { LibraryFilters } from '../../components/library/LibraryFilters';
import { LibraryTableContent } from '../../components/library/LibraryTableContent';
import { LibraryPage } from '../../components/library/LibraryPage';
import { indexedDB, type PresetSummary } from '../../utils/indexedDB';

const app = vi.hoisted(() => ({
  dispatch: vi.fn(),
  state: {
    currentTab: 'library',
    drumSamples: [],
    multisampleFiles: [],
    drumSettings: { sampleRate: 0, bitDepth: 0, channels: 0 },
    multisampleSettings: { sampleRate: 0, bitDepth: 0, channels: 0 },
    notifications: [],
  },
}));

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => ({ state: app.state, dispatch: app.dispatch }),
}));

vi.mock('../../utils/indexedDB', () => ({
  indexedDB: {
    getPresetSummaries: vi.fn(),
    getLibraryCollections: vi.fn(),
    getPreset: vi.fn(),
    updatePresetMetadata: vi.fn(),
    createLibraryCollection: vi.fn(),
    changeLibraryCollection: vi.fn(),
    deleteLibraryCollection: vi.fn(),
    deletePresetFromLibrary: vi.fn(),
    deletePresetsFromLibrary: vi.fn(),
  },
  STORES: { PRESETS: 'presets', SESSIONS: 'sessions', SAMPLES: 'samples', METADATA: 'metadata' },
}));

const summary = (overrides: Partial<PresetSummary> = {}): PresetSummary => ({
  id: 'preset-1',
  name: 'Drum Kit 1',
  type: 'drum',
  createdAt: 1,
  updatedAt: 1,
  isFavorite: false,
  sampleCount: 1,
  hasPreview: false,
  ...overrides,
} as PresetSummary);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('NotificationSystem persistence', () => {
  it('keeps an error until it is dismissed and announces it assertively', () => {
    vi.useFakeTimers();
    const dismiss = vi.fn();
    render(<NotificationSystem notifications={[{ id: 'e', type: 'error', title: 'Load failed', message: 'Could not load this preset.' }]} onDismiss={dismiss} />);

    act(() => { vi.advanceTimersByTime(60_000); });
    expect(dismiss).not.toHaveBeenCalled();
    expect(screen.getByText('Could not load this preset.').closest('[data-notification-type]')).toHaveAttribute('aria-live', 'assertive');
    expect(screen.getByRole('region', { name: 'Notifications' })).toHaveAttribute('aria-live', 'polite');

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Load failed notification' }));
    expect(dismiss).toHaveBeenCalledWith('e');
  });

  it('still honors an explicit duration on an error and the default on other types', () => {
    vi.useFakeTimers();
    const dismiss = vi.fn();
    render(<NotificationSystem notifications={[
      { id: 'timed-error', type: 'error', title: 'Timed', message: 'Timed error', duration: 1000 },
      { id: 'saved', type: 'success', title: 'Saved', message: 'Saved to library' },
    ]} onDismiss={dismiss} />);

    act(() => { vi.advanceTimersByTime(1000); });
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(dismiss).toHaveBeenCalledWith('timed-error');
    act(() => { vi.advanceTimersByTime(4000); });
    expect(dismiss).toHaveBeenCalledWith('saved');
    expect(screen.getByText('Saved to library').closest('[data-notification-type]')).not.toHaveAttribute('aria-live');
  });
});

describe('Support pages', () => {
  it('gives Feedback a page heading, a way back, and an outside-service disclosure', () => {
    render(<FeedbackPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Feedback' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to the studio/ })).toHaveAttribute('href', '#/studio/overview');
    expect(screen.getByText(/hosted by Google Forms/)).toBeInTheDocument();
  });

  it('gives Support a page heading, a way back, and names the outside services', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<DonatePage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Support the project' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Latest posts' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to the studio/ })).toHaveAttribute('href', '#/studio/overview');
    expect(screen.getByText(/public relay service/)).toBeInTheDocument();
    expect(screen.getByText(/handled there under that service's terms/)).toBeInTheDocument();
  });
});

describe('PatchSizeIndicator guidance', () => {
  it('shows the size guidance as text and ties it to the meter', () => {
    render(<PatchSizeIndicator type="drum" />);
    const guidance = screen.getByText(/64 MB allocated to samples across all presets/);
    expect(guidance).toHaveTextContent('8 MB limit per preset is recommended');
    expect(screen.getByRole('progressbar', { name: 'Preset size estimate' })).toHaveAttribute('aria-describedby', guidance.id);
    expect(document.querySelector('[title]')).toBeNull();
  });
});

describe('Library rows and filters', () => {
  const rowProps = {
    selectedPresets: new Set<string>(),
    onToggleSelection: vi.fn(),
    onSelectAll: vi.fn(),
    onClearSelection: vi.fn(),
    onToggleFavorite: vi.fn(),
    onEditMetadata: vi.fn(),
    onPreviewPreset: vi.fn(),
    onStopPreview: vi.fn(),
    previewingId: null,
    onDeletePreset: vi.fn(),
    sortBy: 'date' as const,
    sortOrder: 'desc' as const,
    formatDate: () => 'today',
  };

  it.each([[false, 'table'], [true, 'cards']] as const)('names visible Load and Download actions after the preset (mobile=%s, %s)', (...[isMobile]) => {
    const onLoadPreset = vi.fn(), onDownloadPreset = vi.fn(), onSort = vi.fn();
    const preset = summary();
    render(<LibraryTableContent {...rowProps} presets={[preset, summary({ id: 'preset-2', name: 'Keys', type: 'multisample', sampleCount: 12 })]} isMobile={isMobile} onLoadPreset={onLoadPreset} onDownloadPreset={onDownloadPreset} onSort={onSort} />);

    const load = screen.getByRole('button', { name: 'Load Drum Kit 1' });
    const download = screen.getByRole('button', { name: 'Download Drum Kit 1' });
    expect(load).toHaveTextContent(/^Load$/);
    expect(download).toHaveTextContent(/^Download$/);
    fireEvent.click(load);
    fireEvent.click(download);
    expect(onLoadPreset).toHaveBeenCalledWith(preset);
    expect(onDownloadPreset).toHaveBeenCalledWith(preset);
    expect(screen.getByRole('button', { name: 'Add Drum Kit 1 to favorites' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Keys' })).toBeInTheDocument();
    expect(screen.getByText(/1 sample(?!s)/)).toBeInTheDocument();
    expect(screen.getByText(/12 samples/)).toBeInTheDocument();
  });

  it('sorts by name from a keyboard-reachable column button', () => {
    const onSort = vi.fn();
    render(<LibraryTableContent {...rowProps} presets={[summary()]} isMobile={false} onLoadPreset={vi.fn()} onDownloadPreset={vi.fn()} onSort={onSort} sortBy="name" sortOrder="asc" />);
    fireEvent.click(within(screen.getByRole('columnheader', { name: /Name/ })).getByRole('button'));
    expect(onSort).toHaveBeenCalledWith('name');
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'ascending');
  });

  it('keeps sort option labels short and offers manual order only inside a collection', () => {
    const props = {
      searchTerm: '', onSearchChange: vi.fn(), filterType: 'all' as const, onFilterTypeChange: vi.fn(),
      filterFavorites: false, onFilterFavoritesChange: vi.fn(), sortBy: 'date' as const, onSortChange: vi.fn(),
      sortOrder: 'desc' as const, onToggleSortOrder: vi.fn(),
    };
    const { rerender } = render(<LibraryFilters {...props} inCollection={false} />);
    const labels = () => within(screen.getByRole('combobox', { name: 'Sort presets' })).getAllByRole('option').map(option => option.textContent);
    expect(labels()).toEqual(['Updated', 'Name', 'Type']);
    rerender(<LibraryFilters {...props} inCollection />);
    expect(labels()).toEqual(['Manual order', 'Updated', 'Name', 'Type']);
  });
});

describe('Library empty states', () => {
  const db = vi.mocked(indexedDB);
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1280 });
    app.dispatch.mockClear();
    db.getPresetSummaries.mockResolvedValue([summary()]);
    db.getLibraryCollections.mockResolvedValue([]);
  });

  it('offers to open an editor through the workspace event when nothing is saved', async () => {
    db.getPresetSummaries.mockResolvedValue([]);
    const opened = vi.fn();
    const listener = (event: Event) => opened((event as CustomEvent<string>).detail);
    window.addEventListener('opstudio-open-workspace', listener);
    try {
      render(<LibraryPage />);
      expect(await screen.findByText('No saved presets yet')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: '0 presets' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Build a drum kit' }));
      fireEvent.click(screen.getByRole('button', { name: 'Make a multisample instrument' }));
      expect(opened.mock.calls).toEqual([['drum'], ['multisample']]);
    } finally {
      window.removeEventListener('opstudio-open-workspace', listener);
    }
  });

  it('separates a search with no results from an empty library and clears it in place', async () => {
    render(<LibraryPage />);
    expect(await screen.findByText('Drum Kit 1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '1 preset' })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search presets, descriptions, and tags' }), { target: { value: 'zzz' } });
    expect(screen.getByText('No presets match your search')).toBeInTheDocument();
    expect(screen.queryByText('No saved presets yet')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Build a drum kit' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear search and filters' }));
    expect(screen.getByText('Drum Kit 1')).toBeInTheDocument();
  });

  it('explains an empty collection and leads back to all presets', async () => {
    db.getLibraryCollections.mockResolvedValue([{ key: 'library-collection:evening', id: 'evening', name: 'Evening set', presetIds: [], createdAt: 1, updatedAt: 1 }]);
    render(<LibraryPage />);
    expect(await screen.findByText('Drum Kit 1')).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: 'Collection Evening set' }));
    expect(screen.getByText('This collection is empty')).toBeInTheDocument();
    expect(screen.queryByText('No presets match your search')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Browse all presets' }));
    expect(screen.getByText('Drum Kit 1')).toBeInTheDocument();
  });
});
