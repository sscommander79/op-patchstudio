import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudioThemeProvider } from '../../context/StudioThemeContext';
import { useStudioTheme } from '../../context/StudioTheme';
import { FirstPresetGuide } from '../../components/drum/StudioDemoLoader';

const guideState=vi.hoisted(()=>({
  drumSamples: [] as Array<{hasBeenEdited?:boolean}>,
  studioSeedCommitResult: {status:'committed'} as {status:string},
}));

vi.mock('../../context/AppContext',()=>({useAppContext:()=>({state:guideState})}));

function ThemeControl(){
  const {preference,setPreference}=useStudioTheme();
  return <button type="button" onClick={()=>setPreference('dark')}>Theme is {preference}</button>;
}

afterEach(()=>vi.restoreAllMocks());

describe('presentation preferences with blocked storage',()=>{
  it('renders and changes theme using memory when localStorage throws',()=>{
    vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new DOMException('blocked','SecurityError');});
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('blocked','SecurityError');});
    render(<StudioThemeProvider><ThemeControl/></StudioThemeProvider>);
    fireEvent.click(screen.getByRole('button',{name:'Theme is system'}));
    expect(screen.getByRole('button',{name:'Theme is dark'})).toBeInTheDocument();
    expect(document.documentElement.dataset.studioTheme).toBe('dark');
  });

  it('shows and dismisses the first-preset guide for the session when storage throws',()=>{
    vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new DOMException('blocked','SecurityError');});
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('blocked','SecurityError');});
    render(<FirstPresetGuide/>);
    expect(screen.getByLabelText('First preset guide')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Dismiss guide'}));
    expect(screen.queryByLabelText('First preset guide')).not.toBeInTheDocument();
  });
});
