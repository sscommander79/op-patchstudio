import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AudioFormatControls } from '../../components/common/AudioFormatControls';

describe('AudioFormatControls project preservation', () => {
  it('explains the output fallback without assigning a fake source depth',()=>{
    render(<AudioFormatControls sampleRate={0} bitDepth={0} channels={0} onSampleRateChange={vi.fn()} onBitDepthChange={vi.fn()} onChannelsChange={vi.fn()} samples={[{isLoaded:true,originalBitDepth:undefined}]}/>);
    expect(screen.getByText(/source bit depth is unknown.*16-bit output/i)).toBeInTheDocument();
  });
  it('does not rewrite configured conversion settings when loaded audio changes available options', () => {
    const onSampleRateChange=vi.fn(),onBitDepthChange=vi.fn(),onChannelsChange=vi.fn();
    const common={sampleRate:22050,bitDepth:24,channels:1,onSampleRateChange,onBitDepthChange,onChannelsChange,
      normalize:false,normalizeLevel:-3,onNormalizeChange:vi.fn(),onNormalizeLevelChange:vi.fn(),autoZeroCrossing:false,onAutoZeroCrossingChange:vi.fn()};
    const view=render(<AudioFormatControls {...common} samples={[]}/>);
    view.rerender(<AudioFormatControls {...common} samples={[{isLoaded:true,originalSampleRate:16_000,originalBitDepth:16,originalChannels:1}]}/>);
    expect(onSampleRateChange).not.toHaveBeenCalled();
    expect(onBitDepthChange).not.toHaveBeenCalled();
    expect(onChannelsChange).not.toHaveBeenCalled();
    expect(screen.getByRole('option',{name:'22 khz'})).not.toBeDisabled();
    expect(screen.getByRole('option',{name:'24-bit'})).not.toBeDisabled();
    expect(screen.getByRole('option',{name:'mono'})).not.toBeDisabled();
  });
});
