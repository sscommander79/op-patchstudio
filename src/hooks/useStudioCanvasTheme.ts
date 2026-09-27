import { useEffect, useMemo, useState } from 'react';

export interface StudioCanvasColors {
  outside:string;
  inside:string;
  waveform:string;
  secondary:string;
  accent:string;
}

function cssColor(name:string,fallback:string) {
  if(typeof document==='undefined')return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()||fallback;
}

export function readStudioCanvasColors():StudioCanvasColors {
  return {
    outside:cssColor('--studio-recess','#f0f0f0'),
    inside:cssColor('--studio-panel','#ffffff'),
    waveform:cssColor('--studio-text','#333333'),
    secondary:cssColor('--studio-muted','#555555'),
    accent:cssColor('--studio-accent','#d97706'),
  };
}

/** Canvas pixels do not inherit CSS variables, so theme changes must trigger a redraw. */
export function useStudioCanvasThemeRevision() {
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    const redraw=()=>setRevision(value=>value+1);
    window.addEventListener('opstudio-theme-change',redraw);
    return()=>window.removeEventListener('opstudio-theme-change',redraw);
  },[]);
  return revision;
}

export function useStudioCanvasColors(): StudioCanvasColors {
  const revision=useStudioCanvasThemeRevision();
  return useMemo(()=>{
    void revision;
    return readStudioCanvasColors();
  },[revision]);
}
