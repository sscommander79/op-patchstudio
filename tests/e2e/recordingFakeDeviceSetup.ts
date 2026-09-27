import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export default async function recordingFakeDeviceSetup() {
  const configured=process.env.PLAYWRIGHT_FAKE_AUDIO_FILE;if(!configured)return;
  const path=resolve(configured),sampleRate=48_000,frames=sampleRate*6,bytes=Buffer.alloc(44+frames*2);
  bytes.write('RIFF',0);bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);
  bytes.writeUInt32LE(sampleRate,24);bytes.writeUInt32LE(sampleRate*2,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(frames*2,40);
  for(let frame=0;frame<frames;frame+=1){const burst=[1,2,3,4].some(start=>frame>=start*sampleRate&&frame<(start+.1)*sampleRate),amplitude=burst?.7:.005;bytes.writeInt16LE(Math.round(32767*amplitude*Math.sin(frame*.17)),44+frame*2);}
  await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes);
}
