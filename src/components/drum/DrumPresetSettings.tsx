import { useRef, useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Select, SelectItem, Slider } from '@carbon/react';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { useProjectEditGesture } from '../../hooks/useProjectEditGesture';

export function DrumPresetSettings() {
  const { state, dispatch, importPresetFile } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transposeGesture = useProjectEditGesture('drum-preset-transpose');
  const velocityGesture = useProjectEditGesture('drum-preset-velocity');
  const volumeGesture = useProjectEditGesture('drum-preset-volume');
  const widthGesture = useProjectEditGesture('drum-preset-width');
  const [isMobile, setIsMobile] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void | Promise<void>;
  }>({ isOpen: false, message: '', onConfirm: async () => {} });

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handlePlaymodeChange = (value: string) => {
    dispatch({ type: 'SET_DRUM_PRESET_PLAYMODE', payload: value as 'poly' | 'mono' | 'legato' });
  };

  const handleTransposeChange = (value: number) => {
    dispatch({ type: 'SET_DRUM_PRESET_TRANSPOSE', payload: value });
  };

  const handleVelocityChange = (value: number) => {
    dispatch({ type: 'SET_DRUM_PRESET_VELOCITY', payload: value });
  };

  const handleVolumeChange = (value: number) => {
    dispatch({ type: 'SET_DRUM_PRESET_VOLUME', payload: value });
  };

  const handleWidthChange = (value: number) => {
    dispatch({ type: 'SET_DRUM_PRESET_WIDTH', payload: value });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleResetClick = () => {
    setConfirmDialog({
      isOpen: true,
      message: 'are you sure you want to reset all preset settings to default values?',
      onConfirm: () => {
        // Reset to default values (from initialState in AppContext)
        dispatch({ type: 'BATCH_EDIT', payload: [
          { type: 'SET_DRUM_PRESET_PLAYMODE', payload: 'poly' },
          { type: 'SET_DRUM_PRESET_TRANSPOSE', payload: 0 },
          { type: 'SET_DRUM_PRESET_VELOCITY', payload: 20 },
          { type: 'SET_DRUM_PRESET_VOLUME', payload: 69 },
          { type: 'SET_DRUM_PRESET_WIDTH', payload: 0 },
        ] });

        // Show success notification
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            id: Date.now().toString(),
            type: 'success',
            title: 'settings reset',
            message: 'successfully reset preset settings to default values'
          }
        });

        setConfirmDialog({ isOpen: false, message: '', onConfirm: async () => {} });
      }
    });
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be selected again
    event.target.value = '';

    if(!importPresetFile)throw new Error('Preset import is unavailable');
    await importPresetFile(file,'drum');
  };

  // Check if preset settings have been changed from defaults
  const hasPresetChanges = (
    state.drumSettings.presetSettings.playmode !== 'poly' ||
    state.drumSettings.presetSettings.transpose !== 0 ||
    state.drumSettings.presetSettings.velocity !== 20 ||
    state.drumSettings.presetSettings.volume !== 69 ||
    state.drumSettings.presetSettings.width !== 0
  );

  return (
    <div className="studio-settings-panel" style={{
      background: 'var(--color-bg-primary)',
      borderRadius: '15px',
      boxShadow: '0 2px 8px var(--color-shadow-primary)',
      border: '1px solid var(--color-border-subtle)',
      overflow: 'hidden',
      marginBottom: '2rem'
    }}>
        {/* Header */}
        <div className="studio-settings-panel-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: isMobile ? '0.5rem 1rem 0.5rem 1rem' : '0.7rem 1rem 0.5rem 1rem',
          borderBottom: '1px solid var(--color-border-medium)',
          backgroundColor: 'var(--color-bg-secondary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <h3 style={{
              margin: 0,
              color: 'var(--color-text-primary)',
              fontSize: '1.25rem',
              fontWeight: 300,
            }}>
              preset settings
            </h3>
          </div>
        </div>

        {/* Content */}
        <div style={{
          padding: isMobile ? '1rem' : '2rem',
        }}>
          {/* Settings Layout */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem'
          }}>
          {/* Playmode - Full Width */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '100px 1fr',
            gap: '1rem',
            alignItems: 'center'
          }}>
            <label style={{
              fontSize: '0.875rem',
              fontWeight: '500',
              color: 'var(--color-text-primary)'
            }}>
              playmode
            </label>
            <div style={{ maxWidth: '200px' }}>
              <Select
                id="preset-playmode"
                labelText=""
                value={state.drumSettings.presetSettings.playmode}
                onChange={(e) => handlePlaymodeChange(e.target.value)}
                size="sm"
              >
                <SelectItem value="poly" text="poly" />
                <SelectItem value="mono" text="mono" />
                <SelectItem value="legato" text="legato" />
              </Select>
            </div>
          </div>

          {/* Sound Settings in Two Columns */}
          <div className="drum-preset-grid">
            {/* Left Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <div style={{
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  color: 'var(--color-text-primary)',
                  marginBottom: '0.5rem'
                }}>
                  transpose: {state.drumSettings.presetSettings.transpose}
                </div>
                <div style={{ width: '100%' }}>
                  <Slider
                    id="preset-transpose"
                    min={-36}
                    max={36}
                    step={1}
                    value={state.drumSettings.presetSettings.transpose}
                    onChange={({ value }) => handleTransposeChange(value)}
                    onRelease={transposeGesture.end}
                    onKeyUp={transposeGesture.end}
                    onBlur={transposeGesture.end}
                    {...transposeGesture.sliderProps}
                    hideTextInput
                  />

                </div>
              </div>

              <div>
                <div style={{
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  color: 'var(--color-text-primary)',
                  marginBottom: '0.5rem'
                }}>
                  velocity: {state.drumSettings.presetSettings.velocity}%
                </div>
                <div style={{ width: '100%' }}>
                  <Slider
                    id="preset-velocity-sensitivity"
                    min={0}
                    max={100}
                    step={1}
                    value={state.drumSettings.presetSettings.velocity}
                    onChange={({ value }) => handleVelocityChange(value)}
                    onRelease={velocityGesture.end}
                    onKeyUp={velocityGesture.end}
                    onBlur={velocityGesture.end}
                    {...velocityGesture.sliderProps}
                    hideTextInput
                  />
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <div style={{
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  color: 'var(--color-text-primary)',
                  marginBottom: '0.5rem'
                }}>
                  volume: {state.drumSettings.presetSettings.volume}%
                </div>
                <div style={{ width: '100%' }}>
                  <Slider
                    id="preset-volume"
                    min={0}
                    max={100}
                    step={1}
                    value={state.drumSettings.presetSettings.volume}
                    onChange={({ value }) => handleVolumeChange(value)}
                    onRelease={volumeGesture.end}
                    onKeyUp={volumeGesture.end}
                    onBlur={volumeGesture.end}
                    {...volumeGesture.sliderProps}
                    hideTextInput
                  />
                </div>
              </div>

              <div>
                <div style={{
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  color: 'var(--color-text-primary)',
                  marginBottom: '0.5rem'
                }}>
                  width: {state.drumSettings.presetSettings.width}%
                </div>
                <div style={{ width: '100%' }}>
                  <Slider
                    id="preset-width"
                    min={0}
                    max={100}
                    step={1}
                    value={state.drumSettings.presetSettings.width}
                    onChange={({ value }) => handleWidthChange(value)}
                    onRelease={widthGesture.end}
                    onKeyUp={widthGesture.end}
                    onBlur={widthGesture.end}
                    {...widthGesture.sliderProps}
                    hideTextInput
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons Below Settings */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: isMobile ? 'center' : 'flex-end',
            flexDirection: isMobile ? 'column' : 'row',
            marginTop: '2rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid var(--color-border-light)',
          }}>
            <button
              onClick={handleResetClick}
              disabled={!hasPresetChanges}
              style={{
                minHeight: '44px',
                minWidth: '44px',
                padding: '0.75rem 1.5rem',
                border: '1px solid var(--color-interactive-focus-ring)',
                borderRadius: '6px',
                backgroundColor: 'var(--color-bg-primary)',
                color: hasPresetChanges ? 'var(--color-interactive-secondary)' : 'var(--color-border-medium)',
                fontSize: '0.9rem',
                fontWeight: '500',
                cursor: hasPresetChanges ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                opacity: hasPresetChanges ? 1 : 0.6,
                width: isMobile ? '100%' : 'auto',
              }}
              onMouseEnter={(e) => {
                if (hasPresetChanges) {
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                  e.currentTarget.style.borderColor = 'var(--color-border-medium)';
                  e.currentTarget.style.color = 'var(--color-interactive-dark)';
                }
              }}
              onMouseLeave={(e) => {
                if (hasPresetChanges) {
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                  e.currentTarget.style.borderColor = 'var(--color-interactive-focus-ring)';
                  e.currentTarget.style.color = 'var(--color-interactive-secondary)';
                }
              }}
            >
              <i className="fas fa-undo" style={{ fontSize: '1rem' }} />
              reset settings
            </button>

            <button
              onClick={handleImportClick}
              style={{
                minHeight: '44px',
                minWidth: '44px',
                padding: '0.75rem 1.5rem',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: 'var(--color-interactive-focus)',
                color: 'var(--studio-accent-text)',
                fontSize: '0.9rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                width: isMobile ? '100%' : 'auto',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-interactive-dark)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-interactive-focus)';
              }}
            >
              <i className="fas fa-upload" style={{ fontSize: '1rem' }} />
              import patch.json
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            aria-label="choose drum patch settings"
            accept=".json"
            onChange={handleFileImport}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* Slider Styling */}
      <style>{`
        #preset-transpose .cds--slider__track,
        #preset-velocity-sensitivity .cds--slider__track,
        #preset-volume .cds--slider__track,
        #preset-width .cds--slider__track {
          background: linear-gradient(to right, var(--color-bg-slider-track) 0%, var(--color-interactive-secondary) 100%) !important;
        }
        #preset-transpose .cds--slider__filled-track,
        #preset-velocity-sensitivity .cds--slider__filled-track,
        #preset-volume .cds--slider__filled-track,
        #preset-width .cds--slider__filled-track {
          background: var(--color-interactive-dark) !important;
        }
        #preset-transpose .cds--slider__thumb,
        #preset-velocity-sensitivity .cds--slider__thumb,
        #preset-volume .cds--slider__thumb,
        #preset-width .cds--slider__thumb {
          background: var(--color-interactive-dark) !important;
          border: 2px solid var(--color-interactive-dark) !important;
        }
        #preset-transpose .cds--slider__thumb:hover,
        #preset-velocity-sensitivity .cds--slider__thumb:hover,
        #preset-volume .cds--slider__thumb:hover,
        #preset-width .cds--slider__thumb:hover {
          background: var(--color-text-primary) !important;
          border-color: var(--color-text-primary) !important;
        }
      `}</style>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmDialog.isOpen}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: async () => {} })}
      />
    </div>
  );
}
