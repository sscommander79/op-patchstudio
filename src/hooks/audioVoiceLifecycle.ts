export interface VoiceNodes {
  source: AudioBufferSourceNode;
  gain: GainNode;
  panner: StereoPannerNode;
}

export interface FadeTimerTracker {
  fadeInterval?: number;
  fadeTimeoutProtection?: number;
  cleanupTimer?: number;
}

export class VoiceTimerRegistry {
  private readonly fadeTimers=new Map<symbol,FadeTimerTracker>();

  set(owner:symbol,timers:FadeTimerTracker) { this.clear(owner);this.fadeTimers.set(owner,timers); }
  delete(owner:symbol) { this.fadeTimers.delete(owner); }

  clear(owner:symbol) {
    const timers=this.fadeTimers.get(owner);
    if(!timers)return;
    if(timers.fadeInterval!==undefined)window.clearInterval(timers.fadeInterval);
    if(timers.fadeTimeoutProtection!==undefined)window.clearTimeout(timers.fadeTimeoutProtection);
    if(timers.cleanupTimer!==undefined)window.clearTimeout(timers.cleanupTimer);
    this.fadeTimers.delete(owner);
  }

  clearAll() {
    for(const owner of [...this.fadeTimers.keys()])this.clear(owner);
  }
}

export function disconnectVoiceNodes({source,gain,panner}:VoiceNodes) {
  source.onended=null;
  for(const node of [source,gain,panner]) {
    try { node.disconnect(); } catch { /* already disconnected */ }
  }
}
