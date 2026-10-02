import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EnhancedWaveformEditor } from '../../components/common/EnhancedWaveformEditor';

function audio(values: number[]): AudioBuffer {
  const result = new AudioBuffer({ numberOfChannels: 1, length: values.length, sampleRate: 8_000 });
  result.copyToChannel(Float32Array.from(values), 0);
  return result;
}

function rect(width: number): DOMRect {
  return { x: 0, y: 0, top: 0, right: width, bottom: 80, left: 0, width, height: 80, toJSON: () => ({}) };
}

describe('EnhancedWaveformEditor marker bounds', () => {
  it('searches in both directions when snapping a dragged marker', () => {
    const values = new Array(2_000).fill(0.5);
    values[795] = 0;
    values[805] = 0;
    const onMarkersChange = vi.fn();
    const { container } = render(<EnhancedWaveformEditor audioBuffer={audio(values)} inPoint={0} outPoint={2_000} onMarkersChange={onMarkersChange} />);
    const canvas = container.querySelector('canvas')!;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(rect(2_000));

    fireEvent.mouseDown(canvas, { clientX: 0 });
    fireEvent.mouseMove(canvas, { clientX: 800 });

    expect(onMarkersChange).toHaveBeenLastCalledWith({ inPoint: 795, outPoint: 2_000 });
    fireEvent.mouseUp(canvas);fireEvent.click(screen.getByRole('checkbox',{name:'snap to zero'}));fireEvent.mouseDown(canvas,{clientX:0});fireEvent.mouseMove(canvas,{clientX:800});expect(onMarkersChange).toHaveBeenLastCalledWith({inPoint:800,outPoint:2_000});fireEvent.mouseUp(canvas);
  });

  it('keeps marker ranges valid for clips shorter than the normal minimum gap', () => {
    const onMarkersChange = vi.fn();
    const { container } = render(<EnhancedWaveformEditor audioBuffer={audio(new Array(16).fill(0.5))} inPoint={0} outPoint={16} onMarkersChange={onMarkersChange} defaultSnapToZero={false} />);
    const canvas = container.querySelector('canvas')!;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(rect(160));

    fireEvent.mouseDown(canvas, { clientX: 0 });
    fireEvent.mouseMove(canvas, { clientX: 80 });
    expect(onMarkersChange).toHaveBeenLastCalledWith({ inPoint: 0, outPoint: 16 });
    fireEvent.mouseUp(canvas);

    fireEvent.mouseDown(canvas, { clientX: 160 });
    fireEvent.mouseMove(canvas, { clientX: 80 });
    expect(onMarkersChange).toHaveBeenLastCalledWith({ inPoint: 0, outPoint: 16 });
  });
});
