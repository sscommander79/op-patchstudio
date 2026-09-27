import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DrumTool } from '../../components/drum/DrumTool';
import { useAppContext, useProjectHistory } from '../../context/AppContext';
import { AUDIO_CONSTANTS } from '../../utils/constants';

const audioImportMocks=vi.hoisted(()=>({beginFiles:vi.fn(),beginDrop:vi.fn()}));

// Mock dependencies
vi.mock('../../context/AppContext');
const mockUseAppContext = vi.mocked(useAppContext) as unknown as { mockReturnValue(value: unknown): void; mockImplementation(factory: () => unknown): void };
vi.mock('../../components/common/AudioImportContext',()=>({useAudioImport:()=>audioImportMocks}));

// Mock the hooks and components
vi.mock('../../hooks/useFileUpload', () => ({
  useFileUpload: () => ({
    handleDrumSampleUpload: vi.fn(),
    clearDrumSample: vi.fn(),
  }),
}));

vi.mock('../../utils/audio', () => ({
  audioBufferToWav: vi.fn(() => new ArrayBuffer(8)),
  getPatchSizeWarning: vi.fn(() => ({ warning: false, percentage: 0 })),
  formatFileSize: vi.fn((bytes: number) => `${bytes} bytes`),
}));

vi.mock('../../utils/libraryUtils', () => ({
  savePresetToLibrary: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock('../../utils/sessionStorageIndexedDB', () => ({
  sessionStorageIndexedDB: {
    resetSavedToLibraryFlag: vi.fn(() => Promise.resolve()),
  },
}));

// Mock common components
vi.mock('../../components/common/ConfirmationModal', () => ({
  ConfirmationModal: ({ isOpen, message, onConfirm, onCancel }: { isOpen: boolean; message: string; onConfirm(): void; onCancel(): void }) =>
    isOpen ? (
      <div data-testid="confirmation-modal">
        <div>{message}</div>
        <button onClick={onConfirm}>confirm</button>
        <button onClick={onCancel}>cancel</button>
      </div>
    ) : null,
}));

vi.mock('../common/RecordingModal', () => ({
  RecordingModal: ({ isOpen, onClose, onSave }: { isOpen: boolean; onClose(): void; onSave(buffer: AudioBuffer): void }) =>
    isOpen ? (
      <div data-testid="recording-modal">
        <button onClick={onClose}>close</button>
        <button onClick={() => onSave(new AudioBuffer({ length: 44100, sampleRate: 44100, numberOfChannels: 1 }))}>save</button>
      </div>
    ) : null,
}));

vi.mock('../../components/common/AudioProcessingSection', () => ({
  AudioProcessingSection: ({ onResetAudioSettingsConfirm }: { onResetAudioSettingsConfirm(): void }) => (
    <div data-testid="audio-processing-section">
      <button onClick={onResetAudioSettingsConfirm}>reset audio settings</button>
    </div>
  ),
}));

vi.mock('../../components/common/GeneratePresetSection', () => ({
  GeneratePresetSection: ({
    hasChangesFromDefaults,
    renameFiles,
    onRenameFilesChange,
    filenameSeparator,
    onFilenameSeparatorChange,
    onResetAll,
    onSaveToLibrary,
    onDownloadPreset,
    onSaveSettingsAsDefault,
  }: { hasChangesFromDefaults: boolean; renameFiles: boolean; onRenameFilesChange(value: boolean): void; filenameSeparator: string; onFilenameSeparatorChange(value: string): void; onResetAll(): void; onSaveToLibrary(): void; onDownloadPreset(): void; onSaveSettingsAsDefault(): void }) => (
    <div data-testid="generate-preset-section">
      <span data-testid="has-changes-from-defaults">{hasChangesFromDefaults.toString()}</span>
      <button onClick={onResetAll}>reset all</button>
      <button onClick={onSaveSettingsAsDefault}>save as default</button>
      <button onClick={onSaveToLibrary}>save to library</button>
      <button onClick={onDownloadPreset}>download preset</button>
      <input
        data-testid="rename-files-toggle"
        type="checkbox"
        checked={renameFiles}
        onChange={e => onRenameFilesChange(e.target.checked)}
      />
      <select
        data-testid="filename-separator-select"
        value={filenameSeparator}
        onChange={e => onFilenameSeparatorChange(e.target.value)}
      >
        <option value=" ">space</option>
        <option value="-">hyphen</option>
      </select>
    </div>
  ),
}));

vi.mock('../../components/common/PatchSizeIndicator', () => ({
  PatchSizeIndicator: () => <div data-testid="patch-size-indicator" />,
}));
vi.mock('../../components/common/FileDetailsBadges', () => ({
  FileDetailsBadges: () => <div data-testid="file-details-badges" />,
}));

vi.mock('../../components/drum/DrumSampleTable', () => ({
  DrumSampleTable: ({ onFileUpload, onFilesUpload, onClearSample, onRecordSample, onSliceSample }: { onFileUpload(index: number, file: File): void; onFilesUpload(index: number, files: File[]): void; onClearSample(index: number): void; onRecordSample(index: number): void; onSliceSample(index: number): void }) => (
    <div data-testid="drum-sample-table">
      <button onClick={() => onFileUpload(0, new File([''], 'test.wav'))}>upload sample</button>
      <button onClick={() => onFilesUpload(0, [new File(['audio'], 'valid.weird'),new File([], 'empty.wav'),new File(['text'], 'unsupported.txt')])}>upload batch</button>
      <button onClick={() => onClearSample(0)}>clear sample</button>
      <button onClick={() => onRecordSample(0)}>record sample</button>
      <button onClick={() => onSliceSample(0)}>slice loaded sample</button>
    </div>
  ),
}));

vi.mock('../../components/drum/SliceAudioModal', () => ({
  SliceAudioModal: ({isOpen,request,onApply}:{ isOpen: boolean; request: { kind: string }; onApply(id: string, prepared: { sourceIdentity: string }): void }) => isOpen ? <div data-testid="slice-audio-modal">
    <span>{request.kind}</span><button onClick={()=>onApply('mock-operation',{sourceIdentity:'source'})}>apply mocked slices</button>
  </div> : null,
}));

vi.mock('../../components/drum/DrumPresetSettings', () => ({
  DrumPresetSettings: () => <div data-testid="drum-preset-settings" />,
}));

vi.mock('./DrumBulkEditModal', () => ({
  DrumBulkEditModal: ({ isOpen, onClose }: { isOpen: boolean; onClose(): void }) =>
    isOpen ? (
      <div data-testid="bulk-edit-modal">
        <button onClick={onClose}>close</button>
      </div>
    ) : null,
}));

vi.mock('../../components/drum/DrumKeyboardContainer', () => ({
  DrumKeyboardContainer: ({ onFileUpload,onSelectSample }: { onFileUpload(index: number, file: File): void; onSelectSample(index:number):void }) => (
    <div data-testid="drum-keyboard-container">
      <button onClick={() => onFileUpload(0, new File([''], 'test.wav'))}>upload test</button>
      <button onClick={() => onSelectSample(3)}>select SD2</button>
    </div>
  ),
}));

// Mock window resize
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
});

describe('DrumTool', () => {
  const mockDispatch = vi.fn();

  const defaultState = {
    currentTab: 'drum' as const,
    drumSettings: {
      sampleRate: 0,
      bitDepth: 0,
      channels: 0,
      presetName: '',
      normalize: false,
      normalizeLevel: AUDIO_CONSTANTS.DRUM_NORMALIZATION_LEVEL,
      autoZeroCrossing: false,
      renameFiles: false, // always present
      filenameSeparator: ' ', // always present
      audioFormat: 'wav',
      presetSettings: {
        playmode: 'poly' as const,
        transpose: 0,
        velocity: 20,
        volume: 69,
        width: 0,
      },
    },
    drumSamples: Array.from({ length: 24 }, (_, index) => ({
      file: null,
      audioBuffer: null,
      name: '',
      isLoaded: false,
      inPoint: 0,
      outPoint: 0,
      playmode: 'oneshot' as const,
      reverse: false,
      tune: 0,
      pan: 0,
      gain: 0,
      hasBeenEdited: false,
      isAssigned: true,
      assignedKey: index,
      originalBitDepth: 16,
      originalSampleRate: 44100,
      originalChannels: 2,
      fileSize: 0,
      duration: 0,
      isFloat: false
    })),
    multisampleSettings: {
      sampleRate: 0,
      bitDepth: 0,
      channels: 0,
      presetName: '',
      normalize: false,
      normalizeLevel: AUDIO_CONSTANTS.MULTISAMPLE_NORMALIZATION_LEVEL,
      cutAtLoopEnd: false,
      gain: 0,
      loopEnabled: true,
      loopOnRelease: true,
      renameFiles: false,
      filenameSeparator: ' ' as const,
    },
    multisampleFiles: [],
    selectedMultisample: null,
    isLoading: false,
    error: null,
    isDrumKeyboardPinned: false,
    isMultisampleKeyboardPinned: false,
    midiNoteMapping: 'C3' as const,
    notifications: [],
    importedDrumPreset: null,
    importedMultisamplePreset: null,
    isSessionRestorationModalOpen: false,
    sessionInfo: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock useAppContext
    mockUseAppContext.mockReturnValue({
      state: defaultState,
      dispatch: mockDispatch,
    });
    vi.mocked(useProjectHistory).mockReturnValue({beginEdit:vi.fn(),endEdit:vi.fn(),cancelEdit:vi.fn(),canUndo:false,canRedo:false,historyLimited:false});
  });

  it('should render without crashing', () => {
    render(<DrumTool />);
    fireEvent.click(screen.getByRole('button',{name:'Table'}));

    expect(screen.getByTestId('drum-keyboard-container')).toBeInTheDocument();
    expect(screen.getByTestId('drum-sample-table')).toBeInTheDocument();
    expect(screen.getByTestId('drum-preset-settings')).toBeInTheDocument();
    expect(screen.getByTestId('audio-processing-section')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Focus'})).toHaveAttribute('aria-pressed','false');
  });

  it('sends one complete desktop row batch to shared intake without caller filtering',async()=>{
    render(<DrumTool/>);
    await userEvent.click(screen.getByRole('button',{name:'Table'}));
    await userEvent.click(screen.getByRole('button',{name:'upload batch'}));
    expect(audioImportMocks.beginFiles).toHaveBeenCalledTimes(1);
    const [files,intent]=audioImportMocks.beginFiles.mock.calls[0];
    expect(files.map((file:File)=>file.name)).toEqual(['valid.weird','empty.wav','unsupported.txt']);
    expect(intent).toEqual({instrument:'drum',drumPads:[0,1,2]});
  });

  it('targets an explicitly selected pad for one Add sounds file but keeps folder import in batch mode',async()=>{
    render(<DrumTool/>);
    await userEvent.click(screen.getByRole('button',{name:'select SD2'}));
    const sound=new File(['audio'],'snare.wav',{type:'audio/wav'});
    fireEvent.change(screen.getByLabelText('choose drum audio files'),{target:{files:[sound]}});
    expect(audioImportMocks.beginFiles).toHaveBeenLastCalledWith([sound],{instrument:'drum',drumPads:[3]});
    const folderSound=new File(['audio'],'folder.wav',{type:'audio/wav'});
    fireEvent.change(screen.getByLabelText('choose drum sample folder'),{target:{files:[folderSound]}});
    expect(audioImportMocks.beginFiles).toHaveBeenLastCalledWith([folderSound],{instrument:'drum'});
  });

  it('routes an unassigned Focus replacement through identity-bound shared intake',async()=>{
    const audioBuffer=new AudioContext().createBuffer(1,8,8_000),file=new File(['tray'],'tray.wav');
    const tray={...defaultState.drumSamples[0],file,audioBuffer,name:file.name,isLoaded:true,isAssigned:false,assignedKey:undefined,outPoint:audioBuffer.duration,duration:audioBuffer.duration,sourceIdentity:'old-source',sliceProvenance:{sourceIdentity:'old-source',sourceName:'break.wav',startFrame:0,endFrame:8,sourceFrameCount:8,sourceSampleRate:8_000,sourceChannels:1}};
    mockUseAppContext.mockReturnValue({state:{...defaultState,drumSamples:[...defaultState.drumSamples,tray]},dispatch:mockDispatch});
    render(<DrumTool/>);await userEvent.click(screen.getByRole('button',{name:'tray.wav'}));
    const replacement=new File(['replacement'],'replacement.wav',{type:'audio/wav'});
    fireEvent.change(screen.getByLabelText('Choose audio for selected unassigned sound'),{target:{files:[replacement]}});
    expect(audioImportMocks.beginFiles).toHaveBeenCalledWith([replacement],{instrument:'drum',drumReplacement:{file,audioBuffer}});
  });

  it('opens the shared slicer for an existing sample and dispatches its one prepared batch', async () => {
    const source=new AudioContext().createBuffer(1,100,48000);
    const loaded={...defaultState.drumSamples[0],file:new File(['x'],'break.wav',{type:'audio/wav'}),audioBuffer:source,name:'break.wav',isLoaded:true,duration:source.duration,fileSize:1};
    mockUseAppContext.mockReturnValue({state:{...defaultState,drumSamples:[loaded,...defaultState.drumSamples.slice(1)]},dispatch:mockDispatch});
    render(<DrumTool/>);
    await userEvent.click(screen.getByRole('button',{name:'Table'}));
    await userEvent.click(screen.getByRole('button',{name:'slice loaded sample'}));
    expect(screen.getByTestId('slice-audio-modal')).toHaveTextContent('existing');
    await userEvent.click(screen.getByRole('button',{name:'apply mocked slices'}));
    expect(mockDispatch).toHaveBeenCalledWith({type:'COMMIT_PREPARED_SLICES',payload:{operationId:'mock-operation',prepared:{sourceIdentity:'source'}}});
  });

  it('should handle reset all button click', async () => {
    render(<DrumTool />);

    const resetButton = screen.getByText('reset instrument');
    await userEvent.click(resetButton);

    // Should open confirmation modal
    await waitFor(() => {
      expect(screen.getByTestId('confirmation-modal')).toBeInTheDocument();
    });

    // Click confirm
    const confirmButton = screen.getByText('confirm');
    await userEvent.click(confirmButton);

    expect(mockDispatch).toHaveBeenCalledWith({
      type:'BATCH_EDIT',
      payload:expect.arrayContaining([
        { type:'CLEAR_ALL_DRUM_SAMPLES' },
        { type:'SET_DRUM_PRESET_NAME', payload:'' },
        { type:'SET_DRUM_RENAME_FILES', payload:false },
        { type:'SET_DRUM_FILENAME_SEPARATOR', payload:' ' },
      ]),
    });
  });

});
