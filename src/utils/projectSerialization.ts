import type { AppState, DrumSample, MultisampleFile } from '../context/AppContext';
import type { SessionData, SampleData } from './indexedDB';
import { defaultDrumSettings, defaultMultisampleSettings } from './defaultSettings';
import { decodeStoredAudio, encodeStoredAudio, restoreSourceFile } from './storedAudio';
import { framesToSeconds, normalizeSecondRanges } from './loopEditing';
import {serializeAudioBounds} from './audioAssetSerialization';

export type ProjectSnapshot = Pick<AppState, 'drumSettings' | 'multisampleSettings' | 'drumSamples' | 'multisampleFiles' | 'selectedMultisample' | 'isDrumKeyboardPinned' | 'isMultisampleKeyboardPinned' | 'importedDrumPreset' | 'importedMultisamplePreset' | 'midiNoteMapping'>;
export type RestoredProject = Omit<ProjectSnapshot, 'drumSamples'> & {drumSamples: Array<DrumSample & {originalIndex: number}>};

/** Snapshot settings immediately; immutable audio and File assets stay shared. */
export function createProjectSnapshot(state: ProjectSnapshot): ProjectSnapshot {
  return {
    drumSettings: structuredClone(state.drumSettings), multisampleSettings: structuredClone(state.multisampleSettings),
    drumSamples: (state.drumSamples ?? []).map(s => s ? {...s} : s), multisampleFiles: (state.multisampleFiles ?? []).map(s => ({...s})),
    selectedMultisample: state.selectedMultisample, isDrumKeyboardPinned: state.isDrumKeyboardPinned,
    isMultisampleKeyboardPinned: state.isMultisampleKeyboardPinned, importedDrumPreset: structuredClone(state.importedDrumPreset ?? null),
    importedMultisamplePreset: structuredClone(state.importedMultisamplePreset ?? null), midiNoteMapping: state.midiNoteMapping,
  };
}

export function serializeProject(state: ProjectSnapshot, id = 'current-session', options:{metadataOnly?:boolean}={}): {session: SessionData; samples: SampleData[]} {
  const timestamp = Date.now();
  const snapshotId = crypto.randomUUID();
  const samples: SampleData[] = [];
  const store = (sample: DrumSample | MultisampleFile, index: number, mode: string) => {
    if (!sample.audioBuffer) throw new Error('A loaded sample has no audio');
    const sampleId = `${snapshotId}-${mode}-${index}`;
    const audio = sample.audioBuffer;
    const derivedSlice = 'sliceProvenance' in sample && Boolean(sample.sliceProvenance);
    samples.push({id: sampleId, name: sample.file?.name ?? sample.name, type: sample.file?.type ?? '', size: sample.fileSize ?? sample.file?.size ?? 0,
      sourceFile: derivedSlice ? undefined : sample.file ?? undefined, sourceLastModified: sample.file?.lastModified,
      data: options.metadataOnly ? new Blob([],{type:'application/vnd.op-patchstudio.float32'}) : encodeStoredAudio(audio), createdAt: timestamp,
      metadata: {...(sample.originalSampleRate===undefined?{}:{sampleRate:sample.originalSampleRate}),...(sample.originalChannels===undefined?{}:{channels:sample.originalChannels}),
        ...(sample.originalBitDepth === undefined ? {} : {bitDepth:sample.originalBitDepth}), isFloat: sample.isFloat, duration: sample.duration ?? audio.duration}});
    return sampleId;
  };
  const drumSamples: SessionData['drumSamples'] = [];
  state.drumSamples.forEach((s, index) => { if (s?.isLoaded && s.audioBuffer) {
    const bounds=serializeAudioBounds(s.audioBuffer,{start:s.inPoint,end:s.outPoint});
    drumSamples.push({originalIndex: index, name: s.name, sampleId: store(s, index, 'drum'), isAssigned: s.isAssigned, assignedKey: s.assignedKey,
      sourceIdentity:s.sourceIdentity,sliceProvenance:s.sliceProvenance ? {...s.sliceProvenance} : undefined,
      settings: {inPoint:bounds.sample.start,outPoint:bounds.sample.end,playmode:s.playmode, reverse:s.reverse, transpose:s.transpose, pan:s.pan, gain:s.gain, hasBeenEdited:s.hasBeenEdited}});
  } });
  const multisampleFiles: SessionData['multisampleFiles'] = [];
  state.multisampleFiles.forEach((s, index) => { if (s.isLoaded && s.audioBuffer) {
    const bounds=serializeAudioBounds(s.audioBuffer,{start:s.inPoint,end:s.outPoint},{start:s.loopStart,end:s.loopEnd});
    multisampleFiles.push({sampleId:store(s,index,'multi'), name:s.name, fileName:s.file?.name ?? s.name, sourceIdentity:s.sourceIdentity, rootNote:s.rootNote, note:s.note,
      inPoint:bounds.sample.start,outPoint:bounds.sample.end,
      loopStart:bounds.loop!.start,loopEnd:bounds.loop!.end,loopCrossfade:s.loopCrossfade?{...s.loopCrossfade}:undefined});
  } });
  return {samples, session: {id,timestamp,version:2,drumSamples,multisampleFiles,
    drumSettings:state.drumSettings,multisampleSettings:state.multisampleSettings,selectedMultisample:state.selectedMultisample,
    isDrumKeyboardPinned:state.isDrumKeyboardPinned,isMultisampleKeyboardPinned:state.isMultisampleKeyboardPinned,
    importedDrumPreset:state.importedDrumPreset,importedMultisamplePreset:state.importedMultisamplePreset,midiNoteMapping:state.midiNoteMapping,savedToLibrary:false}};
}

export async function decodeSampleData(data: SampleData) {
  const audioBuffer = await decodeStoredAudio(data.data);
  const file = restoreSourceFile(data.sourceFile ?? (data.data.type !== 'application/json' && !data.data.type.includes('op-patchstudio') ? data.data : undefined), data.name, data.data, audioBuffer, data.sourceLastModified);
  return {file, audioBuffer, metadata: {...data.metadata, fileSize:data.size}};
}

export function restoreProjectSettings(data: Partial<SessionData>) {
  return {
    drumSettings: {...defaultDrumSettings, ...data.drumSettings, presetSettings: {...defaultDrumSettings.presetSettings, ...data.drumSettings?.presetSettings}},
    multisampleSettings: {...defaultMultisampleSettings, ...data.multisampleSettings,
      ampEnvelope: {...defaultMultisampleSettings.ampEnvelope, ...data.multisampleSettings?.ampEnvelope}, filterEnvelope:{...defaultMultisampleSettings.filterEnvelope,...data.multisampleSettings?.filterEnvelope}},
    importedDrumPreset: data.importedDrumPreset ?? null, importedMultisamplePreset: data.importedMultisamplePreset ?? null,
    midiNoteMapping: data.midiNoteMapping ?? 'C3', selectedMultisample:data.selectedMultisample ?? null,
    isDrumKeyboardPinned:data.isDrumKeyboardPinned ?? false,isMultisampleKeyboardPinned:data.isMultisampleKeyboardPinned ?? false,
  };
}

export async function deserializeProject(session: SessionData, getSample: (id:string) => Promise<SampleData | null>): Promise<RestoredProject> {
  if (session.version !== undefined && session.version > 2) throw new Error('This project requires a newer application version');
  if (!Array.isArray(session.drumSamples) || !Array.isArray(session.multisampleFiles)) throw new Error('Invalid project sample references');
  const load = async (id: string) => {
    const data = await getSample(id);
    if (!data) throw new Error(`Missing saved sample: ${id}`);
    const decoded = await decodeSampleData(data);
    return {file:decoded.file,audioBuffer:decoded.audioBuffer,isLoaded:true,originalSampleRate:decoded.metadata.sampleRate,
      originalChannels:decoded.metadata.channels,originalBitDepth:decoded.metadata.bitDepth,isFloat:decoded.metadata.isFloat,
      fileSize:decoded.metadata.fileSize,duration:decoded.metadata.duration};
  };
  const seen = new Set<number>();
  const drumSamples = await Promise.all(session.drumSamples.map(async s => {
    if (!Number.isInteger(s.originalIndex) || s.originalIndex < 0 || s.originalIndex > 100000 || seen.has(s.originalIndex)) throw new Error('Invalid drum sample index');
    seen.add(s.originalIndex);
    const decoded = await load(s.sampleId);
    const bounds=normalizeSecondRanges(decoded.audioBuffer.length,decoded.audioBuffer.sampleRate,{start:s.settings.inPoint,end:s.settings.outPoint});
    return {...decoded,...s.settings,inPoint:framesToSeconds(bounds.sample.start,decoded.audioBuffer.sampleRate),outPoint:framesToSeconds(bounds.sample.end,decoded.audioBuffer.sampleRate),name:s.name ?? decoded.file.name, originalIndex:s.originalIndex,isAssigned:s.isAssigned,assignedKey:s.assignedKey,
      sourceIdentity:s.sourceIdentity,sliceProvenance:s.sliceProvenance ? {...s.sliceProvenance} : undefined};
  }));
  const multisampleFiles = await Promise.all(session.multisampleFiles.map(async s => {
    const decoded = await load(s.sampleId);
    const bounds=normalizeSecondRanges(decoded.audioBuffer.length,decoded.audioBuffer.sampleRate,{start:s.inPoint,end:s.outPoint},{start:s.loopStart,end:s.loopEnd});
    return {...decoded,name:s.name ?? s.fileName,sourceIdentity:s.sourceIdentity,rootNote:s.rootNote,note:s.note,
      inPoint:framesToSeconds(bounds.sample.start,decoded.audioBuffer.sampleRate),outPoint:framesToSeconds(bounds.sample.end,decoded.audioBuffer.sampleRate),
      loopStart:framesToSeconds(bounds.loop.start,decoded.audioBuffer.sampleRate),loopEnd:framesToSeconds(bounds.loop.end,decoded.audioBuffer.sampleRate),loopCrossfade:s.loopCrossfade?{...s.loopCrossfade}:undefined};
  }));
  return {...restoreProjectSettings(session),drumSamples,multisampleFiles};
}
