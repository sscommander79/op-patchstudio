import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InstrumentJourney } from '../../components/common/InstrumentJourney';
import { AudioImportContext } from '../../components/common/AudioImportContext';

describe('Instrument source journeys', () => {
  it('adds files to the multisample import review without opening recording or assigning an invented note', () => {
    const beginFiles=vi.fn(),onRecord=vi.fn(),onOpenEditor=vi.fn();
    render(<AudioImportContext.Provider value={{beginFiles,beginDrop:vi.fn()}}><InstrumentJourney onRecord={onRecord} onOpenEditor={onOpenEditor}/></AudioImportContext.Provider>);
    const input=screen.getByLabelText('Instrument audio files');
    expect(input).not.toHaveAttribute('multiple');
    const file=new File(['audio'],'tone.wav',{type:'audio/wav'});
    fireEvent.change(input,{target:{files:[file]}});
    expect(beginFiles).toHaveBeenCalledWith([file],{instrument:'multisample'});
    expect(onOpenEditor).toHaveBeenCalledOnce();expect(onRecord).not.toHaveBeenCalled();
  });
  it('supports a set and keeps its distinct explanation without requiring connections', () => {
    render(<InstrumentJourney onRecord={vi.fn()} onOpenEditor={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:/A set of recorded notes/}));
    expect(screen.getByLabelText('Instrument audio files')).toHaveAttribute('multiple');
    expect(screen.getByRole('button',{name:'Add recorded notes'})).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Connect and check sound'})).not.toBeInTheDocument();
  });
  it.each(['software','hardware'] as const)('passes %s source into the recording journey only on deliberate start', source=>{
    const onRecord=vi.fn();render(<InstrumentJourney onRecord={onRecord} onOpenEditor={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:source==='software'?/A software instrument/:/A hardware instrument/}));
    expect(onRecord).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Connect and check sound'}));expect(onRecord).toHaveBeenCalledWith(source);
  });
});
