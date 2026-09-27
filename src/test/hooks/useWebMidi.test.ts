import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWebMidi } from '../../hooks/useWebMidi';

const midi=vi.hoisted(()=>({
  supported:true,enabled:false,inputs:[],outputs:[],
  enable:vi.fn(async()=>{throw new DOMException('permission denied','NotAllowedError');}),
  addListener:vi.fn(),removeListener:vi.fn(),
}));
vi.mock('webmidi',()=>({WebMidi:midi,Input:class{},Output:class{}}));

describe('useWebMidi initialization ownership',()=>{
  beforeEach(()=>{midi.enabled=false;midi.enable.mockClear();});

  it('allows one automatic permission attempt across hook instances and preserves explicit retry',async()=>{
    const first=renderHook(()=>useWebMidi()),second=renderHook(()=>useWebMidi());
    await act(async()=>{expect(await first.result.current.initialize({automatic:true})).toBe(false);});
    await act(async()=>{expect(await second.result.current.initialize({automatic:true})).toBe(false);});
    expect(midi.enable).toHaveBeenCalledOnce();
    expect(first.result.current.state.error).toBe('permission denied');

    await act(async()=>{expect(await second.result.current.initialize()).toBe(false);});
    expect(midi.enable).toHaveBeenCalledTimes(2);
    first.unmount();second.unmount();
  });
});
