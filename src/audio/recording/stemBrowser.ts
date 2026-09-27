export interface StemMidiOutput {
  id:string; name:string; state:string; send:(data:number[]|Uint8Array,timestamp?:number)=>void; clear:()=>void;
}

export interface StemMidiAccess {
  outputs:Map<string,StemMidiOutput>; addEventListener:(type:'statechange',listener:(event:Event)=>void)=>void; removeEventListener:(type:'statechange',listener:(event:Event)=>void)=>void;
}

export function stemBrowserSupport() {
  const midiNavigator=navigator as Navigator&{requestMIDIAccess?:(options:{sysex:boolean})=>Promise<StemMidiAccess>};
  return {secure:window.isSecureContext!==false,audio:!!navigator.mediaDevices?.getUserMedia,worklet:typeof AudioWorkletNode!=='undefined',midi:typeof midiNavigator.requestMIDIAccess==='function'};
}

export async function requestStemMidiAccess() {
  const request=(navigator as Navigator&{requestMIDIAccess?:(options:{sysex:boolean})=>Promise<StemMidiAccess>}).requestMIDIAccess;
  if(!request)throw new Error('Web MIDI is unavailable. Use Chrome or Edge on HTTPS.');
  return request.call(navigator,{sysex:false});
}

export async function listStemAudioInputs() {
  if(!navigator.mediaDevices?.enumerateDevices)return [];
  const devices=await navigator.mediaDevices.enumerateDevices();let index=0;
  return devices.filter(device=>device.kind==='audioinput').map(device=>({deviceId:device.deviceId,label:device.label||`Input ${++index}`}));
}
