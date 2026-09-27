import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { usePatchGeneration } from '../../hooks/usePatchGeneration';
import { useAppContext } from '../../context/AppContext';
import { createCompleteMultisampleSettings } from '../utils/testHelpers';
import type { AppState } from '../../context/AppContext';

// Mock the AppContext
vi.mock('../../context/AppContext');

// Mock the patch generation utilities
vi.mock('../../utils/patchGeneration', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/patchGeneration')>();
  return {
    ...actual,
    generateDrumPatch: vi.fn(),
    generateMultisamplePatch: vi.fn(),
    downloadBlob: vi.fn()
  };
});

// Mock the session storage
vi.mock('../../utils/sessionStorageIndexedDB', () => ({
  sessionStorageIndexedDB: {
    saveSession: vi.fn(),
    loadSession: vi.fn(),
    clearSession: vi.fn(),
    hasSession: vi.fn(),
    getSessionInfo: vi.fn(),
    resetSavedToLibraryFlag: vi.fn()
  }
}));

// Define a single mockAudioBuffer at the top of the file:
const mockAudioBuffer = {
  length: 44100,
  duration: 1,
  sampleRate: 44100,
  numberOfChannels: 1,
  getChannelData: () => new Float32Array(44100),
  copyFromChannel: () => {},
  copyToChannel: () => {},
  // Add any other required AudioBuffer methods as no-ops
} as unknown as AudioBuffer;

describe('usePatchGeneration', () => {
  const mockDispatch = vi.fn();

  // Create a default mock state with complete multisample settings
  const defaultMockState = {
    state: {
      currentTab: 'drum' as const,
      drumSamples: [
        {
          file: new File(['mock'], 'drum0.wav', { type: 'audio/wav' }),
          audioBuffer: mockAudioBuffer,
          name: 'drum0.wav',
          isLoaded: true,
          inPoint: 0,
          outPoint: 1.0,
          playmode: 'oneshot' as const,
          reverse: false,
          transpose: 0,
          pan: 0,
          gain: 0,
          hasBeenEdited: false,
          isAssigned: true,
          assignedKey: 0,
          originalBitDepth: 16,
          originalSampleRate: 44100,
          originalChannels: 2,
          fileSize: 1024,
          duration: 1.0
        }
      ],
      multisampleFiles: [
        {
          file: new File(['mock'], 'note0.wav', { type: 'audio/wav' }),
          audioBuffer: mockAudioBuffer,
          name: 'note0.wav',
          isLoaded: true,
          rootNote: 60,
          note: 'C3',
          inPoint: 0,
          outPoint: 1.0,
          loopStart: 0,
          loopEnd: 1.0,
          originalBitDepth: 16,
          originalSampleRate: 44100,
          originalChannels: 2,
          fileSize: 1024,
          duration: 1.0
        }
      ],
      selectedMultisample: null,
      isLoading: false,
      error: null,
      isDrumKeyboardPinned: false,
      isMultisampleKeyboardPinned: false,
      notifications: [],
      importedDrumPreset: null,
      importedMultisamplePreset: null,
      isSessionRestorationModalOpen: false,
      sessionInfo: null,
      midiNoteMapping: 'C3' as const,
      drumSettings: {
        sampleRate: 44100,
        bitDepth: 16,
        channels: 2,
        presetName: '',
        normalize: false,
        normalizeLevel: 0,
        autoZeroCrossing: true,
        presetSettings: {
          playmode: 'poly' as const,
          transpose: 0,
          velocity: 100,
          volume: 100,
          width: 100
        },
        renameFiles: false,
        filenameSeparator: ' ' as const,
        audioFormat: 'wav' as const
      },
      multisampleSettings: createCompleteMultisampleSettings()
    },
    dispatch: mockDispatch
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAppContext).mockReturnValue(defaultMockState);
  });

  it('should provide expected functions', () => {
    const { result } = renderHook(() => usePatchGeneration())
    
    expect(typeof result.current.generateDrumPatchFile).toBe('function')
    expect(typeof result.current.generateMultisamplePatchFile).toBe('function')
  })

  it('should handle drum patch generation', async () => {
    const { result } = renderHook(() => usePatchGeneration())
    
    await act(async () => {
      await result.current.generateDrumPatchFile('Test Drum Kit')
    })
    
    const { generateDrumPatch } = await import('../../utils/patchGeneration');
    expect(vi.mocked(generateDrumPatch)).toHaveBeenCalled()
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_LOADING'
      })
    )
  })

  it('should handle multisample patch generation', async () => {
    const { result } = renderHook(() => usePatchGeneration())
    
    await act(async () => {
      await result.current.generateMultisamplePatchFile('Test Multisample')
    })
    
    const { generateMultisamplePatch } = await import('../../utils/patchGeneration');
    expect(vi.mocked(generateMultisamplePatch)).toHaveBeenCalled()
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_LOADING'
      })
    )
  })

  it('should handle generation errors', async () => {
    const { generateDrumPatch } = await import('../../utils/patchGeneration');
    vi.mocked(generateDrumPatch).mockRejectedValueOnce(new Error('Generation failed'))
    
    const { result } = renderHook(() => usePatchGeneration())
    
    let outcome;
    await act(async () => {
      outcome = await result.current.generateDrumPatchFile('Test')
    })
    
    // Should have called dispatch to set error state
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_ERROR'
      })
    )
    expect(outcome).toEqual({ok:false,error:'Generation failed'});
    const { downloadBlob } = await import('../../utils/patchGeneration');
    expect(vi.mocked(downloadBlob)).not.toHaveBeenCalled();
  })

  it('returns a truthful download outcome to preflight callers', async () => {
    const { generateDrumPatch } = await import('../../utils/patchGeneration');
    vi.mocked(generateDrumPatch).mockResolvedValueOnce(new Blob(['patch']));
    const { result } = renderHook(() => usePatchGeneration());

    let outcome;
    await act(async () => { outcome = await result.current.generateDrumPatchFile('Studio Seed'); });

    expect(outcome).toEqual({ok:true,filename:'Studio Seed.preset.zip'});
  });

  it('should use default names when none provided', async () => {
    const { result } = renderHook(() => usePatchGeneration())
    
    await act(async () => {
      await result.current.generateDrumPatchFile()
      await result.current.generateMultisamplePatchFile()
    })
    
    const { generateDrumPatch, generateMultisamplePatch } = await import('../../utils/patchGeneration');
    expect(vi.mocked(generateDrumPatch)).toHaveBeenCalled()
    expect(vi.mocked(generateMultisamplePatch)).toHaveBeenCalled()
  })

  it('should handle no samples loaded error', async () => {
    // Override mock for this test
    vi.mocked(useAppContext).mockReturnValue({
      state: {
        currentTab: 'drum' as const,
        drumSamples: [], // No loaded samples
        multisampleFiles: [],
        selectedMultisample: null,
        isLoading: false,
        error: null,
        isDrumKeyboardPinned: false,
        isMultisampleKeyboardPinned: false,
        drumSettings: {
          sampleRate: 44100,
          bitDepth: 16,
          channels: 2,
          presetName: 'Test',
          normalize: false,
          normalizeLevel: -6.0,
          autoZeroCrossing: true,
          presetSettings: {
            playmode: 'poly' as const,
            transpose: 0,
            velocity: 100,
            volume: 100,
            width: 100
          },
          renameFiles: false,
          filenameSeparator: ' ' as const,
          audioFormat: 'wav' as const
        },
        multisampleSettings: createCompleteMultisampleSettings({
          presetName: 'Test',
          normalizeLevel: -6.0
        }),
        notifications: [],
        importedDrumPreset: null,
        importedMultisamplePreset: null,
        isSessionRestorationModalOpen: false,
        sessionInfo: null,
        midiNoteMapping: 'C3' as const
      },
      dispatch: mockDispatch
    })

    const { result } = renderHook(() => usePatchGeneration())
    
    await act(async () => {
      await result.current.generateDrumPatchFile()
      await result.current.generateMultisamplePatchFile()
    })
    
    // Should have called dispatch to set error state for both
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_ERROR',
        payload: 'No samples loaded'
      })
    )
  })

  it('should verify envelope values are included in multisample preset (FIXED)', async () => {
    // Mock the generateMultisamplePatchFile function to capture the JSON that gets generated
    let capturedJson!: AppState;
    const { generateMultisamplePatch } = await import('../../utils/patchGeneration');
    vi.mocked(generateMultisamplePatch).mockImplementation(async (state, _patchName) => {
      // Capture the state that gets passed to the patch generation
      capturedJson = state;
      return new Blob(['mock patch'], { type: 'application/zip' });
    });

    // Mock state with imported multisample preset that includes envelope values
    vi.mocked(useAppContext).mockReturnValue({
      ...defaultMockState,
      state: {
        ...defaultMockState.state,
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
              attack: 500,
              decay: 6000,
              sustain: 22000,
              release: 12000,
            },
            filter: {
              attack: 0,
              decay: 5000,
              sustain: 18000,
              release: 10000,
            },
          },
          regions: []
        }
      }
    });

    const { result } = renderHook(() => usePatchGeneration())
    
    await act(async () => {
      await result.current.generateMultisamplePatchFile('Test Multisample')
    })
    
    // Verify that the state passed to patch generation contains envelope values
    expect(capturedJson).toBeDefined();
    const importedPreset = capturedJson.importedMultisamplePreset;
    expect(importedPreset).toBeDefined();
    expect(importedPreset?.envelope).toBeDefined();
    expect(importedPreset?.envelope?.amp).toBeDefined();
    expect(importedPreset?.envelope?.filter).toBeDefined();
    if (!importedPreset?.envelope?.amp) throw new Error('Expected imported amplitude envelope');
    
    // Verify specific envelope values are present
    expect(importedPreset.envelope.amp.attack).toBe(500);
    expect(importedPreset.envelope.amp.decay).toBe(6000);
    expect(importedPreset.envelope.amp.sustain).toBe(22000);
    expect(importedPreset.envelope.amp.release).toBe(12000);
  })
})
