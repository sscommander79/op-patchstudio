import {DraftNumberInput} from '../common/DraftNumberInput';
import { useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import type { AppAction, DrumSample } from '../../context/AppContext';
import { useOwnedDialog } from '../../hooks/useOwnedDialog';

interface DrumBulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BulkSettings {
  playmode: 'oneshot' | 'group' | 'loop' | 'gate';
  reverse: boolean;
  transpose: number; // -48 to +48 semitones
  gain: number; // -30 to +20 dB
  pan: number; // -100 to +100
}

export function DrumBulkEditModal({ isOpen, onClose }: DrumBulkEditModalProps) {
  const { state, dispatch } = useAppContext();
  const dialogRef=useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useState<BulkSettings>({
    playmode: 'oneshot',
    reverse: false,
    transpose: 0,
    gain: 0,
    pan: 0
  });

  const loadedSamplesCount = state.drumSamples.filter(sample => sample && sample.isLoaded).length;

  const handleSave = () => {
    const actions: AppAction[] = [];
    state.drumSamples.forEach((sample, index) => {
      if (sample && sample.isLoaded) {
        // Check if any values actually changed from the sample's current values
        const originalValues = {
          playmode: sample.playmode || 'oneshot',
          reverse: sample.reverse || false,
          transpose: sample.transpose || 0,
          gain: sample.gain || 0,
          pan: sample.pan || 0
        };

        const valuesChanged =
          settings.playmode !== originalValues.playmode ||
          settings.reverse !== originalValues.reverse ||
          settings.transpose !== originalValues.transpose ||
          settings.gain !== originalValues.gain ||
          settings.pan !== originalValues.pan;

        actions.push({
          type: 'UPDATE_DRUM_SAMPLE',
          payload: {
            index,
            updates: {
              ...settings,
              hasBeenEdited: sample.hasBeenEdited || valuesChanged
            }
          }
        });
      }
    });
    if (actions.length > 0) dispatch({ type: 'BATCH_EDIT', payload: actions });

    onClose();
  };

  const handleCancel = () => {
    onClose();
  };
  useOwnedDialog({active:isOpen,dialogRef,onClose:handleCancel});

  if (!isOpen) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drum-bulk-edit-title"
      aria-describedby="drum-bulk-edit-scope"
      tabIndex={-1}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        fontFamily: '"Montserrat", "Arial", sans-serif'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleCancel();
        }
      }}
    >
      <div className="studio-bulk-edit" style={{
        backgroundColor: 'var(--color-bg-primary)',
        color: 'var(--color-text-primary)',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        width: '90%',
        maxWidth: '500px',
        maxHeight: 'calc(100dvh - 2rem)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div className="studio-bulk-edit-header" style={{
          flex: '0 0 auto',
          padding: '1.5rem 2rem',
          borderBottom: '1px solid var(--color-border-light)'
        }}>
          <h3 id="drum-bulk-edit-title" style={{
            margin: 0,
            color: 'var(--color-text-primary)',
            fontSize: '1.25rem',
            fontWeight: '300'
          }}>Bulk edit samples</h3>
        </div>
        <div className="studio-bulk-edit-body" style={{ padding: '2rem', flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
          <div
            id="drum-bulk-edit-scope"
            className="studio-bulk-edit-note"
            style={{
              fontSize: '0.9rem',
              background: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border-light)',
              borderRadius: '6px',
              padding: '1rem',
              marginBottom: '2rem'
            }}
          >
            All five settings below replace the current values on all <strong>{loadedSamplesCount}</strong> loaded {loadedSamplesCount === 1 ? 'sample' : 'samples'}.
          </div>

          {/* Playmode */}
          <div style={{ marginBottom: '2rem' }}>
            <label htmlFor="drum-bulk-playmode" className="studio-bulk-edit-label" style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: 'var(--color-text-primary)'
            }}>
              Play mode
            </label>
            <select
              id="drum-bulk-playmode"
              className="studio-bulk-edit-field"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid var(--color-border-medium)',
                borderRadius: '6px',
                fontSize: '0.875rem',
                backgroundColor: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                outline: 'none'
              }}
              value={settings.playmode}
              onChange={(e) => setSettings({...settings, playmode: e.target.value as DrumSample['playmode']})}
            >
              <option value="oneshot">One shot – play the whole sample</option>
              <option value="group">Mute group – choke when another sample plays</option>
              <option value="loop">Loop – loop at sample end</option>
              <option value="gate">Hold to play (Gate) – play while held</option>
            </select>
          </div>

          {/* Direction */}
          <div style={{ marginBottom: '2rem' }}>
            <label htmlFor="drum-bulk-direction" className="studio-bulk-edit-label" style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: 'var(--color-text-primary)'
            }}>
              Direction
            </label>
            <select
              id="drum-bulk-direction"
              className="studio-bulk-edit-field"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid var(--color-border-medium)',
                borderRadius: '6px',
                fontSize: '0.875rem',
                backgroundColor: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                outline: 'none'
              }}
              value={settings.reverse ? 'reverse' : 'forward'}
              onChange={(e) => setSettings({...settings, reverse: e.target.value === 'reverse'})}
            >
              <option value="forward">Forward</option>
              <option value="reverse">Reverse</option>
            </select>
          </div>

          {/* Transpose */}
          <div style={{ marginBottom: '2rem' }}>
            <label htmlFor="drum-bulk-transpose" className="studio-bulk-edit-label" style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: 'var(--color-text-primary)'
            }}>Transpose (semitones, −48 to 48)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input
                type="range"
                aria-label="Transpose slider (semitones)"
                className="studio-bulk-edit-range"
                min={-48}
                max={48}
                value={settings.transpose}
                step="1"
                style={{
                  flex: 1,
                  height: '6px',
                  borderRadius: '3px',
                  background: `linear-gradient(to right, #6b7280 0%, #6b7280 ${((settings.transpose + 48) / 96) * 100}%, #e5e7eb ${((settings.transpose + 48) / 96) * 100}%, #e5e7eb 100%)`,
                  outline: 'none',
                  appearance: 'none',
                  WebkitAppearance: 'none'
                }}
                onChange={(e) => setSettings({...settings, transpose: parseInt(e.target.value)})}
              />
              <DraftNumberInput
                id="drum-bulk-transpose"
                type="number"
                className="studio-bulk-edit-field"
                min={-48}
                max={48}
                value={settings.transpose}
                style={{
                  width: '80px',
                  padding: '0.5rem',
                  border: '1px solid var(--color-border-medium)',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  outline: 'none'
                }}
                onValueChange={value=>setSettings({...settings,transpose:value})}
              />
            </div>
          </div>

          {/* Gain */}
          <div style={{ marginBottom: '2rem' }}>
            <label htmlFor="drum-bulk-gain" className="studio-bulk-edit-label" style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: 'var(--color-text-primary)'
            }}>Gain (dB, −30 to 20)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input
                type="range"
                aria-label="Gain slider (dB)"
                className="studio-bulk-edit-range"
                min={-30}
                max={20}
                value={settings.gain}
                step="1"
                style={{
                  flex: 1,
                  height: '6px',
                  borderRadius: '3px',
                  background: `linear-gradient(to right, #6b7280 0%, #6b7280 ${((settings.gain + 30) / 50) * 100}%, #e5e7eb ${((settings.gain + 30) / 50) * 100}%, #e5e7eb 100%)`,
                  outline: 'none',
                  appearance: 'none',
                  WebkitAppearance: 'none'
                }}
                onChange={(e) => setSettings({...settings, gain: parseInt(e.target.value)})}
              />
              <DraftNumberInput
                id="drum-bulk-gain"
                type="number"
                className="studio-bulk-edit-field"
                min={-30}
                max={20}
                value={settings.gain}
                style={{
                  width: '80px',
                  padding: '0.5rem',
                  border: '1px solid var(--color-border-medium)',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  outline: 'none'
                }}
                onValueChange={value=>setSettings({...settings,gain:value})}
              />
            </div>
          </div>

          {/* Pan */}
          <div style={{ marginBottom: '2rem' }}>
            <label htmlFor="drum-bulk-pan" className="studio-bulk-edit-label" style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: 'var(--color-text-primary)'
            }}>Pan (−100 left to 100 right)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input
                type="range"
                aria-label="Pan slider"
                className="studio-bulk-edit-range"
                min={-100}
                max={100}
                value={settings.pan}
                step="1"
                style={{
                  flex: 1,
                  height: '6px',
                  borderRadius: '3px',
                  background: `linear-gradient(to right, #6b7280 0%, #6b7280 ${((settings.pan + 100) / 200) * 100}%, #e5e7eb ${((settings.pan + 100) / 200) * 100}%, #e5e7eb 100%)`,
                  outline: 'none',
                  appearance: 'none',
                  WebkitAppearance: 'none'
                }}
                onChange={(e) => setSettings({...settings, pan: parseInt(e.target.value)})}
              />
              <DraftNumberInput
                id="drum-bulk-pan"
                type="number"
                className="studio-bulk-edit-field"
                min={-100}
                max={100}
                value={settings.pan}
                step="1"
                style={{
                  width: '80px',
                  padding: '0.5rem',
                  border: '1px solid var(--color-border-medium)',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  outline: 'none'
                }}
                onValueChange={value=>setSettings({...settings,pan:value})}
              />
            </div>
          </div>
        </div>

        <div className="studio-bulk-edit-actions" style={{
          flex: '0 0 auto',
          padding: '1.5rem 2rem',
          borderTop: '1px solid var(--color-border-light)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem'
        }}>
          <button
            data-initial-focus="true"
            type="button"
            className="studio-bulk-edit-cancel"
            style={{
              padding: '0.625rem 1.25rem',
              border: '1px solid var(--color-border-medium)',
              borderRadius: '3px',
              backgroundColor: 'var(--color-bg-primary)',
              color: 'var(--color-text-secondary)',
              fontSize: '0.9rem',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease'
            }}
            onClick={handleCancel}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
              e.currentTarget.style.borderColor = 'var(--color-text-primary)';
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
              e.currentTarget.style.borderColor = 'var(--color-border-medium)';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }}
          >
            <i aria-hidden="true" className="fas fa-times"></i>
            Cancel
          </button>
          <button
            type="button"
            style={{
              padding: '0.625rem 1.25rem',
              border: 'none',
              borderRadius: '3px',
              // Filled with the text token so the label inverts correctly in light and dark.
              backgroundColor: loadedSamplesCount === 0 ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
              color: 'var(--color-bg-primary)',
              fontSize: '0.9rem',
              fontWeight: '500',
              cursor: loadedSamplesCount === 0 ? 'not-allowed' : 'pointer',
              opacity: loadedSamplesCount === 0 ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease'
            }}
            onClick={handleSave}
            disabled={loadedSamplesCount === 0}
            onMouseEnter={(e) => {
              if (loadedSamplesCount > 0) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (loadedSamplesCount > 0) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            <i aria-hidden="true" className="fas fa-save"></i>
            Apply to {loadedSamplesCount} {loadedSamplesCount === 1 ? 'sample' : 'samples'}
          </button>
        </div>
      </div>
    </div>
  );
}
