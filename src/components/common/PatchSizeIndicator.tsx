import { useEffect, useMemo, useState } from 'react';
import { InlineLoading } from '@carbon/react';
import { useAppContext } from '../../context/AppContext';
import { calculatePatchSize, formatFileSize, getPatchSizeWarning } from '../../utils/audio';

interface PatchSizeIndicatorProps {
  type: 'drum' | 'multisample';
  className?: string;
}

export function PatchSizeIndicator({ type, className = '' }: PatchSizeIndicatorProps) {
  const { state } = useAppContext();
  const [patchSize, setPatchSize] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);


  // Get relevant audio buffers and settings based on type
  const audioBuffers = useMemo(() => type === 'drum'
    ? state.drumSamples.filter(s => s && s.audioBuffer).map(s => s!.audioBuffer!)
    : state.multisampleFiles.filter(f => f && f.audioBuffer).map(f => f!.audioBuffer!),
  [state.drumSamples, state.multisampleFiles, type]);

  const settings = type === 'drum' ? state.drumSettings : state.multisampleSettings;

  // Calculate preset size when samples or settings change
  useEffect(() => {
    const calculateSize = async () => {
      if (audioBuffers.length === 0) {
        setPatchSize(0);
        return;
      }

      setIsCalculating(true);
      try {
        const size = await calculatePatchSize(audioBuffers, {
          sampleRate: settings.sampleRate,
          bitDepth: settings.bitDepth,
          channels: settings.channels,
        });
        setPatchSize(size);
      } catch (error) {
        console.error('Failed to calculate preset size:', error);
        setPatchSize(0);
      } finally {
        setIsCalculating(false);
      }
    };

    calculateSize();
  }, [audioBuffers, settings.sampleRate, settings.bitDepth, settings.channels]);

  // Calculate percentage and get warning
  const maxSize = 8 * 1024 * 1024; // 8mb limit
  const percentage = Math.min(100, (patchSize / maxSize) * 100);
  const warning = getPatchSizeWarning(patchSize);
  // Display casing only; the byte thresholds above are unchanged.
  const sizeLabel = formatFileSize(patchSize).replace(/ (mb|kb|b)$/, unit => unit.toUpperCase());
  const guidanceId = `preset-size-guidance-${type}`;



  // Always show the indicator, even with 0 samples

  return (
    <div className={`preset-size-indicator ${className}`} style={{
      marginBottom: '1rem',
      width: '100%' // Full width of its container (which is now 50%)
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.5rem'
      }}>
        <span style={{
          fontSize: '0.9rem',
          fontWeight: '500',
          color: 'var(--color-text-primary)'
        }}>
          Preset size estimate
        </span>
        <span style={{
          fontSize: '0.9rem',
          color: 'var(--color-text-secondary)'
        }}>
          {isCalculating ? (
            <InlineLoading description="Calculating..." />
          ) : (
            sizeLabel
          )}
        </span>
      </div>

      {/* Custom progress bar with fixed 8mb indicator */}
      <div style={{
        marginBottom: '0.5rem',
        position: 'relative'
      }}>
        {/* Background bar */}
        <div
          role="progressbar"
          aria-label="Preset size estimate"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percentage)}
          aria-valuetext={`${sizeLabel} of the recommended 8 MB`}
          aria-describedby={guidanceId}
          style={{
          width: '100%',
          height: '8px',
          backgroundColor: 'var(--color-progress-track)',
          borderRadius: '4px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Progress fill */}
          <div style={{
            width: `${Math.min(100, percentage)}%`,
            height: '100%',
            backgroundColor: 'var(--color-text-secondary)',
            borderRadius: '4px',
            transition: 'width 0.3s ease'
          }} />

          {/* 8mb limit indicator line */}
          <div style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: '2px',
            height: '100%',
            backgroundColor: 'var(--color-text-secondary)',
            zIndex: 1
          }} />
        </div>

        {/* Scale labels */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '0.25rem',
          fontSize: '0.7rem',
          color: 'var(--color-text-info)'
        }}>
          <span>0 MB</span>
          <span>8.0 MB recommended</span>
        </div>
      </div>

      {/* Shown as text so it does not depend on hover. */}
      <p id={guidanceId} style={{
        margin: '0.25rem 0 0',
        fontSize: '0.8rem',
        lineHeight: 1.4,
        color: 'var(--color-text-secondary)'
      }}>
        The OP-XY has 64 MB allocated to samples across all presets. The 8 MB limit per preset is recommended to prevent memory issues and note dropping. 16-bit samples load faster than 24-bit and help stay within memory constraints.
      </p>

      {warning && (
        <div role="status" style={{
          fontSize: '0.8rem',
          color: 'var(--color-text-secondary)',
          fontStyle: 'italic',
          marginTop: '0.25rem'
        }}>
          {warning}
        </div>
      )}

      {/* Only show format details if any setting differs from original (0) */}
      {(settings.sampleRate !== 0 || settings.bitDepth !== 0 || settings.channels !== 0) && (
        <div style={{
          fontSize: '0.8rem',
          color: 'var(--color-text-secondary)',
          marginTop: '0.25rem'
        }}>
          {audioBuffers.length} sample{audioBuffers.length !== 1 ? 's' : ''}
          {settings.sampleRate !== 0 && (
            <> • {`${settings.sampleRate / 1000} kHz`}</>
          )}
          {settings.bitDepth !== 0 && (
            <> • {settings.bitDepth}-bit</>
          )}
          {settings.channels !== 0 && (
            <> • {settings.channels === 1 ? 'Mono' : 'Stereo'}</>
          )}
        </div>
      )}

      {/* Recommendations for optimization */}
      {percentage >= 85 && (
        <div style={{
          fontSize: '0.8rem',
          color: 'var(--color-text-secondary)',
          marginTop: '0.5rem',
          padding: '0.5rem',
          backgroundColor: 'var(--color-bg-secondary)',
          borderRadius: '3px',
          border: '1px solid var(--color-progress-track)'
        }}>
          <strong>Ways to reduce the size:</strong>
          <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0 }}>
            {(settings.sampleRate === 0 || settings.sampleRate > 22050) && (
              <li>Reduce the sample rate to 22.05 kHz for a smaller size</li>
            )}
            {(settings.bitDepth === 0 || settings.bitDepth > 16) && (
              <li>Use 16-bit instead of 24-bit</li>
            )}
            {(settings.channels === 0 || settings.channels === 2) && (
              <li>Convert to mono if stereo imaging isn't needed</li>
            )}
            <li>Trim unused portions of samples</li>
          </ul>
        </div>
      )}
    </div>
  );
}
