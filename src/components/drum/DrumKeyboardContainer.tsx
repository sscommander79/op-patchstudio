import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { DrumKeyboard } from './DrumKeyboard';
import { EnhancedTooltip } from '../common/EnhancedTooltip';
import { MidiDeviceSelector } from '../common/MidiDeviceSelector';
import { cookieUtils, COOKIE_KEYS } from '../../utils/cookies';
import { useWebMidi } from '../../hooks/useWebMidi';
import type { MidiEvent } from '../../utils/midi';

interface DrumKeyboardContainerProps {
  onFileUpload?: (index: number, file: File) => void;
  isOrganizeMode: boolean;
  setIsOrganizeMode: (value: boolean) => void;
  selectedSampleIndex?: number | null;
  onSelectSample?: (index: number) => void;
  onPlaySample?: (index: number) => void;
}

/**
 * DrumKeyboardContainer – visually matches the VirtualMidiKeyboard container and
 * provides identical pin / sticky behaviour while keeping the existing
 * DrumKeyboard component unchanged.
 */
export const DrumKeyboardContainer: React.FC<DrumKeyboardContainerProps> = ({ onFileUpload, isOrganizeMode, setIsOrganizeMode, selectedSampleIndex, onSelectSample, onPlaySample }) => {
  const { state } = useAppContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [isStuck, setIsStuck] = useState(false);
  const [dynamicStyles, setDynamicStyles] = useState({});
  const [placeholderHeight, setPlaceholderHeight] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [selectedMidiChannel, setSelectedMidiChannel] = useState(() => {
    const saved = localStorage.getItem('midi-channel');
    const parsed = saved ? parseInt(saved, 10) : NaN;
    // Clamp to 1-16; if invalid, default to 1
    return parsed >= 1 && parsed <= 16 ? parsed : 1;
  });

  // Persist selected MIDI channel to localStorage whenever it changes
  useEffect(() => {
    if (selectedMidiChannel >= 1 && selectedMidiChannel <= 16) {
      localStorage.setItem('midi-channel', selectedMidiChannel.toString());
    }
  }, [selectedMidiChannel]);

  // Pin state with cookie persistence
  const [isDrumKeyboardPinned, setIsDrumKeyboardPinned] = useState(() => {
    const saved = cookieUtils.getCookie(COOKIE_KEYS.DRUM_KEYBOARD_PINNED);
    return saved === 'true';
  });

  // MIDI event handling
  const { onMidiEvent, state: midiState, refreshDevices } = useWebMidi();
  const [isMidiSelectorVisible, setIsMidiSelectorVisible] = useState(false);

  // Refresh MIDI devices when tab becomes visible (helps with device detection)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && midiState.isInitialized) {

        refreshDevices();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [midiState.isInitialized, refreshDevices]);

  // Function to hide MIDI selector
  const hideMidiSelector = () => {
    setIsMidiSelectorVisible(false);
    const midiSelector = document.querySelector('.midi-device-selector') as HTMLElement;
    if (midiSelector) {
      midiSelector.style.display = 'none';
    }
  };

  // Listen for MIDI note events and hide selector
  useEffect(() => {
    const handleMidiNote = (event: MidiEvent) => {
      if (event.type === 'noteon' && event.velocity > 0) {
        // Hide MIDI selector and collapse panel when a note is played
        hideMidiSelector();
      }
    };

    const cleanup = onMidiEvent(handleMidiNote);
    return () => cleanup();
  }, [onMidiEvent]);

  // Indices 24+ hold the unassigned review tray, which is not a pad.
  const loadedSamplesCount = state.drumSamples.slice(0, 24).filter(sample => sample && sample.isLoaded).length;

  const togglePin = () => {
    const newPinnedState = !isDrumKeyboardPinned;
    setIsDrumKeyboardPinned(newPinnedState);

    // If unpinning while stuck, reset stuck state without scrolling
    if (!newPinnedState && isStuck) {
      setDynamicStyles({});
      setIsStuck(false);
    }
  };

  // Save pin state to cookie
  useEffect(() => {
    try {
      cookieUtils.setCookie(COOKIE_KEYS.DRUM_KEYBOARD_PINNED, isDrumKeyboardPinned.toString(), 365);
    } catch (error) {
      console.warn('Failed to save drum keyboard pin state to cookie:', error);
    }
  }, [isDrumKeyboardPinned]);

  const iconSize = '18px';

  const tooltipContent = isMobile ? (
    <>
      <h3>keyboard controls</h3>
      <p><strong>load:</strong> select an empty pad, then use Add sounds nearby</p>
      <p><strong>play:</strong> tap keys to play loaded samples</p>
      <p><strong>pin:</strong> use the pin icon to keep the keyboard at the top of the screen</p>
    </>
  ) : (
    <>
      <h3>keyboard controls</h3>
      <p><strong>load:</strong> select an empty pad and use Add sounds, or drag audio directly onto a pad</p>
      <p><strong>play:</strong> use keyboard keys (<strong>A-J, W, E, R, Y, U</strong>) to trigger samples and <strong>Z</strong> / <strong>X</strong> to switch octaves</p>
      <p><strong>pin:</strong> use the pin icon to keep the keyboard at the top of the screen</p>
    </>
  );

  // Add resize listener for mobile detection
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Scroll handling for stick / unstick
  useEffect(() => {
    const container = containerRef.current;
    const placeholder = placeholderRef.current;

    const handleScroll = () => {
      if (!isDrumKeyboardPinned || !container || !placeholder) return;

      if (!isStuck) {
        const rect = container.getBoundingClientRect();
        if (rect.top <= 10) {
          // Stick
          setPlaceholderHeight(rect.height);
          setDynamicStyles({ left: `${rect.left}px`, width: `${rect.width}px` });
          setIsStuck(true);
        }
      } else {
        const rect = placeholder.getBoundingClientRect();
        if (rect.top > 10) {
          // Unstick
          setDynamicStyles({});
          setIsStuck(false);
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isDrumKeyboardPinned, isStuck]);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-tooltip]')) {
        setIsTooltipVisible(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Surface colours and borders live in studio.css; only pinning geometry stays inline.
  const combinedStyles: React.CSSProperties = {
    position: isStuck ? 'fixed' : 'relative',
    top: isStuck ? '10px' : undefined,
    zIndex: isStuck ? 1000 : undefined,
    ...dynamicStyles,
  };

  return (
    <>
      {/* Placeholder to avoid layout shift */}
      <div
        ref={placeholderRef}
        style={{ display: isStuck ? 'block' : 'none', height: `${placeholderHeight}px`, background: 'var(--color-bg-primary)' }}
      />

      {/* Actual Keyboard Container */}
      <div
        ref={containerRef}
        className={`virtual-midi-keyboard studio-performance-surface studio-drum-surface ${isDrumKeyboardPinned ? 'pinned' : ''}`}
        role="region"
        aria-label={`Drum pad instrument, ${loadedSamplesCount} of 24 loaded`}
        style={combinedStyles}
      >
        {/* Header */}
        <div className="studio-performance-header">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <h3>
              drum pads
            </h3>
            <EnhancedTooltip
              isVisible={isTooltipVisible}
              content={tooltipContent}
            >
              <span
                style={{ display: 'flex' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsTooltipVisible(!isTooltipVisible);
                }}
                onMouseEnter={() => setIsTooltipVisible(true)}
                onMouseLeave={() => setIsTooltipVisible(false)}
              >
                <i aria-hidden="true"
                  className="fas fa-question-circle"
                  style={{
                    fontSize: iconSize,
                    color: 'var(--color-text-secondary)',
                    cursor: 'help'
                  }}
                />
              </span>
                          </EnhancedTooltip>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              fontSize: '0.875rem',
              color: 'var(--color-text-secondary)',
            }}
          >
            {!isMobile && (
              <>
                {/* A neutral count: the check icon appears only once something is loaded. */}
                <div className="studio-drum-loaded-count" data-loaded-count={loadedSamplesCount}>
                  {loadedSamplesCount > 0 && <i aria-hidden="true" className="fas fa-check-circle" style={{ fontSize: iconSize }}></i>}
                  {loadedSamplesCount} / 24 loaded
                </div>
                <button
                  onClick={() => setIsOrganizeMode(!isOrganizeMode)}
                  style={{
                    background: isOrganizeMode ? 'var(--studio-system-graphite)' : 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border-medium)',
                    cursor: 'pointer',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '3px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.875rem',
                    color: isOrganizeMode ? 'var(--studio-system-panel)' : 'var(--color-text-primary)',
                    transition: 'all 0.2s ease',
                    fontFamily: '"Montserrat", "Arial", sans-serif',
                    fontWeight: 500,
                    minHeight: '32px',
                  }}
                  title="Organize mode: bulk load samples by keyboard row"
                  aria-pressed={isOrganizeMode}
                >
                  <i aria-hidden="true" className="fas fa-layer-group" style={{ fontSize: '0.75rem' }}></i>
                  <span>organize</span>
                </button>
                <button
                  onClick={() => {
                    setIsMidiSelectorVisible(!isMidiSelectorVisible);
                    const midiSelector = document.querySelector('.midi-device-selector') as HTMLElement;
                    if (midiSelector) {
                      midiSelector.style.display = isMidiSelectorVisible ? 'none' : 'block';
                    }
                  }}
                  style={{
                    background: isMidiSelectorVisible
                      ? 'var(--studio-system-graphite)'
                      : 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border-medium)',
                    cursor: 'pointer',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '3px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.875rem',
                    color: isMidiSelectorVisible ? 'var(--studio-system-panel)' : 'var(--color-text-primary)',
                    transition: 'all 0.2s ease',
                    fontFamily: '"Montserrat", "Arial", sans-serif',
                    fontWeight: 500,
                    minHeight: '32px'
                  }}
                  title="connect midi devices"
                >
                  <i aria-hidden="true" className="fas fa-plug" style={{ fontSize: '0.75rem' }}></i>
                  <span>midi</span>
                </button>
              </>
            )}
            <button
              onClick={togglePin}
              className="pin-button"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
              title={isDrumKeyboardPinned ? 'Unpin keyboard' : 'Pin keyboard to top'}
            >
              <i aria-hidden="true" className="fas fa-thumbtack" style={{
                fontSize: iconSize,
              }}></i>
            </button>
          </div>
        </div>



        {/* MIDI Device Selector (Hidden by default) */}
        <div
          className="midi-device-selector"
          style={{
            display: isMidiSelectorVisible ? 'block' : 'none',
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--color-bg-primary)',
            borderBottom: '1px solid var(--color-border-light)'
          }}
        >
          <MidiDeviceSelector
            key={midiState.devices.length.toString()}
            onChannelChange={(channel) => {
              setSelectedMidiChannel(channel);
              // localStorage update handled in effect
            }}
            showInputsOnly
          />
        </div>

        {/* Keyboard */}
        <DrumKeyboard
          onFileUpload={onFileUpload}
          selectedMidiChannel={selectedMidiChannel}
          midiState={midiState}
          onMidiEventExternal={onMidiEvent}
          isOrganizeMode={isOrganizeMode}
          selectedSampleIndex={selectedSampleIndex}
          onSelectSample={onSelectSample}
          onPlaySample={onPlaySample}
        />

        {/* Organize Mode Drop Zones */}
        {isOrganizeMode && !isMobile && (
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              padding: '1rem',
              borderTop: '1px solid var(--color-border-light)',
            }}
          >
            {/* Lower Row (White Keys) Drop Zone */}
            <div
              role="region"
              aria-label="Drop zone for lower row samples (LO1-LO14)"
              data-audio-import="drum"
              data-drum-pads="0,2,4,6,7,9,11,12,14,16,18,19,21,23"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.style.borderColor = 'var(--color-text-primary)';
                e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.style.borderColor = 'var(--color-border-medium)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.style.borderColor = 'var(--color-border-medium)';
                e.currentTarget.style.backgroundColor = 'transparent';

                const files = Array.from(e.dataTransfer.files).filter(
                  (file) => file.type.startsWith('audio/') || file.name.toLowerCase().endsWith('.wav')
                );

                // White key indices for both octaves (A, S, D, F, G, H, J)
                const whiteKeyIndices = [
                  0, 2, 4, 6, 7, 9, 11,    // Octave 0
                  12, 14, 16, 18, 19, 21, 23, // Octave 1
                ];

                files.forEach((file, index) => {
                  if (index < whiteKeyIndices.length && onFileUpload) {
                    onFileUpload(whiteKeyIndices[index], file);
                  }
                });
              }}
              style={{
                flex: 1,
                border: '2px dashed var(--color-border-medium)',
                borderRadius: '6px',
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                minHeight: '120px',
              }}
            >
              <i aria-hidden="true"
                className="fas fa-file-audio"
                style={{ fontSize: '2rem', color: 'var(--color-text-secondary)' }}
              ></i>
              <div
                style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: 'var(--color-text-primary)',
                  textTransform: 'uppercase',
                }}
              >
                Drop lower row here
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-text-secondary)',
                  textAlign: 'center',
                }}
              >
                LO1–LO14 (bottom row keys)
                <br />
                Up to 14 files
              </div>
            </div>

            {/* Upper Row (Black Keys) Drop Zone */}
            <div
              role="region"
              aria-label="Drop zone for upper row samples (UP1-UP10)"
              data-audio-import="drum"
              data-drum-pads="1,3,5,8,10,13,15,17,20,22"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.style.borderColor = 'var(--color-text-primary)';
                e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.style.borderColor = 'var(--color-border-medium)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.style.borderColor = 'var(--color-border-medium)';
                e.currentTarget.style.backgroundColor = 'transparent';

                const files = Array.from(e.dataTransfer.files).filter(
                  (file) => file.type.startsWith('audio/') || file.name.toLowerCase().endsWith('.wav')
                );

                // Black key indices for both octaves (W, E, R, Y, U)
                const blackKeyIndices = [
                  1, 3, 5, 8, 10,       // Octave 0
                  13, 15, 17, 20, 22,   // Octave 1
                ];

                files.forEach((file, index) => {
                  if (index < blackKeyIndices.length && onFileUpload) {
                    onFileUpload(blackKeyIndices[index], file);
                  }
                });
              }}
              style={{
                flex: 1,
                border: '2px dashed var(--color-border-medium)',
                borderRadius: '6px',
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                minHeight: '120px',
              }}
            >
              <i aria-hidden="true"
                className="fas fa-file-audio"
                style={{ fontSize: '2rem', color: 'var(--color-text-secondary)' }}
              ></i>
              <div
                style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: 'var(--color-text-primary)',
                  textTransform: 'uppercase',
                }}
              >
                Drop upper row here
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-text-secondary)',
                  textAlign: 'center',
                }}
              >
                UP1–UP10 (top row keys)
                <br />
                Up to 10 files
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
