import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { LibraryPage } from '../../components/library/LibraryPage';
import { indexedDB } from '../../utils/indexedDB';
import { sessionStorageIndexedDB } from '../../utils/sessionStorageIndexedDB';
import { generateDrumPatch, generateMultisamplePatch, downloadBlob } from '../../utils/patchGeneration';
import type { LibraryPreset } from '../../utils/libraryUtils';
import { AUDIO_CONSTANTS } from '../../utils/constants';
import {encodeStoredAudio} from '../../utils/storedAudio';
import type {PresetSummary} from '../../utils/indexedDB';
import * as batchExports from '../../utils/libraryBatchExport';
import {projectEditIdentityMatches} from '../../utils/projectEditIdentity';

const stableDispatch = vi.hoisted(() => vi.fn());
let sessionInProgress = false;

// Mock dependencies
vi.mock('../../utils/indexedDB', () => ({
  indexedDB: {
    add: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    updatePresetMetadata: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(),
    getPresetSummaries: vi.fn(),
    getByIndex: vi.fn(),
    getLibraryCollections: vi.fn(),
    createLibraryCollection: vi.fn(),
    changeLibraryCollection: vi.fn(),
    deleteLibraryCollection: vi.fn(),
    deletePresetFromLibrary: vi.fn(),
    deletePresetsFromLibrary: vi.fn(),
    getPreset: vi.fn(),
  },
  STORES: {
    PRESETS: 'presets',
    SESSIONS: 'sessions',
    SAMPLES: 'samples',
    METADATA: 'metadata',
  }
}));
vi.mock('../../utils/projectEditIdentity',()=>({captureProjectEditIdentity:vi.fn(()=>({})),projectEditIdentityMatches:vi.fn(()=>true)}));

vi.mock('../../utils/sessionStorageIndexedDB', () => ({
  sessionStorageIndexedDB: {
    markSessionAsSavedToLibrary: vi.fn(),
    resetSavedToLibraryFlag: vi.fn(),
  }
}));

vi.mock('../../utils/patchGeneration', () => ({
  generateDrumPatch: vi.fn(),
  generateMultisamplePatch: vi.fn(),
  downloadBlob: vi.fn(),
}));

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => ({
    state: {
      currentTab: 'library',
      drumSettings: {
        sampleRate: 44100,
        bitDepth: 16,
        channels: 2,
        presetName: 'Test Drum Kit',
        normalize: false,
        normalizeLevel: AUDIO_CONSTANTS.DRUM_NORMALIZATION_LEVEL,
        presetSettings: {
          playmode: 'poly',
          transpose: 0,
          velocity: 20,
          volume: 69,
          width: 0
        },
        renameFiles: false,
        filenameSeparator: ' '
      },
      multisampleSettings: {
        sampleRate: 44100,
        bitDepth: 16,
        channels: 2,
        presetName: 'Test Multisample',
        normalize: false,
        normalizeLevel: AUDIO_CONSTANTS.MULTISAMPLE_NORMALIZATION_LEVEL,
        cutAtLoopEnd: false,
        gain: 0,
        loopEnabled: true,
        loopOnRelease: true,
        renameFiles: false,
        filenameSeparator: ' '
      },
      drumSamples: sessionInProgress ? [{ isLoaded: true }] : [],
      multisampleFiles: [],
      selectedMultisample: null,
      isDrumKeyboardPinned: false,
      isMultisampleKeyboardPinned: false,
      isLoading: false,
      error: null,
      notifications: [],
      importedDrumPreset: null,
      importedMultisamplePreset: null,
      isSessionRestorationModalOpen: false,
      sessionInfo: null
    },
    dispatch: stableDispatch,
  }),
}));

// Mock AudioContext
const mockAudioContext = {
  decodeAudioData: vi.fn(() => Promise.resolve({})),
  sampleRate: 44100,
};

// Mock window.AudioContext
Object.defineProperty(window, 'AudioContext', {
  value: vi.fn(() => mockAudioContext),
  writable: true,
});

Object.defineProperty(window, 'webkitAudioContext', {
  value: vi.fn(() => mockAudioContext),
  writable: true,
});

// Mock window.innerWidth
Object.defineProperty(window, 'innerWidth', {
  value: 1280,
  writable: true,
});

describe('LibraryPage', () => {
  const mockIndexedDB = vi.mocked(indexedDB);
  const mockSessionStorage = vi.mocked(sessionStorageIndexedDB);
  const mockGenerateDrumPatch = vi.mocked(generateDrumPatch);
  const mockGenerateMultisamplePatch = vi.mocked(generateMultisamplePatch);
  const mockDownloadBlob = vi.mocked(downloadBlob);

  const mockPresets: Array<LibraryPreset & PresetSummary> = [
    {
      id: 'preset-1',
      name: 'Drum Kit 1',
      type: 'drum',
      data: {
        drumSettings: {},
        drumSamples: [],
        multisampleSettings: {},
        multisampleFiles: [],
        importedDrumPreset: null,
        importedMultisamplePreset: null,
      },
      createdAt: Date.now() - 86400000, // 1 day ago
      updatedAt: Date.now() - 86400000,
      isFavorite: false,
      sampleCount: 8,
      hasPreview: false,
    },
    {
      id: 'preset-2',
      name: 'Multisample 1',
      type: 'multisample',
      data: {
        drumSettings: {},
        drumSamples: [],
        multisampleSettings: {},
        multisampleFiles: [],
        importedDrumPreset: null,
        importedMultisamplePreset: null,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isFavorite: true,
      sampleCount: 12,
      hasPreview: false,
    },
    {
      id: 'preset-3',
      name: 'Drum Kit 2',
      type: 'drum',
      data: {
        drumSettings: {},
        drumSamples: [],
        multisampleSettings: {},
        multisampleFiles: [],
        importedDrumPreset: null,
        importedMultisamplePreset: null,
      },
      createdAt: Date.now() - 172800000, // 2 days ago
      updatedAt: Date.now() - 172800000,
      isFavorite: false,
      sampleCount: 16,
      hasPreview: false,
    },
  ];

  beforeEach(() => {
    window.innerWidth=1280;
    vi.clearAllMocks();
    sessionInProgress = false;
    mockIndexedDB.getPresetSummaries.mockResolvedValue(mockPresets);
    mockIndexedDB.getLibraryCollections.mockResolvedValue([]);
    mockIndexedDB.getPreset.mockImplementation(async(id:string)=>mockPresets.find(preset=>preset.id===id)??null);
    mockSessionStorage.markSessionAsSavedToLibrary.mockResolvedValue(undefined);
    mockGenerateDrumPatch.mockResolvedValue(new Blob());
    mockGenerateMultisamplePatch.mockResolvedValue(new Blob());
    mockDownloadBlob.mockImplementation(() => {});
  });

  afterEach(() => {
    window.innerWidth=1280;
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('switches to full-width cards when resized to a medium viewport',async()=>{
    render(<LibraryPage/>);await screen.findByText('Drum Kit 1');
    expect(screen.getByRole('table')).toBeInTheDocument();
    act(()=>{window.innerWidth=820;window.dispatchEvent(new Event('resize'));});
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Browse collections')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Preview first sample of Drum Kit 1'})).toBeInTheDocument();
  });

  describe('Loading Presets', () => {
    it('does not start a redundant delayed read after the initial library load', async () => {
      vi.useFakeTimers();
      render(<LibraryPage />);

      await act(async () => {
        await Promise.resolve();
        vi.advanceTimersByTime(100);
        await Promise.resolve();
      });

      expect(mockIndexedDB.getPresetSummaries).toHaveBeenCalledTimes(1);
      expect(mockIndexedDB.getAll).not.toHaveBeenCalled();
    });

    it('keeps the newest result when overlapping library reads finish out of order', async () => {
      let resolveInitial!: (value: PresetSummary[]) => void;
      let resolveRefresh!: (value: PresetSummary[]) => void;
      const initialRead = new Promise<PresetSummary[]>((resolve) => { resolveInitial = resolve; });
      const refreshRead = new Promise<PresetSummary[]>((resolve) => { resolveRefresh = resolve; });
      mockIndexedDB.getPresetSummaries
        .mockReturnValueOnce(initialRead)
        .mockReturnValueOnce(refreshRead);

      render(<LibraryPage />);
      act(() => window.dispatchEvent(new Event('library-refresh')));

      const newestPreset = { ...mockPresets[0], id: 'newest', name: 'Newest preset' };
      await act(async () => resolveRefresh([newestPreset]));
      expect(await screen.findByText('Newest preset')).toBeInTheDocument();

      await act(async () => resolveInitial(mockPresets));
      expect(screen.getByText('Newest preset')).toBeInTheDocument();
      expect(screen.queryByText('Drum Kit 1')).not.toBeInTheDocument();
    });

    it('keeps the selected Load confirmation owned through a background refresh', async () => {
      sessionInProgress = true;
      let resolveRefresh!: (value: PresetSummary[]) => void;
      mockIndexedDB.getPresetSummaries
        .mockResolvedValueOnce(mockPresets)
        .mockReturnValueOnce(new Promise(resolve => { resolveRefresh = resolve; }));
      render(<LibraryPage />);
      await screen.findByText('Drum Kit 1');

      const row=screen.getByText('Drum Kit 1').closest('tr');
      if(!row)throw new Error('Drum Kit 1 row was not rendered');
      fireEvent.click(within(row).getByRole('button',{name:'load preset'}));
      expect(screen.getByRole('dialog')).toHaveTextContent('Drum Kit 1');
      act(() => window.dispatchEvent(new Event('library-refresh')));
      expect(screen.getByRole('dialog')).toHaveTextContent('Drum Kit 1');

      await act(async()=>resolveRefresh([{...mockPresets[1],id:'replacement',name:'Refreshed preset'}]));
      expect(screen.getByRole('dialog')).toHaveTextContent('Drum Kit 1');
      expect(screen.getByText('Refreshed preset')).toBeInTheDocument();

      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'ok'}));
      await waitFor(()=>expect(stableDispatch).toHaveBeenCalledWith(expect.objectContaining({
        type:'RESTORE_LIBRARY',payload:expect.objectContaining({mode:'drum'}),
      })));
    });

    it('rejects a corrupt saved preset type without restoring or navigating',async()=>{
      mockIndexedDB.getPreset.mockResolvedValueOnce({...mockPresets[0],type:'unknown'} as unknown as LibraryPreset);
      const navigate=vi.fn();window.addEventListener('opstudio-open-workspace',navigate);
      try {
        render(<LibraryPage/>);await screen.findByText('Drum Kit 1');
        fireEvent.click(screen.getAllByRole('button',{name:'load preset'})[0]);
        await waitFor(()=>expect(stableDispatch).toHaveBeenCalledWith(expect.objectContaining({type:'ADD_NOTIFICATION',payload:expect.objectContaining({type:'error'})})));
        expect(stableDispatch).not.toHaveBeenCalledWith(expect.objectContaining({type:'RESTORE_LIBRARY'}));
        expect(navigate).not.toHaveBeenCalled();
      } finally {window.removeEventListener('opstudio-open-workspace',navigate);}
    });

    it('does not apply decoded preset data after the current project changes',async()=>{
      vi.mocked(projectEditIdentityMatches).mockReturnValueOnce(false);
      render(<LibraryPage/>);
      await screen.findByText('Drum Kit 1');
      fireEvent.click(screen.getAllByRole('button',{name:'load preset'})[0]);
      await waitFor(()=>expect(stableDispatch).toHaveBeenCalledWith(expect.objectContaining({
        type:'ADD_NOTIFICATION',payload:expect.objectContaining({type:'error',message:'failed to load preset'}),
      })));
      expect(stableDispatch).not.toHaveBeenCalledWith(expect.objectContaining({type:'RESTORE_LIBRARY'}));
    });

    it('should load presets successfully on mount', async () => {
      render(<LibraryPage />);

      // First, wait for the loading to complete
      await waitFor(() => {
        expect(screen.queryByText('loading...')).not.toBeInTheDocument();
      });

      // Then check that presets are loaded
      await waitFor(() => {
        expect(screen.getByText('Drum Kit 1')).toBeInTheDocument();
        expect(screen.getByText('Multisample 1')).toBeInTheDocument();
        expect(screen.getByText('Drum Kit 2')).toBeInTheDocument();
      });
    });

    it('should show loading state initially', () => {
      render(<LibraryPage />);

      expect(screen.getByText('loading...')).toBeInTheDocument();
    });

    it('reports a load failure instead of presenting an empty library, and retries on request', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockIndexedDB.getPresetSummaries.mockRejectedValueOnce(new Error('Database error'));

      render(<LibraryPage />);

      expect(await screen.findByRole('alert')).toHaveTextContent('Could not load saved presets');
      expect(screen.queryByText('No presets found')).not.toBeInTheDocument();
      expect(screen.queryByText('Save a drum or multisample preset to begin your library.')).not.toBeInTheDocument();
      expect(screen.getByRole('combobox',{name:'Sort presets'})).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Retry loading library' }));
      expect(await screen.findByText('Drum Kit 1')).toBeInTheDocument();
      expect(screen.queryByText(/Could not load saved presets/)).not.toBeInTheDocument();
    });
  });

  describe('Filtering and Sorting', () => {
    beforeEach(async () => {
      render(<LibraryPage />);
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('loading...')).not.toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByText('Drum Kit 1')).toBeInTheDocument();
      });
    });

    it('should filter presets by search term', async () => {
      const searchInput = screen.getByPlaceholderText('Search presets or tags');
      fireEvent.change(searchInput, { target: { value: 'Drum' } });

      await waitFor(() => {
        expect(screen.getByText('Drum Kit 1')).toBeInTheDocument();
        expect(screen.getByText('Drum Kit 2')).toBeInTheDocument();
        expect(screen.queryByText('Multisample 1')).not.toBeInTheDocument();
      });
    });

    it('edits local description and tags and makes the tag searchable without restoring the instrument',async()=>{
      const original=mockPresets[0];
      const saved={...original,description:'Bright analog percussion',tags:['warm','analog'],updatedAt:Date.now()};
      mockIndexedDB.updatePresetMetadata.mockResolvedValue(saved);
      fireEvent.click(screen.getByRole('button',{name:'Edit details for Drum Kit 1'}));
      const dialog=screen.getByRole('dialog',{name:'Edit details for Drum Kit 1'});
      fireEvent.change(within(dialog).getByRole('textbox',{name:'Preset description'}),{target:{value:'Bright analog percussion'}});
      fireEvent.change(within(dialog).getByRole('textbox',{name:'Preset tags'}),{target:{value:'warm, analog, WARM'}});
      fireEvent.click(within(dialog).getByRole('button',{name:'Save details'}));
      await waitFor(()=>expect(mockIndexedDB.updatePresetMetadata).toHaveBeenCalledWith('preset-1',{description:'Bright analog percussion',tags:['warm','analog']}));
      expect(screen.queryByRole('dialog',{name:'Edit details for Drum Kit 1'})).not.toBeInTheDocument();
      fireEvent.change(screen.getByRole('searchbox',{name:'Search presets, descriptions, and tags'}),{target:{value:'analog'}});
      expect(screen.getByText('Drum Kit 1')).toBeInTheDocument();
      expect(screen.queryByText('Multisample 1')).not.toBeInTheDocument();
      expect(stableDispatch).not.toHaveBeenCalledWith(expect.objectContaining({type:'RESTORE_LIBRARY'}));
    });

    it('should filter presets by type', async () => {
      const typeSelect = screen.getByRole('combobox',{name:'Preset type'});
      fireEvent.change(typeSelect, { target: { value: 'drum' } });

      await waitFor(() => {
        expect(screen.getByText('Drum Kit 1')).toBeInTheDocument();
        expect(screen.getByText('Drum Kit 2')).toBeInTheDocument();
        expect(screen.queryByText('Multisample 1')).not.toBeInTheDocument();
      });
    });

    it('should filter presets by favorites', async () => {
      const favoritesCheckbox = screen.getByLabelText('Favorites only');
      fireEvent.click(favoritesCheckbox);

      await waitFor(() => {
        expect(screen.getByText('Multisample 1')).toBeInTheDocument();
        expect(screen.queryByText('Drum Kit 1')).not.toBeInTheDocument();
        expect(screen.queryByText('Drum Kit 2')).not.toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button',{name:/All presets/}));
      expect(favoritesCheckbox).not.toBeChecked();
      expect(screen.getByText('Drum Kit 1')).toBeInTheDocument();
    });

    it('should sort presets by name', async () => {
      // Wait for loading to complete and table to be rendered
      await waitFor(() => {
        expect(screen.queryByText('loading...')).not.toBeInTheDocument();
      });

      // Wait for the table headers to be rendered
      await waitFor(() => {
        expect(screen.getByText('name')).toBeInTheDocument();
      });

      const nameHeader = screen.getByText('name');
      fireEvent.click(nameHeader);

      await waitFor(() => {
        const presetNames = within(screen.getByRole('table')).getAllByText(/^(Drum Kit [12]|Multisample 1)$/);
        expect(presetNames[0]).toHaveTextContent('Drum Kit 1');
        expect(presetNames[1]).toHaveTextContent('Drum Kit 2');
        expect(presetNames[2]).toHaveTextContent('Multisample 1');
      });
    });

    it('should sort presets by type', async () => {
      fireEvent.change(screen.getByRole('combobox',{name:'Sort presets'}),{target:{value:'type'}});

      await waitFor(() => {
        const presetNames = within(screen.getByRole('table')).getAllByText(/^(Drum Kit [12]|Multisample 1)$/);
        expect(presetNames[0]).toHaveTextContent('Drum Kit 1');
        expect(presetNames[1]).toHaveTextContent('Drum Kit 2');
        expect(presetNames[2]).toHaveTextContent('Multisample 1');
      });
    });

    it('should sort presets by date', async () => {
      fireEvent.click(screen.getByRole('button',{name:'Sort ascending'}));

      await waitFor(() => {
        const presetNames = within(screen.getByRole('table')).getAllByText(/^(Drum Kit [12]|Multisample 1)$/);
        expect(presetNames.map(element=>element.textContent)).toEqual([
          'Drum Kit 2','Drum Kit 1','Multisample 1',
        ]);
      });
    });
  });

  describe('Pagination', () => {
    beforeEach(async () => {
      // Create more presets to test pagination
      const manyPresets = Array.from({ length: 25 }, (_, i) => ({
        ...mockPresets[0],
        id: `preset-${i + 1}`,
        name: `Preset ${i + 1}`,
      }));
      mockIndexedDB.getPresetSummaries.mockResolvedValue(manyPresets);

      render(<LibraryPage />);
      await waitFor(() => {
        expect(screen.queryByText('loading...')).not.toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByText('Preset 1')).toBeInTheDocument();
      });
    });

    it('mobile pagination advances ten summaries and returns without losing items',async()=>{
      const width=window.innerWidth;
      try{Object.defineProperty(window,'innerWidth',{configurable:true,value:390});fireEvent(window,new Event('resize'));await screen.findByText('Preset 10');expect(screen.queryByText('Preset 11')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Next'}));await screen.findByText('Preset 11');expect(screen.queryByText('Preset 1')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Previous'}));await screen.findByText('Preset 1');}
      finally{Object.defineProperty(window,'innerWidth',{configurable:true,value:width});fireEvent(window,new Event('resize'));}
    });

    it('should navigate between pages', async () => {
      // Click next page button
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Preset 16')).toBeInTheDocument();
        expect(screen.queryByText('Preset 1')).not.toBeInTheDocument();
      });

      // Click previous page button
      const previousButton = screen.getByText('Previous');
      fireEvent.click(previousButton);

      await waitFor(() => {
        expect(screen.getByText('Preset 1')).toBeInTheDocument();
        expect(screen.queryByText('Preset 16')).not.toBeInTheDocument();
      });
    });

    it('should disable navigation buttons appropriately', async () => {
      const previousButton = screen.getByText('Previous');
      const nextButton = screen.getByText('Next');

      expect(previousButton).toBeDisabled();
      expect(nextButton).not.toBeDisabled();

      // Go to last page
      fireEvent.click(nextButton);
      await waitFor(() => {
        expect(screen.getByText('Preset 25')).toBeInTheDocument();
      });

      expect(previousButton).not.toBeDisabled();
      expect(nextButton).toBeDisabled();
    });

    it('returns to the first valid page when filters narrow results',async()=>{
      fireEvent.click(screen.getByRole('button',{name:'Next'}));
      await screen.findByText('Preset 16');
      fireEvent.change(screen.getByRole('searchbox',{name:'Search presets, descriptions, and tags'}),{target:{value:'Preset 1'}});
      expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
      expect(screen.getByText('Preset 1')).toBeInTheDocument();
      expect(screen.queryByText('Preset 25')).not.toBeInTheDocument();
    });
  });

  describe('Sample preview',()=>{
    it('plays only the first saved sample for at most three seconds and stops without loading the project',async()=>{
      const sound=new AudioBuffer({numberOfChannels:1,length:80_000,sampleRate:8_000});
      const audioBlob=encodeStoredAudio(sound);
      mockIndexedDB.getPresetSummaries.mockResolvedValue([{...mockPresets[0],name:'Preview Kit',hasPreview:true}]);
      mockIndexedDB.getPreset.mockResolvedValue({...mockPresets[0],name:'Preview Kit',data:{...mockPresets[0].data,drumSamples:[{name:'kick',originalIndex:0,isAssigned:true,audioBlob,inPoint:1,outPoint:9}]}});
      const source={buffer:null as AudioBuffer|null,onended:null as (()=>void)|null,connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn()};
      const gain={gain:{value:1},connect:vi.fn(),disconnect:vi.fn()};
      const context={state:'running',destination:{},createBufferSource:vi.fn(()=>source),createGain:vi.fn(()=>gain),resume:vi.fn(async()=>{}),close:vi.fn(async()=>{})};
      vi.stubGlobal('AudioContext',vi.fn(function MockPreviewAudioContext(){return context;}));
      render(<LibraryPage/>);await screen.findByText('Preview Kit');
      fireEvent.click(screen.getByRole('button',{name:'Preview first sample of Preview Kit'}));
      expect(await screen.findByRole('status',{name:'Library preview status'})).toHaveTextContent(/Preparing the first sample|Playing the first raw saved sample/);
      await waitFor(()=>expect(source.start).toHaveBeenCalledWith(0,1,3));
      expect(gain.gain.value).toBe(.35);
      expect(stableDispatch).not.toHaveBeenCalledWith(expect.objectContaining({type:'RESTORE_LIBRARY'}));
      fireEvent.click(screen.getByRole('button',{name:'Stop preview of Preview Kit'}));
      await waitFor(()=>expect(context.close).toHaveBeenCalledOnce());
      expect(source.stop).toHaveBeenCalledOnce();
      fireEvent.click(screen.getByRole('button',{name:'Preview first sample of Preview Kit'}));
      await waitFor(()=>expect(source.start).toHaveBeenCalledTimes(2));
      fireEvent.click(screen.getByRole('button',{name:'Stop library preview'}));
      await waitFor(()=>expect(context.close).toHaveBeenCalledTimes(2));
      fireEvent.click(screen.getByRole('button',{name:'Preview first sample of Preview Kit'}));
      await waitFor(()=>expect(source.start).toHaveBeenCalledTimes(3));
      Object.defineProperty(document,'hidden',{configurable:true,value:true});
      act(()=>document.dispatchEvent(new Event('visibilitychange')));
      await waitFor(()=>expect(context.close).toHaveBeenCalledTimes(3));
      expect(screen.queryByRole('status',{name:'Library preview status'})).not.toBeInTheDocument();
      Object.defineProperty(document,'hidden',{configurable:true,value:false});
    });

    it('does not start sound after Stop during a delayed decode',async()=>{
      const sound=new AudioBuffer({numberOfChannels:1,length:8_000,sampleRate:8_000});
      const audioBlob=encodeStoredAudio(sound),bytes=await audioBlob.arrayBuffer();
      let finishDecode!:(value:ArrayBuffer)=>void;
      vi.spyOn(audioBlob,'arrayBuffer').mockReturnValue(new Promise(resolve=>{finishDecode=resolve;}));
      mockIndexedDB.getPresetSummaries.mockResolvedValue([{...mockPresets[0],name:'Slow Kit',hasPreview:true}]);
      mockIndexedDB.getPreset.mockResolvedValue({...mockPresets[0],name:'Slow Kit',data:{...mockPresets[0].data,drumSamples:[{name:'kick',originalIndex:0,isAssigned:true,audioBlob,inPoint:0,outPoint:1}]}});
      const source={connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn()};
      const context={state:'running',destination:{},createBufferSource:vi.fn(()=>source),createGain:vi.fn(),resume:vi.fn(async()=>{}),close:vi.fn(async()=>{})};
      vi.stubGlobal('AudioContext',vi.fn(function MockPreviewAudioContext(){return context;}));
      render(<LibraryPage/>);await screen.findByText('Slow Kit');
      fireEvent.click(screen.getByRole('button',{name:'Preview first sample of Slow Kit'}));
      expect(await screen.findByRole('status',{name:'Library preview status'})).toHaveTextContent(/Preparing the first sample/);
      await screen.findByRole('button',{name:'Stop preview of Slow Kit'});
      fireEvent.click(screen.getByRole('button',{name:'Stop preview of Slow Kit'}));
      await act(async()=>finishDecode(bytes));
      expect(source.start).not.toHaveBeenCalled();expect(context.close).toHaveBeenCalledOnce();
      expect(stableDispatch).not.toHaveBeenCalledWith(expect.objectContaining({type:'RESTORE_LIBRARY'}));
    });
  });

  describe('Selection Management', () => {
    beforeEach(async () => {
      render(<LibraryPage />);
      await waitFor(() => {
        expect(screen.queryByText('loading...')).not.toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByText('Drum Kit 1')).toBeInTheDocument();
      });
    });

    it('should select and deselect individual presets', async () => {
      const checkboxes = within(screen.getByRole('table')).getAllByRole('checkbox');
      const firstPresetCheckbox = checkboxes[1]; // Skip the "select all" checkbox

      fireEvent.click(firstPresetCheckbox);
      expect(firstPresetCheckbox).toBeChecked();

      fireEvent.click(firstPresetCheckbox);
      expect(firstPresetCheckbox).not.toBeChecked();
    });

    it('should select all presets', async () => {
      const table = within(screen.getByRole('table'));
      const selectAllCheckbox = table.getAllByRole('checkbox')[0];
      fireEvent.click(selectAllCheckbox);

      const allCheckboxes = table.getAllByRole('checkbox');
      allCheckboxes.forEach(checkbox => {
        expect(checkbox).toBeChecked();
      });
    });

    it('should clear selection', async () => {
      // Select some presets
      const table = within(screen.getByRole('table'));
      const checkboxes = table.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]);
      fireEvent.click(checkboxes[2]);

      // Clear selection
      const clearButton = screen.getByText('Delete selected');
      fireEvent.click(clearButton);
      expect(screen.getByRole('dialog')).toHaveTextContent('2 selected presets');
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ok' }));

      await waitFor(() => {
        expect(mockIndexedDB.deletePresetsFromLibrary).toHaveBeenCalledWith(expect.arrayContaining(['preset-1','preset-2']));
      });

      // Checkboxes should be unchecked
      const allCheckboxes = table.getAllByRole('checkbox');
      allCheckboxes.forEach(checkbox => {
        expect(checkbox).not.toBeChecked();
      });
    });

    it('never counts or deletes selected presets that the current filters hide', async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: 'Select Drum Kit 1' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Select Multisample 1' }));
      expect(screen.getByRole('group', { name: 'Selected preset actions' })).toHaveTextContent('2 selected');

      fireEvent.change(screen.getByPlaceholderText('Search presets or tags'), { target: { value: 'Drum' } });
      await waitFor(() => expect(screen.queryByText('Multisample 1')).not.toBeInTheDocument());
      expect(screen.getByRole('group', { name: 'Selected preset actions' })).toHaveTextContent('1 selected');

      fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }));
      expect(screen.getByRole('dialog')).toHaveTextContent('1 selected presets');
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ok' }));
      await waitFor(() => expect(mockIndexedDB.deletePresetsFromLibrary).toHaveBeenCalledWith(['preset-1']));
    });
  });

  it('creates a collection and adds selected preset references without loading the instrument',async()=>{
    const collections:Array<{key:string;id:string;name:string;presetIds:string[];createdAt:number;updatedAt:number}>=[];
    mockIndexedDB.getLibraryCollections.mockImplementation(async()=>[...collections]);
    mockIndexedDB.createLibraryCollection.mockImplementation(async name=>{
      const item={key:'library-collection:evening',id:'evening',name,presetIds:[],createdAt:1,updatedAt:1};collections.push(item);return item;
    });
    mockIndexedDB.changeLibraryCollection.mockImplementation(async(id,change)=>{
      const item=collections.find(collection=>collection.id===id)!;
      if(change.type==='add')item.presetIds=[...item.presetIds,...change.presetIds];
      return item;
    });
    render(<LibraryPage/>);await screen.findByText('Drum Kit 1');
    fireEvent.click(screen.getByRole('button',{name:'New collection'}));
    const createDialog=screen.getByRole('dialog',{name:'New collection'});
    fireEvent.change(within(createDialog).getByRole('textbox',{name:'Collection name'}),{target:{value:'Evening set'}});
    fireEvent.click(within(createDialog).getByRole('button',{name:'Create collection'}));
    await waitFor(()=>expect(screen.getByRole('button',{name:'Collection Evening set'})).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button',{name:/All presets/}));
    fireEvent.click(screen.getByRole('checkbox',{name:'Select Drum Kit 1'}));
    fireEvent.click(screen.getByRole('button',{name:'Add to collection'}));
    const addDialog=screen.getByRole('dialog',{name:'Add to collection'});
    expect(within(addDialog).getByRole('combobox',{name:'Choose collection'})).toHaveValue('evening');
    fireEvent.click(within(addDialog).getByRole('button',{name:'Add to collection'}));
    await waitFor(()=>expect(mockIndexedDB.changeLibraryCollection).toHaveBeenCalledWith('evening',{type:'add',presetIds:['preset-1']}));
    expect(stableDispatch).not.toHaveBeenCalledWith(expect.objectContaining({type:'RESTORE_LIBRARY'}));
  });

  describe('Empty State', () => {
    it('should show empty state when no presets exist', async () => {
      mockIndexedDB.getPresetSummaries.mockResolvedValue([]);
      render(<LibraryPage />);

      await waitFor(() => {
        expect(screen.queryByText('loading...')).not.toBeInTheDocument();
      });

      // When no presets exist, the table is still rendered but empty
      await waitFor(() => {
        expect(screen.getByText('name')).toBeInTheDocument(); // Table header
        expect(screen.getByText('actions')).toBeInTheDocument(); // Table header
        expect(screen.getByRole('combobox',{name:'Sort presets'})).toBeInTheDocument();
      });
    });

    it('should show filtered empty state when no presets match filters', async () => {
      render(<LibraryPage />);
      await waitFor(() => {
        expect(screen.queryByText('loading...')).not.toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByText('Drum Kit 1')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search presets or tags');
      fireEvent.change(searchInput, { target: { value: 'Nonexistent' } });

      // When filtering results in no matches, the table is still rendered but empty
      await waitFor(() => {
        expect(screen.getByText('name')).toBeInTheDocument(); // Table header
        expect(screen.queryByText('Drum Kit 1')).not.toBeInTheDocument(); // No presets shown
      });
    });
  });

  it('reports a library read failure without claiming the preset was deleted',async()=>{
    mockIndexedDB.getPresetSummaries.mockResolvedValue([{...mockPresets[0],hasPreview:true}]);
    mockIndexedDB.getPreset.mockRejectedValueOnce(new Error('Storage unavailable'));
    render(<LibraryPage/>);await screen.findByText('Drum Kit 1');
    fireEvent.click(screen.getByRole('button',{name:'Preview first sample of Drum Kit 1'}));
    await waitFor(()=>expect(stableDispatch).toHaveBeenCalledWith(expect.objectContaining({
      type:'ADD_NOTIFICATION',payload:expect.objectContaining({message:'Could not read this saved preset. Try previewing again.'}),
    })));
  });

  describe('Error Handling', () => {
    it('should handle audio context creation failure', async () => {
      const originalAudioContext = window.AudioContext;
      const ThrowingAudioContext = function () {
        throw new Error('AudioContext not supported');
      } as unknown as typeof AudioContext;
      window.AudioContext = ThrowingAudioContext;
      mockIndexedDB.getPresetSummaries.mockResolvedValue([{...mockPresets[0],hasPreview:true}]);
      mockIndexedDB.getPreset.mockResolvedValue({...mockPresets[0],data:{...mockPresets[0].data,
        drumSamples:[{name:'legacy.wav',originalIndex:0,audioBlob:new Blob([new Uint8Array([1,2,3])],{type:'audio/wav'})}]}});

      try {
        render(<LibraryPage />);
        await screen.findByText('Drum Kit 1');
        fireEvent.click(screen.getByRole('button',{name:'load preset'}));
        await waitFor(()=>expect(stableDispatch).toHaveBeenCalledWith(expect.objectContaining({
          type:'ADD_NOTIFICATION',payload:expect.objectContaining({type:'error',message:'failed to load preset'}),
        })));
        expect(stableDispatch).not.toHaveBeenCalledWith(expect.objectContaining({type:'RESTORE_LIBRARY'}));
      } finally {
        window.AudioContext = originalAudioContext;
      }
    });
  });
  it('Cancel export aborts the pending batch and never downloads its late result',async()=>{
    let resolveArchive!:(value:Blob)=>void;
    const build=vi.spyOn(batchExports,'buildLibraryBatchArchive').mockImplementationOnce(()=>new Promise(resolve=>{resolveArchive=resolve;}));
    render(<LibraryPage/>);await screen.findByText('Drum Kit 1');
    fireEvent.click(screen.getByRole('checkbox',{name:'Select Drum Kit 1'}));fireEvent.click(screen.getByRole('button',{name:'Export selected'}));
    await waitFor(()=>expect(build).toHaveBeenCalledOnce());fireEvent.click(screen.getByRole('button',{name:'Cancel export'}));
    expect(build.mock.calls[0][1]?.signal?.aborted).toBe(true);
    await act(async()=>{resolveArchive(new Blob(['not downloaded']));});
    await waitFor(()=>expect(screen.getByRole('status',{name:'Library export status'})).toHaveTextContent('Export canceled. No ZIP was downloaded.'));
    expect(mockDownloadBlob).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Export selected'})).toBeEnabled();
  });

});
