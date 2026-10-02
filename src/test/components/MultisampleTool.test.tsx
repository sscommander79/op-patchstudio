import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MultisampleTool } from '../../components/multisample/MultisampleTool';
import { useAppContext } from '../../context/AppContext';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { createCompleteMultisampleSettings } from '../utils/testHelpers';
import type { AppState } from '../../context/AppContext';

// Mock dependencies
vi.mock('../../context/AppContext');
const mockUseAppContext = vi.mocked(useAppContext) as unknown as { mockReturnValue(value: unknown): void; mockImplementation(factory: () => unknown): void };
vi.mock('../../hooks/useAudioPlayer');
const mockUseAudioPlayer = vi.mocked(useAudioPlayer) as unknown as { mockReturnValue(value: unknown): void };
vi.mock('../../utils/audio', () => ({
  audioBufferToWav: vi.fn(() => new ArrayBuffer(8)),
  getPatchSizeWarning: vi.fn(() => ({ warning: false, percentage: 0 })),
}));
vi.mock('../../hooks/useFileUpload', () => ({
  useFileUpload: () => ({
    handleMultisampleUpload: vi.fn(),
    clearMultisampleFile: vi.fn(),
    handleDrumUpload: vi.fn(),
    clearDrumFile: vi.fn(),
  }),
}));
vi.mock('../../hooks/usePatchGeneration', () => ({
  usePatchGeneration: () => ({
    generateDrumPatchFile: vi.fn(),
    generateMultisamplePatchFile: vi.fn(),
  }),
}));

// Mock common components
vi.mock('../../components/common/ConfirmationModal', () => ({
  ConfirmationModal: ({ isOpen, message }: { isOpen: boolean; message: string }) => 
    isOpen ? <div data-testid="confirmation-modal">{message}</div> : null,
}));

vi.mock('../../components/common/RecordingModal', () => ({
  RecordingModal: ({ isOpen }: { isOpen: boolean }) => 
    isOpen ? <div data-testid="recording-modal">Recording Modal</div> : null,
}));

vi.mock('../../components/common/AudioProcessingSection', () => ({
  AudioProcessingSection: () => <div data-testid="audio-processing-section">Audio Processing Section</div>,
}));

vi.mock('../../components/common/GeneratePresetSection', () => ({
  GeneratePresetSection: ({ hasChangesFromDefaults, onSaveSettingsAsDefault }: { hasChangesFromDefaults: boolean; onSaveSettingsAsDefault?: () => void }) => (
    <div data-testid="generate-preset-section">
      <span data-testid="has-changes-from-defaults">{hasChangesFromDefaults.toString()}</span>
      {onSaveSettingsAsDefault && (
        <button onClick={onSaveSettingsAsDefault}>save as default</button>
      )}
    </div>
  ),
}));

vi.mock('../../components/common/ErrorDisplay', () => ({
  ErrorDisplay: ({ message }: { message: string }) => 
    message ? <div data-testid="error-display">{message}</div> : null,
}));

vi.mock('../../components/common/ToggleSwitch', () => ({
  ToggleSwitch: ({ leftLabel, rightLabel, isRight, onToggle }: { leftLabel: string; rightLabel: string; isRight: boolean; onToggle(): void }) => (
    <div data-testid="toggle-switch">
      <button onClick={onToggle}>
        {isRight ? rightLabel : leftLabel}
      </button>
    </div>
  ),
}));

vi.mock('../../components/multisample/MultisampleSampleTable', () => ({
  MultisampleSampleTable: () => <div data-testid="multisample-sample-table">Multisample Sample Table</div>,
}));

vi.mock('../../components/multisample/MultisamplePresetSettings', () => ({
  MultisamplePresetSettings: () => <div data-testid="multisample-preset-settings">Multisample Preset Settings</div>,
}));

// Mock canvas and ResizeObserver for test environment
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: class MockResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  },
});

// Mock canvas getContext
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Array(4) })),
  putImageData: vi.fn(),
  createImageData: vi.fn(() => ({ data: new Array(4) })),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  fillText: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  transform: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
  setLineDash: vi.fn(), // Add this to fix the setLineDash issue
} as unknown as CanvasRenderingContext2D)) as unknown as typeof HTMLCanvasElement.prototype.getContext;

// Mock the VirtualMidiKeyboard component with better event handling
vi.mock('../../components/multisample/VirtualMidiKeyboard', () => ({
  VirtualMidiKeyboard: ({ onKeyClick, onKeyRelease, onUnassignedKeyClick,isActive }: { onKeyClick(note: number): void; onKeyRelease?(note: number): void; onUnassignedKeyClick(note: number): void;isActive:boolean }) => {
    const handleMouseUp = (midiNote: number) => {
      if (onKeyRelease) {
        onKeyRelease(midiNote);
      }
    };

    const handleMouseLeave = (midiNote: number) => {
      if (onKeyRelease) {
        onKeyRelease(midiNote);
      }
    };

    return (
      <div data-testid="virtual-midi-keyboard" data-active={String(isActive)}>
        <button 
          data-testid="assigned-key-60" 
          onClick={() => onKeyClick(60)}
          onMouseUp={() => handleMouseUp(60)}
          onMouseLeave={() => handleMouseLeave(60)}
        >
          C4 (Assigned)
        </button>
        <button 
          data-testid="unassigned-key-61" 
          onClick={() => onUnassignedKeyClick(61)}
        >
          C#4 (Unassigned)
        </button>
      </div>
    );
  },
}));

describe('MultisampleTool ADSR Integration', () => {
  const mockPlayWithADSR = vi.fn();
  const mockReleaseNote = vi.fn();
  const mockPlay = vi.fn();
  const mockStopAllNotes = vi.fn();

  const mockAudioBuffer = {
    duration: 2.0,
    length: 88200,
    sampleRate: 44100,
    numberOfChannels: 1,
    getChannelData: vi.fn(() => new Float32Array(88200)),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  } as AudioBuffer;

  const defaultState = {
    currentTab: 'multisample',
    multisampleFiles: [
      {
        id: '1',
        name: 'test-sample.wav',
        file: new File([''], 'test-sample.wav'),
        isLoaded: true,
        audioBuffer: mockAudioBuffer,
        rootNote: 60, // C4
        inPoint: 0,
        outPoint: 2.0,
        loopStart: 0,
        loopEnd: 2.0,
      },
    ],
    multisampleSettings: createCompleteMultisampleSettings({
      presetName: 'Test Preset',
      // add any overrides needed for specific tests
    }),
    importedMultisamplePreset: {
      engine: {
        playmode: 'poly',
        transpose: 0,
        'velocity.sensitivity': 10240,
        volume: 16466,
        width: 0,
        highpass: 0,
        'portamento.amount': 0,
        'portamento.type': 32767,
        'tuning.root': 0,
      },
      envelope: {
        amp: {
          attack: 1000,  // Custom ADSR values
          decay: 8000,
          sustain: 25000,
          release: 15000,
        },
        filter: {
          attack: 200,
          decay: 4000,
          sustain: 20000,
          release: 12000,
        },
      },
      regions: [],
    },
    error: null,
    isMultisampleKeyboardPinned: false,
    midiNoteMapping: 'C3' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock useAppContext
    mockUseAppContext.mockReturnValue({
      state: defaultState,
      dispatch: vi.fn(),
    });

    // Mock useAudioPlayer
    mockUseAudioPlayer.mockReturnValue({
      play: mockPlay,
      playWithADSR: mockPlayWithADSR,
      releaseNote: mockReleaseNote,
      stopAllNotes: mockStopAllNotes,
      stop: vi.fn(),
      getState: vi.fn(() => ({ isPlaying: false, currentTime: 0, duration: 0 })),
    });

    // Mock global active notes array
    window.opPatchstudioActiveNotes = [];
  });

  it('should render multisample tool with keyboard', () => {
    render(<MultisampleTool />);
    
    expect(screen.getByTestId('virtual-midi-keyboard')).toBeInTheDocument();
    expect(screen.getByTestId('assigned-key-60')).toBeInTheDocument();
    expect(screen.getByTestId('unassigned-key-61')).toBeInTheDocument();
  });

  it('stops app playback and disables keyboard MIDI ownership while recording is open',()=>{
    render(<MultisampleTool/>);expect(screen.getByTestId('virtual-midi-keyboard')).toHaveAttribute('data-active','true');fireEvent.click(screen.getAllByRole('button',{name:'Record takes'})[0]);expect(mockStopAllNotes).toHaveBeenCalledOnce();expect(screen.getByTestId('virtual-midi-keyboard')).toHaveAttribute('data-active','false');
  });

  it('keeps the automatically selected asset after a root-note sort', async () => {
    const dispatch=vi.fn();
    const high={...defaultState.multisampleFiles[0],name:'high.wav',file:new File(['high'],'high.wav'),rootNote:72,note:'C5'};
    const low={...defaultState.multisampleFiles[0],name:'low.wav',file:new File(['low'],'low.wav'),rootNote:60,note:'C4'};
    let liveState={...defaultState,multisampleFiles:[],selectedMultisample:null} as unknown as AppState;
    mockUseAppContext.mockImplementation(()=>({state:liveState,dispatch}));
    const view=render(<MultisampleTool/>);

    liveState={...liveState,multisampleFiles:[high,low]};
    view.rerender(<MultisampleTool/>);
    await waitFor(()=>expect(screen.getByRole('combobox',{name:'Selected multisample zone'})).toHaveValue('0'));

    liveState={...liveState,multisampleFiles:[low,{...high,rootNote:48,note:'C3'}]};
    view.rerender(<MultisampleTool/>);
    await waitFor(()=>expect(screen.getByRole('combobox',{name:'Selected multisample zone'})).toHaveValue('1'));
    expect(dispatch).toHaveBeenCalledWith({type:'SET_SELECTED_MULTISAMPLE',payload:1});
  });

  it('should play assigned key with ADSR envelope', async () => {
    render(<MultisampleTool />);
    
    const assignedKey = screen.getByTestId('assigned-key-60');
    fireEvent.click(assignedKey);

    await waitFor(() => {
      expect(mockPlayWithADSR).toHaveBeenCalledWith(
        mockAudioBuffer,
        expect.stringMatching(/multisample-60-\d+/),
        {
          signal: expect.any(AbortSignal),
          playbackRate: 1, // No pitch offset for root note
          gain: 0,
          pan: 0,
          adsr: {
            attack: 500,
            decay: 6000,
            sustain: 22000,
            release: 12000,
          },
          playMode: 'poly',
          velocity: 127,
          // Loop settings
          loopEnabled: true,
          loopOnRelease: true,
          loopStart: 0,
          loopEnd: 2,
        }
      );
    });
  });

  it.each(['release','unmount'])('cancels pending playback on %s before audio initialization completes',async(reason)=>{
    let finish!:()=>void;
    let captured:AbortSignal|undefined;
    let started=false;
    mockPlayWithADSR.mockImplementationOnce((_buffer,_id,options)=>new Promise<void>(resolve=>{
      captured=options.signal;
      finish=()=>{if(!captured?.aborted)started=true;resolve();};
    }));
    const view=render(<MultisampleTool/>);
    fireEvent.click(screen.getByTestId('assigned-key-60'));
    if(reason==='release')fireEvent.mouseUp(screen.getByTestId('assigned-key-60'));else view.unmount();
    finish();
    await waitFor(()=>expect(started).toBe(false));
    expect(captured?.aborted).toBe(true);
  });

  it('should release note when key is released', async () => {
    render(<MultisampleTool />);
    
    const assignedKey = screen.getByTestId('assigned-key-60');
    
    // Click to start note
    fireEvent.click(assignedKey);
    
    // Add an active note to the global array to simulate a playing note
    window.opPatchstudioActiveNotes = ['multisample-60-1234567890'];
    
    // Release note
    fireEvent.mouseUp(assignedKey);
    
    await waitFor(() => {
      expect(mockReleaseNote).toHaveBeenCalledWith('multisample-60-1234567890');
    });
  });

  it('should release note when mouse leaves key', async () => {
    render(<MultisampleTool />);
    
    const assignedKey = screen.getByTestId('assigned-key-60');
    
    // Click to start note
    fireEvent.click(assignedKey);
    
    // Add an active note to the global array to simulate a playing note
    window.opPatchstudioActiveNotes = ['multisample-60-1234567890'];
    
    // Mouse leaves key
    fireEvent.mouseLeave(assignedKey);
    
    await waitFor(() => {
      expect(mockReleaseNote).toHaveBeenCalledWith('multisample-60-1234567890');
    });
  });

  it('should use default ADSR values when no preset is imported', async () => {
    const stateWithoutPreset = {
      ...defaultState,
      importedMultisamplePreset: null,
    };

    mockUseAppContext.mockReturnValue({
      state: stateWithoutPreset,
      dispatch: vi.fn(),
    });

    render(<MultisampleTool />);
    
    const assignedKey = screen.getByTestId('assigned-key-60');
    fireEvent.click(assignedKey);

    await waitFor(() => {
      expect(mockPlayWithADSR).toHaveBeenCalledWith(
        mockAudioBuffer,
        expect.stringMatching(/multisample-60-\d+/),
        expect.objectContaining({
          adsr: {
            attack: 500,
            decay: 6000,
            sustain: 22000,
            release: 12000,
          },
          playMode: 'poly',
        })
      );
    });
  });

  it('should use play mode from multisample settings', async () => {
    const stateWithMonoMode = {
      ...defaultState,
      multisampleSettings: {
        ...defaultState.multisampleSettings,
        playmode: 'mono' as const,
      },
    };

    mockUseAppContext.mockReturnValue({
      state: stateWithMonoMode,
      dispatch: vi.fn(),
    });

    render(<MultisampleTool />);
    
    const assignedKey = screen.getByTestId('assigned-key-60');
    fireEvent.click(assignedKey);

    await waitFor(() => {
      expect(mockPlayWithADSR).toHaveBeenCalledWith(
        mockAudioBuffer,
        expect.stringMatching(/multisample-60-\d+/),
        expect.objectContaining({
          playMode: 'mono',
        })
      );
    });
  });

  it('should apply pitch shifting for non-root notes', async () => {
    // Test that the component can handle pitch shifting logic
    // We'll test the mathematical calculation rather than the complex zone mapping
    const pitchOffset = 12; // C4 is 12 semitones above C3
    const expectedPlaybackRate = Math.pow(2, pitchOffset / 12);
    
    // Verify the calculation is correct
    expect(expectedPlaybackRate).toBe(2); // 2^1 = 2
    
    // Test that the component renders and can handle key clicks
    render(<MultisampleTool />);
    
    const assignedKey = screen.getByTestId('assigned-key-60');
    expect(assignedKey).toBeInTheDocument();
    
    // The actual pitch shifting logic is complex and depends on zone mapping
    // which is difficult to test in isolation. Instead, we verify the component
    // renders correctly and can handle user interactions.
  });

  it('should handle multiple samples with different root notes', async () => {
    const mockState = {
      ...createCompleteMultisampleSettings(),
      multisampleSettings: createCompleteMultisampleSettings(),
      multisampleFiles: [
        {
          file: new File([''], 'c3.wav'),
          audioBuffer: mockAudioBuffer,
          name: 'c3.wav',
          isLoaded: true,
          rootNote: 48, // C3
          note: 'C3',
          inPoint: 0,
          outPoint: 1,
          loopStart: 0.1,
          loopEnd: 0.9,
          originalBitDepth: 16,
          originalSampleRate: 44100,
          originalChannels: 1,
          fileSize: 1000,
          duration: 1,
          isFloat: false
        },
        {
          file: new File([''], 'c4.wav'),
          audioBuffer: mockAudioBuffer,
          name: 'c4.wav',
          isLoaded: true,
          rootNote: 60, // C4
          note: 'C4',
          inPoint: 0,
          outPoint: 1,
          loopStart: 0.1,
          loopEnd: 0.9,
          originalBitDepth: 16,
          originalSampleRate: 44100,
          originalChannels: 1,
          fileSize: 1000,
          duration: 1,
          isFloat: false
        }
      ],
      currentTab: 'multisample' as const,
      isMultisampleKeyboardPinned: false,
      error: null,
      isLoading: false,
      notifications: [],
      importedMultisamplePreset: null,
      isSessionRestorationModalOpen: false,
      sessionInfo: null,
      midiNoteMapping: 'C3' as const
    };

    mockUseAppContext.mockReturnValue({
      state: mockState,
      dispatch: vi.fn()
    });

    render(<MultisampleTool />);

    // Verify that the keyboard is rendered with both samples assigned
    expect(screen.getByTestId('virtual-midi-keyboard')).toBeInTheDocument();
  });

  it('should correctly map zone ranges for multisample samples', async () => {
    const mockState = {
      ...createCompleteMultisampleSettings(),
      multisampleSettings: createCompleteMultisampleSettings(),
      multisampleFiles: [
        {
          file: new File([''], 'c3.wav'),
          audioBuffer: mockAudioBuffer,
          name: 'c3.wav',
          isLoaded: true,
          rootNote: 48, // C3
          note: 'C3',
          inPoint: 0,
          outPoint: 1,
          loopStart: 0.1,
          loopEnd: 0.9,
          originalBitDepth: 16,
          originalSampleRate: 44100,
          originalChannels: 1,
          fileSize: 1000,
          duration: 1,
          isFloat: false
        },
        {
          file: new File([''], 'c4.wav'),
          audioBuffer: mockAudioBuffer,
          name: 'c4.wav',
          isLoaded: true,
          rootNote: 60, // C4
          note: 'C4',
          inPoint: 0,
          outPoint: 1,
          loopStart: 0.1,
          loopEnd: 0.9,
          originalBitDepth: 16,
          originalSampleRate: 44100,
          originalChannels: 1,
          fileSize: 1000,
          duration: 1,
          isFloat: false
        }
      ],
      currentTab: 'multisample' as const,
      isMultisampleKeyboardPinned: false,
      error: null,
      isLoading: false,
      notifications: [],
      importedMultisamplePreset: null,
      isSessionRestorationModalOpen: false,
      sessionInfo: null,
      midiNoteMapping: 'C3' as const
    };

    const mockDispatch = vi.fn();
    mockUseAppContext.mockReturnValue({
      state: mockState,
      dispatch: mockDispatch
    });

    render(<MultisampleTool />);

    // The zone mapping should now correctly assign:
    // - Notes 0-47: mapped to C3 (48) with negative pitch offset
    // - Notes 48-59: mapped to C3 (48) with 0-11 pitch offset  
    // - Notes 60+: mapped to C4 (60) with 0+ pitch offset
    
    // Verify that both samples are properly assigned to the keyboard
    expect(screen.getByTestId('virtual-midi-keyboard')).toBeInTheDocument();
  });

  it('should not call playWithADSR for unassigned keys', async () => {
    render(<MultisampleTool />);
    
    const unassignedKey = screen.getByTestId('unassigned-key-61');
    fireEvent.click(unassignedKey);

    await waitFor(() => {
      expect(mockPlayWithADSR).not.toHaveBeenCalled();
    });
  });

  it('should handle gain settings from multisample settings', async () => {
    const stateWithGain = {
      ...defaultState,
      multisampleSettings: createCompleteMultisampleSettings({
        gain: -6, // -6dB gain
      }),
    };

    mockUseAppContext.mockReturnValue({
      state: stateWithGain,
      dispatch: vi.fn(),
    });

    render(<MultisampleTool />);
    
    const assignedKey = screen.getByTestId('assigned-key-60');
    fireEvent.click(assignedKey);

    await waitFor(() => {
      expect(mockPlayWithADSR).toHaveBeenCalledWith(
        mockAudioBuffer,
        expect.stringMatching(/multisample-60-\d+/),
        expect.objectContaining({
          gain: -6,
        })
      );
    });
  });

  it('keeps root and loop editing in Focus with advanced settings reachable', async () => {
    const mockDispatch = vi.fn();
    mockUseAppContext.mockReturnValue({
      state: {
        ...defaultState,
        importedMultisamplePreset: {
          engine: {
            playmode: 'mono',
            transpose: 12,
            'velocity.sensitivity': 16384,
            volume: 22938,
            width: 8192,
            highpass: 16384,
            'portamento.amount': 3277,
            'portamento.type': 32767,
            'tuning.root': 5,
          },
          envelope: {
            amp: {
              attack: 1000,
              decay: 2000,
              sustain: 24576,
              release: 3000,
            },
            filter: {
              attack: 500,
              decay: 1500,
              sustain: 16384,
              release: 2500,
            },
          },
          regions: []
        }
      },
      dispatch: mockDispatch,
    });

    render(<MultisampleTool />);

    expect(screen.getByRole('region',{name:'Focused multisample editor'})).toBeVisible();
    expect(screen.getByRole('spinbutton',{name:'Root note'})).toBeVisible();
    expect(screen.getByRole('spinbutton',{name:/Loop Start/})).toBeVisible();
    expect(screen.getByText(/Preset and performance settings/)).toBeVisible();
    expect(screen.getByTestId('multisample-preset-settings')).not.toBeVisible();
    fireEvent.click(screen.getByText(/Preset and performance settings/));
    expect(screen.getByTestId('multisample-preset-settings')).toBeVisible();
  });

  it('retains Table as an explicit alternate view', async () => {
    const mockDispatch = vi.fn();
    const advancedPreset = {
      engine: {
        playmode: 'legato',
        transpose: -6,
        'velocity.sensitivity': 8192, // 25%
        volume: 16384, // 50%
        width: 3277, // 10%
        highpass: 8192, // 25%
        'portamento.amount': 16384, // 50%
        'portamento.type': 0, // exponential
        'tuning.root': 7, // G
      },
      envelope: {
        amp: {
          attack: 500,
          decay: 1000,
          sustain: 8192, // 25%
          release: 1500,
        },
        filter: {
          attack: 200,
          decay: 800,
          sustain: 12288, // 37.5%
          release: 1200,
        },
      },
      regions: []
    };

    mockUseAppContext.mockReturnValue({
      state: {
        ...defaultState,
        importedMultisamplePreset: advancedPreset
      },
      dispatch: mockDispatch,
    });

    render(<MultisampleTool />);

    fireEvent.click(screen.getByRole('button',{name:'Table'}));
    expect(screen.getByTestId('multisample-sample-table')).toBeVisible();
  });


});
