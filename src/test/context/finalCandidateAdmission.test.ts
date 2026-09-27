import JSZip from 'jszip';
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appReducer, initialState, type AppState } from '../../context/AppContext';
import { prepareRecordingApplication } from '../../utils/recordingApplication';
import { prepareSliceApplication } from '../../utils/audioSlicing';
import { createHistory, reduceHistory } from '../../utils/projectHistory';
import { createProjectSnapshot } from '../../utils/projectSerialization';
import { PROJECT_ARCHIVE_LIMITS, PROJECT_ARCHIVE_MANIFEST, exportProjectArchive, validateProjectArchiveMetadata } from '../../utils/projectArchive';

const PositionalAudioBuffer = globalThis.AudioBuffer as unknown as new(channels:number,length:number,sampleRate:number)=>AudioBuffer;

beforeEach(() => {
  vi.stubGlobal('Blob', NodeBlob);
  vi.stubGlobal('File', NodeFile);
  vi.stubGlobal('AudioBuffer', class extends PositionalAudioBuffer {
    constructor(options:AudioBufferOptions) { super(options.numberOfChannels ?? 1, options.length, options.sampleRate); }
  });
});
afterEach(() => vi.unstubAllGlobals());

function audio(frames=8) {
  const buffer=new AudioContext().createBuffer(1,frames,8_000);
  buffer.getChannelData(0).fill(Math.fround(0.125));
  return buffer;
}

function stateAtExactManifestLimit():AppState {
  return {
    ...initialState,
    drumSamples:initialState.drumSamples.map(sample=>({...sample})),
    importedDrumPreset:{type:'drum',admissionProbe:'x'.repeat(2_095_959)},
  };
}

async function exactManifestBytes(state:AppState) {
  const archive=await exportProjectArchive(createProjectSnapshot(state));
  const zip=await JSZip.loadAsync(new Uint8Array(await archive.arrayBuffer()));
  return (await zip.file(PROJECT_ARCHIVE_MANIFEST)!.async('uint8array')).byteLength;
}

describe('final portable-project admission', () => {
  it('rejects a recording that pushes an exactly admitted manifest over the limit without changing project, history, or review assets', async () => {
    const before=stateAtExactManifestLimit();
    expect(()=>validateProjectArchiveMetadata(createProjectSnapshot(before))).not.toThrow();
    expect(await exactManifestBytes(before)).toBe(PROJECT_ARCHIVE_LIMITS.manifestBytes);
    const prepared=await prepareRecordingApplication({
      instrument:'drum',takes:[{id:'take-1',name:'Boundary take',audioBuffer:audio(),rootNote:60}],state:before,target:{kind:'drum'},
    });
    const retainedAsset=prepared.assets[0];
    const history=reduceHistory(createHistory(before),{type:'COMMIT_PREPARED_RECORDINGS',payload:{operationId:'manifest-recording',prepared}},appReducer);

    expect(history.present.recordingCommitResult).toMatchObject({operationId:'manifest-recording',status:'rejected',error:expect.stringMatching(/manifest.*large/i)});
    expect(history.present.drumSamples).toBe(before.drumSamples);
    expect(history.present.multisampleFiles).toBe(before.multisampleFiles);
    expect(history.past).toHaveLength(0);
    expect(prepared.assets).toEqual([retainedAsset]);
    await expect(exportProjectArchive(createProjectSnapshot(history.present))).resolves.toBeInstanceOf(Blob);

    const valid={...initialState,drumSamples:initialState.drumSamples.map(sample=>({...sample}))};
    const validPrepared=await prepareRecordingApplication({
      instrument:'drum',takes:[{id:'valid-take',name:'Valid take',audioBuffer:audio(),rootNote:60}],state:valid,target:{kind:'drum'},
    });
    const accepted=appReducer(valid,{type:'COMMIT_PREPARED_RECORDINGS',payload:{operationId:'valid-recording',prepared:validPrepared}});
    expect(accepted.recordingCommitResult).toMatchObject({status:'committed',appliedIds:['valid-take']});
    await expect(exportProjectArchive(createProjectSnapshot(accepted))).resolves.toBeInstanceOf(Blob);
  });

  it('rejects slices that push an exactly admitted manifest over the limit without changing project, history, or prepared assets', async () => {
    const before=stateAtExactManifestLimit(),source=audio();
    expect(()=>validateProjectArchiveMetadata(createProjectSnapshot(before))).not.toThrow();
    expect(await exactManifestBytes(before)).toBe(PROJECT_ARCHIVE_LIMITS.manifestBytes);
    const file=new File([new Uint8Array([1,2,3,4])],'boundary.wav',{type:'audio/wav'});
    const metadata={format:'wav' as const,sampleRate:8_000,sourceSampleRate:8_000,bitDepth:16,channels:1,sourceChannels:1,duration:source.duration,fileSize:file.size,isFloat:false,audioBuffer:source,midiNote:60,loopStart:0,loopEnd:source.duration,hasLoopData:false};
    const prepared=await prepareSliceApplication({
      source:{audioBuffer:source,file,metadata,existingIndex:null},ranges:[{start:0,end:4}],existingSamples:before.drumSamples,
      projectAssets:[...before.drumSamples,...before.multisampleFiles],allocator:(channels,frames,sampleRate)=>new AudioContext().createBuffer(channels,frames,sampleRate),
    });
    const retainedActions=prepared.actions;
    const history=reduceHistory(createHistory(before),{type:'COMMIT_PREPARED_SLICES',payload:{operationId:'manifest-slice',prepared}},appReducer);

    expect(history.present.sliceCommitResult).toMatchObject({operationId:'manifest-slice',status:'rejected',error:expect.stringMatching(/manifest.*large/i)});
    expect(history.present.drumSamples).toBe(before.drumSamples);
    expect(history.present.multisampleFiles).toBe(before.multisampleFiles);
    expect(history.past).toHaveLength(0);
    expect(prepared.actions).toBe(retainedActions);
    await expect(exportProjectArchive(createProjectSnapshot(history.present))).resolves.toBeInstanceOf(Blob);

    const valid={...initialState,drumSamples:initialState.drumSamples.map(sample=>({...sample}))};
    const validPrepared=await prepareSliceApplication({
      source:{audioBuffer:source,file,metadata,existingIndex:null},ranges:[{start:0,end:4}],existingSamples:valid.drumSamples,
      projectAssets:[...valid.drumSamples,...valid.multisampleFiles],allocator:(channels,frames,sampleRate)=>new AudioContext().createBuffer(channels,frames,sampleRate),
    });
    const accepted=appReducer(valid,{type:'COMMIT_PREPARED_SLICES',payload:{operationId:'valid-slice',prepared:validPrepared}});
    expect(accepted.sliceCommitResult).toMatchObject({status:'committed',assignedCount:1,overflowCount:0});
    await expect(exportProjectArchive(createProjectSnapshot(accepted))).resolves.toBeInstanceOf(Blob);
  });
});
