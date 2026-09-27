import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { useWebMidi } from '../../hooks/useWebMidi';
import type { MidiEvent } from '../../utils/midi';
import type { WebMidiState, WebMidiHookReturn } from '../../hooks/useWebMidi';
import { shouldIgnoreKeyboardKeyDown } from '../../utils/keyboardOwnership';
import { AUDIO_FILE_ACCEPT } from '../../utils/audioFormats';


// Drum key mapping for two octaves (matching legacy)
const drumKeyMap = [
  // Lower octave (octave 0)
  {
    // top row (offset like a real keyboard)
    W: { label: "KD2", idx: 1 }, // index 1 = sample 2
    E: { label: "SD2", idx: 3 }, // index 3 = sample 4
    R: { label: "CLP", idx: 5 }, // index 5 = sample 6
    Y: { label: "CH", idx: 8 },  // index 8 = sample 9
    U: { label: "OH", idx: 10 }, // index 10 = sample 11
    // bottom row
    A: { label: "KD1", idx: 0 },  // index 0 = sample 1
    S: { label: "SD1", idx: 2 },  // index 2 = sample 3
    D: { label: "RIM", idx: 4 },  // index 4 = sample 5
    F: { label: "TB", idx: 6 },   // index 6 = sample 7
    G: { label: "SH", idx: 7 },   // index 7 = sample 8
    H: { label: "CL", idx: 9 },   // index 9 = sample 10
    J: { label: "CAB", idx: 11 }, // index 11 = sample 12
  },
  // Upper octave (octave 1)
  {
    // top row (offset like a real keyboard)
    W: { label: "RC", idx: 13 },  // index 13 = ride cymbal
    E: { label: "CC", idx: 15 },  // index 15 = crash cymbal
    R: { label: "COW", idx: 17 }, // index 17 = cowbell
    Y: { label: "LC", idx: 20 },  // index 20 = low conga
    U: { label: "HC", idx: 22 },  // index 22 = hi-conga
    // bottom row
    A: { label: "LT1", idx: 12 },  // index 12 = low tom
    S: { label: "MT", idx: 14 },  // index 14 = mid-tom
    D: { label: "HT", idx: 16 },  // index 16 = hi-tom
    F: { label: "TRI", idx: 18 }, // index 18 = triangle
    G: { label: "LT2", idx: 19 },  // index 19 = low tom alt
    H: { label: "WS", idx: 21 },  // index 21 = wood stick
    J: { label: "GUI", idx: 23 }, // index 23 = guiro
  },
];

const drumIndexByMidiNote: Record<number, number> = Object.fromEntries(
  Array.from({length:24}, (_, index) => [53 + index, index]),
);
const keyByDrumIndex = ['A','W','S','E','D','R','F','G','Y','H','U','J','A','W','S','E','D','R','F','G','Y','H','U','J'];
const physicalKeyRows = [
  { name: 'upper', keys: ['W', 'E', 'R', 'Y', 'U'] },
  { name: 'lower', keys: ['A', 'S', 'D', 'F', 'G', 'H', 'J'] },
] as const;

// Organize mode label mapping
// White key indices (lower row) in order
const lowerIndices = [0, 2, 4, 6, 7, 9, 11, 12, 14, 16, 18, 19, 21, 23];
// Black key indices (upper row) in order
const upperIndices = [1, 3, 5, 8, 10, 13, 15, 17, 20, 22];

// Short labels for keyboard: "LO1"-"LO14", "UP1"-"UP10"
const getOrganizeModeLabel = (idx: number): string => {
  const lowerPos = lowerIndices.indexOf(idx);
  if (lowerPos !== -1) {
    return `LO${lowerPos + 1}`;
  }

  const upperPos = upperIndices.indexOf(idx);
  if (upperPos !== -1) {
    return `UP${upperPos + 1}`;
  }

  return `${idx + 1}`; // Fallback
};

// Full labels for sample table: "lower 1"-"lower 14", "upper 1"-"upper 10"
const getOrganizeModeLabelFull = (idx: number): string => {
  const lowerPos = lowerIndices.indexOf(idx);
  if (lowerPos !== -1) {
    return `lower ${lowerPos + 1}`;
  }

  const upperPos = upperIndices.indexOf(idx);
  if (upperPos !== -1) {
    return `upper ${upperPos + 1}`;
  }

  return `${idx + 1}`; // Fallback
};

// Export for use in sample table
export { getOrganizeModeLabel, getOrganizeModeLabelFull };

interface DrumKeyboardProps {
  onFileUpload?: (index: number, file: File) => void;
  selectedMidiChannel?: number;
  midiState?: WebMidiState;
  onMidiEventExternal?: WebMidiHookReturn['onMidiEvent'];
  isOrganizeMode?: boolean;
  selectedSampleIndex?: number | null;
  onSelectSample?: (index: number) => void;
  onPlaySample?: (index: number) => void;
}

export function DrumKeyboard({ onFileUpload, selectedMidiChannel, midiState: externalMidiState, onMidiEventExternal, isOrganizeMode = false, selectedSampleIndex = null, onSelectSample, onPlaySample }: DrumKeyboardProps = {}) {
  const { state } = useAppContext();
  const [currentOctave, setCurrentOctave] = useState(0);
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set()); // Format: "keyChar:octave" e.g., "A:0", "W:1"

  const fileInputRef = useRef<HTMLInputElement>(null);
  const keyboardRef = useRef<HTMLDivElement>(null);
  const pendingArrowFocus = useRef<number | null>(null);
  const recentPointerActivation = useRef<{ key: string; at: number } | null>(null);
  const [pendingUploadIndex, setPendingUploadIndex] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const { play } = useAudioPlayer();
  const internalWebMidi = useWebMidi();
  const onMidiEvent = onMidiEventExternal ?? internalWebMidi.onMidiEvent;
  const midiState = externalMidiState ?? internalWebMidi.state;

  // Detect mobile screen size changes
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Check if MIDI is connected (initialized and has input devices)
  const inputDevices = midiState.devices.filter(device => device.type === 'input' && device.state === 'connected');
  const isMidiConnected = midiState.isInitialized && inputDevices.length > 0;

  const playSample = useCallback(async (index: number) => {
    const sample = state.drumSamples[index];
    if (!sample?.isLoaded || !sample.audioBuffer) {
      return;
    }
    try {
      onPlaySample?.(index);
      await play(sample.audioBuffer, {
        inFrame: sample.inPoint !== undefined ? Math.floor(sample.inPoint * sample.audioBuffer.sampleRate) : 0,
        outFrame: sample.outPoint !== undefined ? Math.floor(sample.outPoint * sample.audioBuffer.sampleRate) : sample.audioBuffer.length,
        playbackRate: Math.pow(2, (sample.transpose || 0) / 12),
        gain: sample.gain || 0,
        pan: sample.pan || 0,
        reverse: sample.reverse || false,
      });
    } catch (error) {
      console.error('Error playing sample:', error);
    }
  }, [onPlaySample, play, state.drumSamples]);

  const moveSelectionWithArrow = (index:number,key:string) => {
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(key))return false;
    const direction=key==='ArrowLeft'||key==='ArrowUp'?-1:1;
    const target=Math.max(0,Math.min(23,index+direction));
    onSelectSample?.(target);
    pendingArrowFocus.current=target;
    if(isMobile)setCurrentOctave(target>=12?1:0);
    queueMicrotask(()=>{const button=keyboardRef.current?.querySelector<HTMLButtonElement>(`[data-drum-pad="${target}"]`);if(button){button.focus();pendingArrowFocus.current=null;}});
    return true;
  };

  useEffect(()=>{const target=pendingArrowFocus.current;if(target===null)return;queueMicrotask(()=>{const button=keyboardRef.current?.querySelector<HTMLButtonElement>(`[data-drum-pad="${target}"]`);if(button){button.focus();pendingArrowFocus.current=null;}});},[currentOctave,isMobile]);

  const getDrumIdxForKey = useCallback((key: string) => {
    const mapping = drumKeyMap[currentOctave][key as keyof typeof drumKeyMap[0]];
    return mapping ? mapping.idx : null;
  }, [currentOctave]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && pendingUploadIndex !== null && onFileUpload) {
      onFileUpload(pendingUploadIndex, file);
      setPendingUploadIndex(null);
    }
    // Reset the input value so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (shouldIgnoreKeyboardKeyDown(e)) return;

      const key = e.key.toUpperCase();

      // Handle octave switching
      if (key === 'Z') {
        setCurrentOctave(0);
        return;
      }
      if (key === 'X') {
        setCurrentOctave(1);
        return;
      }

      // Handle sample playback
      const idx = getDrumIdxForKey(key);
      if (idx !== null && state.drumSamples[idx]) {
        playSample(idx);
        setPressedKeys(prev => new Set(prev).add(`${key}:${currentOctave}`));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      setPressedKeys(prev => {
        const newSet = new Set(prev);
        // Remove the key from both octaves since we don't know which one was pressed
        newSet.delete(`${key}:0`);
        newSet.delete(`${key}:1`);
        return newSet;
      });
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [currentOctave, getDrumIdxForKey, playSample, state.drumSamples]);

  useEffect(() => {
    const clearPressed = () => setPressedKeys(new Set());
    window.addEventListener('blur', clearPressed);
    return () => window.removeEventListener('blur', clearPressed);
  }, []);

  // MIDI event handling
  const handleMidiEvent = useCallback((event: MidiEvent) => {
    if (event.type === 'noteon' && event.velocity > 0) {
      const note = event.note;


      // Map MIDI note to drum sample index
    const drumIndex = drumIndexByMidiNote[note] ?? null;
      if (drumIndex !== null) {
        // Determine which octave this note belongs to and switch if needed
        const isUpperOctave = drumIndex >= 12;
        if (isUpperOctave && currentOctave !== 1) {
          setCurrentOctave(1);
        } else if (!isUpperOctave && currentOctave !== 0) {
          setCurrentOctave(0);
        }
        playSample(drumIndex);
        // Add visual feedback by finding the key character and octave
        const keyChar = keyByDrumIndex[drumIndex] ?? null;
        if (keyChar) {
          const keyOctave = isUpperOctave ? 1 : 0;
          setPressedKeys(prev => new Set([...prev, `${keyChar}:${keyOctave}`]));
        }
      } else {
        // No drum mapping found for note
      }
    } else if (event.type === 'noteoff') {
      const note = event.note;
      const drumIndex = drumIndexByMidiNote[note] ?? null;
      if (drumIndex !== null) {
        const keyChar = keyByDrumIndex[drumIndex] ?? null;
        if (keyChar) {
          const keyOctave = drumIndex >= 12 ? 1 : 0;
          setPressedKeys(prev => {
            const newSet = new Set(prev);
            newSet.delete(`${keyChar}:${keyOctave}`);
            return newSet;
          });
        }
      }
    }
  }, [playSample, currentOctave]);

  // Set up MIDI event listener - only when drum tab is active
  useEffect(() => {
    // Only set up MIDI listener if drum tab is active
    if (state.currentTab !== 'drum') {
      return;
    }

    if (isMidiConnected && selectedMidiChannel) {
      const cleanup = onMidiEvent(handleMidiEvent, selectedMidiChannel); // Listen on selected channel only

      // Cleanup function
      return () => {
        cleanup();
      };
    } else if (!isMidiConnected) {
      // No MIDI devices connected
    } else if (!selectedMidiChannel) {
      // No MIDI channel selected
    }
  }, [isMidiConnected, selectedMidiChannel, onMidiEvent, handleMidiEvent, midiState.devices, state.currentTab]);

  // Presentation props only; MIDI notes and computer-key routing stay in drumKeyMap.
  const createKeyProps = (keyChar: string, octave: number) => {
    const mapping = drumKeyMap[octave][keyChar as keyof typeof drumKeyMap[0]];
    return {
      keyChar,
      mapping,
      octave,
      isPressed: pressedKeys.has(`${keyChar}:${octave}`),
    };
  };

  const renderPad = ({
    keyChar,
    mapping,
    octave,
    isPressed,
    row,
  }: {
    keyChar: string;
    mapping?: { label: string; idx: number };
    octave: number;
    isPressed: boolean;
    row: (typeof physicalKeyRows)[number]['name'];
  }) => {
    const sample = mapping ? state.drumSamples[mapping.idx] : null;
    const hasContent = Boolean(sample?.isLoaded);
    const isActive = hasContent; // Key is only active when it has content
    const isSelected = Boolean(mapping && selectedSampleIndex === mapping.idx);
    // Phone lower-row keys are too narrow for SELECTED; there the orange key and aria-current carry selection.
    const statusText = isSelected && !(isMobile && row === 'lower') ? 'SELECTED' : isActive ? 'LOADED' : 'EMPTY';
    // Repeated EMPTY labels are hidden visually; the text stays in the pad's accessible description.
    const statusId = mapping ? `drum-key-status-${mapping.idx}-${octave}` : undefined;

    // This function contains the core action for the key
    const handleActivate = () => {
      if (!mapping) return;
      onSelectSample?.(mapping.idx);
      if (isActive) {
        playSample(mapping.idx);
      }
    };

    return (
      <div key={`${octave}-${keyChar}`} className="studio-desktop-pad-slot">

        {/* Key button */}
        <button
          type="button"
          // data attributes are used by the mobile touch handler
          data-keychar={keyChar}
          data-octave={octave}
          onClick={() => {
            const key = `${keyChar}:${octave}`;
            const recent = recentPointerActivation.current;
            recentPointerActivation.current = null;
            if (recent?.key === key && Date.now() - recent.at < 500) return;
            handleActivate();
          }}

          // --- MOUSE & PEN EVENTS ---
          onPointerDown={(e) => {
            // This handler is for MOUSE ONLY to preserve press-and-hold.
            // Touch is handled by the container.
            if (e.pointerType !== 'mouse') return;
            handleActivate();
            recentPointerActivation.current = { key: `${keyChar}:${octave}`, at: Date.now() };
            setPressedKeys(prev => new Set(prev).add(`${keyChar}:${octave}`));
          }}
          onPointerUp={(e) => {
            if (e.pointerType !== 'mouse') return;
            setPressedKeys(prev => {
              const newSet = new Set(prev);
              newSet.delete(`${keyChar}:${octave}`);
              return newSet;
            });
          }}
          onPointerCancel={() => { recentPointerActivation.current = null; setPressedKeys(prev => {
            const next = new Set(prev);
            next.delete(`${keyChar}:${octave}`);
            return next;
          }); }}
          onMouseLeave={(e) => {
            // Also clear visual state if mouse leaves while pressed down
            if (e.buttons === 1) { // 1 means left mouse button is down
              recentPointerActivation.current = null;
              setPressedKeys(prev => {
                const newSet = new Set(prev);
                newSet.delete(`${keyChar}:${octave}`);
                return newSet;
              });
            }
          }}

          // --- KEYBOARD EVENTS ---
          onKeyDown={(e) => {
            if(mapping&&moveSelectionWithArrow(mapping.idx,e.key)){e.preventDefault();return;}
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleActivate();
              setPressedKeys(prev => new Set(prev).add(`${keyChar}:${octave}`));
            }
          }}
          onKeyUp={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setPressedKeys(prev => {
                const newSet = new Set(prev);
                newSet.delete(`${keyChar}:${octave}`);
                return newSet;
              });
            }
          }}

          // --- DRAG & DROP AND ACCESSIBILITY ---
          tabIndex={0}
          role="button"
          aria-label={isMobile && mapping
            ? `Pad ${mapping.idx + 1}, ${mapping.label}${hasContent ? `, ${sample?.name || 'loaded'}` : ', empty'}`
            : `${mapping ? mapping.label : 'Empty'} drum key ${keyChar.toUpperCase()}`}
          aria-pressed={isPressed}
          aria-current={isSelected ? 'true' : undefined}
          aria-describedby={statusId}
          data-audio-import="drum"
          data-drum-pad={mapping?.idx}
          data-pad-state={isActive ? 'loaded' : 'empty'}
          data-pad-selected={isSelected ? 'true' : undefined}
          data-pad-pressed={isPressed ? 'true' : undefined}
          className="studio-drum-pad"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.dataset.dragOver = 'true';
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            delete e.currentTarget.dataset.dragOver;
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();

            delete e.currentTarget.dataset.dragOver;

            const file = e.dataTransfer.files[0];
            if (file && mapping && onFileUpload) {
              onFileUpload(mapping.idx, file);
            }
          }}
        >
          <span className="studio-drum-pad-keychar" aria-hidden="true">{keyChar.toUpperCase()}</span>
          <strong className="studio-drum-pad-name" id={mapping ? `drum-key-${mapping.idx}-${octave}` : undefined}>
            {mapping ? isOrganizeMode ? getOrganizeModeLabel(mapping.idx) : mapping.label : '—'}
          </strong>
          <small className="studio-drum-pad-status" id={statusId} data-status-quiet={statusText === 'EMPTY' ? 'true' : undefined}>{statusText}</small>
        </button>
      </div>
    );
  };

  const renderPhysicalRows = (octave: number) => physicalKeyRows.map(row => (
    <div key={row.name} className={`studio-pad-row studio-pad-row--${row.name}`}>
      {row.keys.map(keyChar => renderPad({ ...createKeyProps(keyChar, octave), row: row.name }))}
    </div>
  ));

  return (
    <div ref={keyboardRef} role="group" aria-label="Drum keyboard" className="studio-drum-keyboard">
      {/* Hidden file input for browsing files */}
      <input
        ref={fileInputRef}
        type="file"
        accept={AUDIO_FILE_ACCEPT}
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Small screens expose one physical twelve-key bank at a time. */}
      {isMobile ? (
        <div className="studio-mobile-bank studio-drum-pad-tray">
          <div className="studio-mobile-bank-tabs" role="group" aria-label="Drum pad bank">
            {[0,1].map(bank=><button key={bank} type="button" aria-pressed={currentOctave===bank} onClick={()=>{setCurrentOctave(bank);setPressedKeys(new Set());}}>{bank===0?'Lower pads 1–12':'Upper pads 13–24'}</button>)}
          </div>
          <div className="studio-mobile-pad-grid" role="group" aria-label={currentOctave===0?'Lower twelve drum pads':'Upper twelve drum pads'}>
            {renderPhysicalRows(currentOctave)}
          </div>
        </div>
      ) : (
        <div className="studio-desktop-pad-banks studio-drum-pad-tray">
          {[0, 1].map(octave => (
            <div key={octave} role="group" aria-label={octave === 0 ? 'Lower octave drum keys' : 'Upper octave drum keys'} className="studio-desktop-pad-bank" data-active-octave={currentOctave === octave ? 'true' : undefined}>
              <p>{octave === 0 ? 'Lower pads · 1–12' : 'Upper pads · 13–24'} <span>{currentOctave === octave ? 'Computer keys active' : 'Press Z / X to play'}</span></p>
              <div className="studio-desktop-pad-grid">
                {renderPhysicalRows(octave)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
