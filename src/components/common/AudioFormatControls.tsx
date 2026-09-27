import React, { useMemo } from 'react';
import { Select, SelectItem } from '@carbon/react';

interface SampleData {
  originalBitDepth?: number;
  originalSampleRate?: number;
  originalChannels?: number;
  isLoaded: boolean;
}

interface AudioFormatControlsProps {
  sampleRate: number;
  bitDepth: number;
  channels: number;
  onSampleRateChange: (value: string) => void;
  onBitDepthChange: (value: string) => void;
  onChannelsChange: (value: string) => void;
  samples: SampleData[]; // Array of loaded samples to analyze
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  isMobile?: boolean;
}

export function AudioFormatControls({
  sampleRate,
  bitDepth,
  channels,
  onSampleRateChange,
  onBitDepthChange,
  onChannelsChange,
  samples,
  size = 'sm',
  disabled = false,
  isMobile = false
}: AudioFormatControlsProps) {
  
  // Calculate which options should be disabled based on loaded samples
  const disabledOptions = useMemo(() => {
    const loadedSamples = samples.filter(s => s && s.isLoaded && s.originalBitDepth && s.originalSampleRate && s.originalChannels);
    
    if (loadedSamples.length === 0) {
      return {
        sampleRate: {},
        bitDepth: {},
        channels: {}
      };
    }
    
    // Find the highest quality among all loaded samples
    let maxBitDepth = 0;
    let maxSampleRate = 0;
    let hasAnyStereo = false;
    let allSameBitDepth = true;
    let allSameSampleRate = true;
    // let allSameChannels = true;
    let firstBitDepth: number | null = null;
    let firstSampleRate: number | null = null;
    let firstChannels: number | null = null;
    
    // Analyze all loaded samples
    for (const sample of loadedSamples) {
      maxBitDepth = Math.max(maxBitDepth, sample.originalBitDepth!);
      maxSampleRate = Math.max(maxSampleRate, sample.originalSampleRate!);
      if (sample.originalChannels! > 1) hasAnyStereo = true;
      
      // Check if all samples have the same properties
      if (firstBitDepth === null) {
        firstBitDepth = sample.originalBitDepth!;
      } else if (sample.originalBitDepth !== firstBitDepth) {
        allSameBitDepth = false;
      }
      
      if (firstSampleRate === null) {
        firstSampleRate = sample.originalSampleRate!;
      } else if (sample.originalSampleRate !== firstSampleRate) {
        allSameSampleRate = false;
      }
      
      if (firstChannels === null) {
        firstChannels = sample.originalChannels!;
      } else if (sample.originalChannels !== firstChannels) {
        // allSameChannels = false;
      }
    }
    
    const result = {
      sampleRate: {} as Record<string, boolean>,
      bitDepth: {} as Record<string, boolean>,
      channels: {} as Record<string, boolean>
    };
    
    // Sample Rate Rules
    // Disable options that would upsample (except from 48kHz which can downsample to anything)
    if (maxSampleRate < 48000) {
      if (maxSampleRate < 44100) result.sampleRate['44100'] = true;
      if (maxSampleRate < 22050) result.sampleRate['22050'] = true;
      if (maxSampleRate < 11025) result.sampleRate['11025'] = true;
    }
    
    // If all samples are the same sample rate, disable that conversion option
    if (allSameSampleRate && firstSampleRate && firstSampleRate !== 48000) {
      result.sampleRate[firstSampleRate.toString()] = true;
    }
    
    // Bit Depth Rules
    // Disable 24-bit if ALL samples are 16-bit or lower (no upsampling)
    if (maxBitDepth <= 16) {
      result.bitDepth['24'] = true;
    }
    
    // Disable 16-bit if ALL samples are 12-bit or lower (no upsampling)
    if (maxBitDepth <= 12) {
      result.bitDepth['16'] = true;
    }
    
    // Disable 12-bit if ALL samples are 8-bit or lower (no upsampling)
    if (maxBitDepth <= 8) {
      result.bitDepth['12'] = true;
    }
    
    // If all samples are the same bit depth, disable that conversion option
    if (allSameBitDepth && firstBitDepth) {
      result.bitDepth[firstBitDepth.toString()] = true;
    }
    
    // Channels Rules
    // If all samples are mono, disable mono conversion (redundant)
    if (!hasAnyStereo) {
      result.channels['1'] = true;
    }

    // A configured conversion remains a valid explicit choice. Loading audio may
    // change suggestions, but must not disable or rewrite the user's selection.
    result.sampleRate[sampleRate.toString()] = false;
    result.bitDepth[bitDepth.toString()] = false;
    result.channels[channels.toString()] = false;
    
    return result;
  }, [bitDepth, channels, sampleRate, samples]);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    flexDirection: isMobile ? 'column' : 'row',
    gap: isMobile ? '0.75rem' : '1rem',
    alignItems: isMobile ? 'stretch' : 'end',
    width: '100%'
  };

  return (
    <div style={containerStyle}>
      {bitDepth===0&&samples.some(sample=>sample?.isLoaded&&sample.originalBitDepth===undefined)&&<div role="status" style={{flexBasis:'100%',fontSize:'0.8rem',color:'var(--color-text-secondary)'}}>Source bit depth is unknown. “Original” uses a 16-bit output policy for OP-XY export; it does not change the stored source metadata.</div>}
      <div style={{ 
        flex: isMobile ? 'none' : '1',
        width: isMobile ? '100%' : 'auto'
      }}>
        <div style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
          sample rate
        </div>
        <Select
          id="sample-rate"
          labelText=""
          value={sampleRate.toString()}
          onChange={(e) => onSampleRateChange(e.target.value)}
          size={size}
          disabled={disabled}
          style={{ width: '100%' }}
        >
          <SelectItem value="0" text="original" />
          <SelectItem 
            value="44100" 
            text="44.1 khz" 
            disabled={disabledOptions.sampleRate['44100']}
          />
          <SelectItem 
            value="22050" 
            text="22 khz" 
            disabled={disabledOptions.sampleRate['22050']}
          />
          <SelectItem 
            value="11025" 
            text="11 khz" 
            disabled={disabledOptions.sampleRate['11025']}
          />
        </Select>
      </div>

      <div style={{ 
        flex: isMobile ? 'none' : '1',
        width: isMobile ? '100%' : 'auto'
      }}>
        <div style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
          bit depth
        </div>
        <Select
          id="bit-depth"
          labelText=""
          value={bitDepth.toString()}
          onChange={(e) => onBitDepthChange(e.target.value)}
          size={size}
          disabled={disabled}
          style={{ width: '100%' }}
        >
          <SelectItem value="0" text="original" />
          <SelectItem 
            value="24" 
            text="24-bit" 
            disabled={disabledOptions.bitDepth['24']}
          />
          <SelectItem 
            value="16" 
            text="16-bit" 
            disabled={disabledOptions.bitDepth['16']}
          />
          <SelectItem 
            value="12" 
            text="12-bit" 
            disabled={disabledOptions.bitDepth['12']}
          />
          <SelectItem 
            value="8" 
            text="8-bit" 
            disabled={disabledOptions.bitDepth['8']}
          />
        </Select>
      </div>

      <div style={{ 
        flex: isMobile ? 'none' : '1',
        width: isMobile ? '100%' : 'auto'
      }}>
        <div style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
          channels
        </div>
        <Select
          id="channels"
          labelText=""
          value={channels.toString()}
          onChange={(e) => onChannelsChange(e.target.value)}
          size={size}
          disabled={disabled}
          style={{ width: '100%' }}
        >
          <SelectItem value="0" text="original" />
          <SelectItem 
            value="1" 
            text="mono" 
            disabled={disabledOptions.channels['1']}
          />
        </Select>
      </div>
    </div>
  );
}
