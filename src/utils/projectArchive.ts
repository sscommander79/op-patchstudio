import JSZip from 'jszip';
import type { AppState } from '../context/AppContext';
import type { SampleData, SessionData } from './indexedDB';
import { defaultDrumSettings, defaultMultisampleSettings } from './defaultSettings';
import { deserializeProject, serializeProject, type ProjectSnapshot, type RestoredProject } from './projectSerialization';

export const PROJECT_ARCHIVE_MANIFEST = 'manifest.json';
export const PROJECT_ARCHIVE_TYPE = 'application/vnd.op-patchstudio.project+zip';
export const PROJECT_ARCHIVE_VERSION = 1;
export const PROJECT_ARCHIVE_LIMITS = {
  archiveBytes: 256 * 1024 * 1024,
  entries: 520,
  entryBytes: 128 * 1024 * 1024,
  uncompressedBytes: 256 * 1024 * 1024,
  manifestBytes: 2 * 1024 * 1024,
  samples: 256,
  decodedAudioBytes: 128 * 1024 * 1024,
  drumSlots: 512,
} as const;

type JsonRecord = Record<string, unknown>;
type ArchiveSample = Omit<SampleData, 'data' | 'sourceFile' | 'createdAt'> & {
  audioPath:string;
  sourcePath?:string;
  audio:{bytes:number;channels:number;frames:number;sampleRate:number};
};
interface ArchiveManifestV1 {
  format:'op-patchstudio-project';
  version:1;
  project:Omit<SessionData, 'id' | 'timestamp' | 'version' | 'savedToLibrary'>;
  samples:ArchiveSample[];
}
interface ZipEntryInfo {name:string; compressedSize:number; uncompressedSize:number; method:number; localOffset:number; directory:boolean}

function archiveProject(session:SessionData):ArchiveManifestV1['project'] {return {
  drumSettings:session.drumSettings,multisampleSettings:session.multisampleSettings,drumSamples:session.drumSamples,
  multisampleFiles:session.multisampleFiles,selectedMultisample:session.selectedMultisample,
  isDrumKeyboardPinned:session.isDrumKeyboardPinned,isMultisampleKeyboardPinned:session.isMultisampleKeyboardPinned,
  importedDrumPreset:session.importedDrumPreset,importedMultisamplePreset:session.importedMultisamplePreset,midiNoteMapping:session.midiNoteMapping,
};}

function encodeManifest(manifest:ArchiveManifestV1):string {
  const json=JSON.stringify(manifest);
  if(new TextEncoder().encode(json).length>PROJECT_ARCHIVE_LIMITS.manifestBytes)throw new Error('Project manifest is too large');
  validateJson(JSON.parse(json),'project manifest');
  return json;
}

function isRecord(value:unknown):value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function requireSafeInteger(value:unknown, min:number, max:number, label:string):number {
  if(!Number.isSafeInteger(value) || (value as number)<min || (value as number)>max) throw new Error(`Invalid ${label}`);
  return value as number;
}

function requireFinite(value:unknown, label:string):number {
  if(typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid ${label}`);
  return value;
}

function requireString(value:unknown, label:string, max=1024):string {
  if(typeof value !== 'string' || !value.length || value.length>max) throw new Error(`Invalid ${label}`);
  return value;
}

function validateJson(value:unknown, label:string, depth=0):void {
  if(depth>32) throw new Error(`${label} is too deeply nested`);
  if(value===null || typeof value==='string' || typeof value==='boolean') return;
  if(typeof value==='number') { requireFinite(value,label); return; }
  if(Array.isArray(value)) { if(value.length>10000) throw new Error(`${label} contains too many values`); value.forEach((item,index)=>validateJson(item,`${label}[${index}]`,depth+1)); return; }
  if(!isRecord(value) || Object.keys(value).length>10000) throw new Error(`Invalid ${label}`);
  for(const [key,item] of Object.entries(value)) { if(key.length>1024) throw new Error(`Invalid ${label} key`); validateJson(item,`${label}.${key}`,depth+1); }
}

function validateLike(value:unknown, template:unknown, label:string):void {
  if(typeof template==='number') { requireFinite(value,label); return; }
  if(typeof template==='string' || typeof template==='boolean') { if(typeof value!==typeof template) throw new Error(`Invalid ${label}`); return; }
  if(isRecord(template)) {
    if(!isRecord(value)) throw new Error(`Invalid ${label}`);
    for(const [key,item] of Object.entries(template)) validateLike(value[key],item,`${label}.${key}`);
    validateJson(value,label);
    return;
  }
  throw new Error(`Invalid ${label}`);
}

function validateSettings(project:JsonRecord):void {
  validateLike(project.drumSettings,defaultDrumSettings,'drum settings');
  validateLike(project.multisampleSettings,defaultMultisampleSettings,'multisample settings');
  const drum=project.drumSettings as AppState['drumSettings'];
  const multi=project.multisampleSettings as AppState['multisampleSettings'];
  for(const [label,settings] of [['drum',drum],['multisample',multi]] as const) {
    if(![0,11025,22050,44100].includes(settings.sampleRate)) throw new Error(`Invalid ${label} sample rate`);
    if(![0,8,12,16,24].includes(settings.bitDepth)) throw new Error(`Invalid ${label} bit depth`);
    if(![0,1,2].includes(settings.channels)) throw new Error(`Invalid ${label} channels`);
    if(!['wav','aiff'].includes(settings.audioFormat)) throw new Error(`Invalid ${label} audio format`);
    if(![' ','-'].includes(settings.filenameSeparator)) throw new Error(`Invalid ${label} filename separator`);
  }
  if(!['poly','mono','legato'].includes(drum.presetSettings.playmode) || !['poly','mono','legato'].includes(multi.playmode) ||
     !['linear','exponential'].includes(multi.portamentoType)) throw new Error('Invalid project play mode setting');
  for(const envelope of [multi.ampEnvelope,multi.filterEnvelope]) for(const [key,value] of Object.entries(envelope)) requireSafeInteger(value,0,32767,`envelope ${key}`);
}

function safeArchivePath(value:unknown,label:string):string {
  const path=requireString(value,label,512);
  if(path.includes('\\') || path.includes('\0') || path.startsWith('/') || /^[a-z]:/i.test(path) || path.split('/').some(part=>!part || part==='.' || part==='..')) throw new Error(`Unsafe archive path: ${path}`);
  return path;
}

function findEocd(bytes:Uint8Array):number {
  const min=Math.max(0,bytes.length-65557);
  for(let offset=bytes.length-22;offset>=min;offset--) {
    if(new DataView(bytes.buffer,bytes.byteOffset+offset,4).getUint32(0,true)===0x06054b50) {
      const comment=new DataView(bytes.buffer,bytes.byteOffset+offset,22).getUint16(20,true);
      if(offset+22+comment===bytes.length) return offset;
    }
  }
  throw new Error('Invalid ZIP end record');
}

function decodeName(bytes:Uint8Array):string {
  try { return new TextDecoder('utf-8',{fatal:true}).decode(bytes); }
  catch { throw new Error('Invalid ZIP entry name'); }
}

/** Inspect the central directory before JSZip is allowed to inflate any entry. */
function inspectZip(bytes:Uint8Array):Map<string,ZipEntryInfo> {
  const eocd=findEocd(bytes),end=new DataView(bytes.buffer,bytes.byteOffset+eocd,22);
  const disk=end.getUint16(4,true),centralDisk=end.getUint16(6,true),diskEntries=end.getUint16(8,true),entryCount=end.getUint16(10,true);
  const centralSize=end.getUint32(12,true),centralOffset=end.getUint32(16,true);
  if(disk!==0 || centralDisk!==0 || diskEntries!==entryCount || entryCount===0xffff || centralSize===0xffffffff || centralOffset===0xffffffff) throw new Error('Unsupported multi-disk or ZIP64 project archive');
  if(entryCount<1 || entryCount>PROJECT_ARCHIVE_LIMITS.entries || centralOffset+centralSize>eocd) throw new Error('Project archive has invalid entry dimensions');
  const found=new Map<string,ZipEntryInfo>(),folded=new Set<string>(); let offset=centralOffset,total=0;
  for(let index=0;index<entryCount;index++) {
    if(offset+46>bytes.length) throw new Error('Truncated ZIP directory');
    const view=new DataView(bytes.buffer,bytes.byteOffset+offset,46);
    if(view.getUint32(0,true)!==0x02014b50) throw new Error('Invalid ZIP directory entry');
    const flags=view.getUint16(8,true),method=view.getUint16(10,true),compressedSize=view.getUint32(20,true),uncompressedSize=view.getUint32(24,true);
    const nameLength=view.getUint16(28,true),extraLength=view.getUint16(30,true),commentLength=view.getUint16(32,true),localOffset=view.getUint32(42,true);
    const endOffset=offset+46+nameLength+extraLength+commentLength;
    if(endOffset>bytes.length || (flags&~0x0800)!==0 || method!==0 || compressedSize!==uncompressedSize || compressedSize===0xffffffff) throw new Error('Project archive v1 only supports uncompressed STORE entries');
    const name=decodeName(bytes.subarray(offset+46,offset+46+nameLength));
    safeArchivePath(name.endsWith('/')?name.slice(0,-1):name,'ZIP entry');
    const foldedName=name.toLocaleLowerCase('en-US');
    if(found.has(name) || folded.has(foldedName)) throw new Error(`Duplicate archive path: ${name}`);
    if(uncompressedSize>PROJECT_ARCHIVE_LIMITS.entryBytes) throw new Error(`Archive entry is too large: ${name}`);
    total+=uncompressedSize;
    if(!Number.isSafeInteger(total) || total>PROJECT_ARCHIVE_LIMITS.uncompressedBytes) throw new Error('Project archive expands beyond the size limit');
    if(localOffset+30>bytes.length) throw new Error('Invalid ZIP local entry');
    const local=new DataView(bytes.buffer,bytes.byteOffset+localOffset,30);
    if(local.getUint32(0,true)!==0x04034b50 || local.getUint16(6,true)!==flags || local.getUint16(8,true)!==method || local.getUint32(18,true)!==compressedSize || local.getUint32(22,true)!==uncompressedSize || local.getUint32(14,true)!==view.getUint32(16,true)) throw new Error('Mismatched ZIP local entry');
    const localNameLength=local.getUint16(26,true),localExtraLength=local.getUint16(28,true);
    if(localOffset+30+localNameLength+localExtraLength+compressedSize>bytes.length || decodeName(bytes.subarray(localOffset+30,localOffset+30+localNameLength))!==name) throw new Error('Mismatched ZIP entry name or size');
    found.set(name,{name,compressedSize,uncompressedSize,method,localOffset,directory:name.endsWith('/')});
    folded.add(foldedName); offset=endOffset;
  }
  if(offset!==centralOffset+centralSize) throw new Error('Invalid ZIP central directory size');
  return found;
}

function inspectAudio(bytes:Uint8Array,label:string) {
  if(bytes.byteLength<24) throw new Error(`Truncated audio payload: ${label}`);
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(view.getUint32(0,true)!==0x5341504f || view.getUint32(4,true)!==1) throw new Error(`Invalid stored audio header: ${label}`);
  const channels=view.getUint32(8,true),frames=view.getUint32(12,true),sampleRate=view.getFloat64(16,true);
  const expected=24+channels*frames*4;
  if(channels<1 || channels>32 || frames<1 || !Number.isSafeInteger(expected) || expected!==bytes.byteLength || !Number.isFinite(sampleRate) || sampleRate<8000 || sampleRate>768000) throw new Error(`Invalid stored audio dimensions: ${label}`);
  for(let offset=24;offset<bytes.length;offset+=4) if(!Number.isFinite(view.getFloat32(offset,true))) throw new Error(`Nonfinite audio sample: ${label}`);
  return {channels,frames,sampleRate,duration:frames/sampleRate};
}

function validateDrumReference(value:unknown,sampleIds:Set<string>):asserts value is SessionData['drumSamples'][number] {
  if(!isRecord(value)) throw new Error('Invalid drum sample reference');
  requireSafeInteger(value.originalIndex,0,PROJECT_ARCHIVE_LIMITS.drumSlots-1,'drum sample index');
  const id=requireString(value.sampleId,'drum sample ID'); if(!sampleIds.has(id)) throw new Error(`Missing sample reference: ${id}`);
  if(typeof value.isAssigned!=='boolean' || !isRecord(value.settings)) throw new Error('Invalid drum sample assignment or settings');
  if(value.assignedKey!==undefined) requireSafeInteger(value.assignedKey,0,23,'assigned drum key');
  if(value.sourceIdentity!==undefined) requireString(value.sourceIdentity,'slice source identity',256);
  if(value.sliceProvenance!==undefined) {
    if(!isRecord(value.sliceProvenance)) throw new Error('Invalid slice provenance');
    const provenance=value.sliceProvenance;
    const sourceIdentity=requireString(provenance.sourceIdentity,'slice provenance source identity',256);
    requireString(provenance.sourceName,'slice provenance source name',1024);
    const sourceFrameCount=requireSafeInteger(provenance.sourceFrameCount,1,0xffffffff,'slice provenance source frame count');
    const startFrame=requireSafeInteger(provenance.startFrame,0,sourceFrameCount-1,'slice provenance start frame');
    requireSafeInteger(provenance.endFrame,startFrame+1,sourceFrameCount,'slice provenance end frame');
    const sourceSampleRate=requireFinite(provenance.sourceSampleRate,'slice provenance source sample rate');
    if(sourceSampleRate<8000 || sourceSampleRate>768000) throw new Error('Invalid slice provenance source sample rate');
    requireSafeInteger(provenance.sourceChannels,1,32,'slice provenance source channels');
    if(value.sourceIdentity!==undefined && value.sourceIdentity!==sourceIdentity) throw new Error('Mismatched slice source identity');
  }
  const settings=value.settings;
  for(const key of ['inPoint','outPoint','transpose','pan','gain']) requireFinite(settings[key],`drum sample ${key}`);
  if(typeof settings.reverse!=='boolean' || typeof settings.hasBeenEdited!=='boolean' || !['oneshot','group','loop','gate'].includes(String(settings.playmode))) throw new Error('Invalid drum sample settings');
}

function validateMultiReference(value:unknown,sampleIds:Set<string>):asserts value is SessionData['multisampleFiles'][number] {
  if(!isRecord(value)) throw new Error('Invalid multisample reference');
  const id=requireString(value.sampleId,'multisample ID'); if(!sampleIds.has(id)) throw new Error(`Missing sample reference: ${id}`);
  requireSafeInteger(value.rootNote,0,127,'root note');
  if(value.sourceIdentity!==undefined) requireString(value.sourceIdentity,'multisample source identity',256);
  for(const key of ['inPoint','outPoint','loopStart','loopEnd']) requireFinite(value[key],`multisample ${key}`);
  requireString(value.fileName,'multisample filename');
  if(value.loopCrossfade!==undefined) {
    if(!isRecord(value.loopCrossfade)) throw new Error('Invalid multisample crossfade');
    const fraction=requireFinite(value.loopCrossfade.fraction,'multisample crossfade fraction');
    if(fraction<0 || fraction>1024) throw new Error('Invalid multisample crossfade fraction');
    if(value.loopCrossfade.importedRaw!==undefined) requireSafeInteger(value.loopCrossfade.importedRaw,0,0xffffffff,'imported crossfade value');
    if(value.loopCrossfade.importedFramecount!==undefined) requireSafeInteger(value.loopCrossfade.importedFramecount,1,0xffffffff,'imported crossfade frame count');
    if(value.loopCrossfade.sourceIdentity!==undefined) requireString(value.loopCrossfade.sourceIdentity,'crossfade source identity',512);
  }
}

interface ManifestMetadataValidation {
  manifest:ArchiveManifestV1;
  expected:Set<string>;
}

/** Validate every manifest rule that does not require reading ZIP entry bytes. */
function validateManifestMetadata(raw:unknown):ManifestMetadataValidation {
  if(!isRecord(raw) || raw.format!=='op-patchstudio-project') throw new Error('This is not an OP-PatchStudio project');
  if(raw.version!==PROJECT_ARCHIVE_VERSION) throw new Error(`Unsupported project archive version: ${String(raw.version)}`);
  if(!isRecord(raw.project) || !Array.isArray(raw.samples) || raw.samples.length>PROJECT_ARCHIVE_LIMITS.samples) throw new Error('Invalid project archive manifest');
  validateSettings(raw.project);
  validateJson(raw.project.importedDrumPreset ?? null,'imported drum settings');
  validateJson(raw.project.importedMultisamplePreset ?? null,'imported multisample settings');
  if(!['C3','C4'].includes(String(raw.project.midiNoteMapping)) || typeof raw.project.isDrumKeyboardPinned!=='boolean' || typeof raw.project.isMultisampleKeyboardPinned!=='boolean') throw new Error('Invalid project mapping settings');
  if(raw.project.selectedMultisample!==null && raw.project.selectedMultisample!==undefined) requireSafeInteger(raw.project.selectedMultisample,0,PROJECT_ARCHIVE_LIMITS.samples-1,'selected multisample');

  const sampleIds=new Set<string>(),expected=new Set<string>([PROJECT_ARCHIVE_MANIFEST]);
  for(const value of raw.samples) {
    if(!isRecord(value)) throw new Error('Invalid archive sample');
    const id=requireString(value.id,'sample ID'); if(sampleIds.has(id)) throw new Error(`Duplicate sample ID: ${id}`); sampleIds.add(id);
    requireString(value.name,'sample name'); if(typeof value.type!=='string' || value.type.length>256) throw new Error('Invalid sample media type');
    requireSafeInteger(value.size,0,PROJECT_ARCHIVE_LIMITS.entryBytes,'source size');
    if(!isRecord(value.metadata)) throw new Error('Invalid sample metadata');
    if(value.metadata.channels!==undefined)requireSafeInteger(value.metadata.channels,1,32,'sample channels'); if(value.metadata.sampleRate!==undefined)requireSafeInteger(value.metadata.sampleRate,8000,768000,'sample rate');
    if(value.metadata.bitDepth!==undefined)requireSafeInteger(value.metadata.bitDepth,1,64,'sample bit depth'); requireFinite(value.metadata.duration,'sample duration');
    if(!isRecord(value.audio)) throw new Error('Invalid actual audio dimensions');
    requireSafeInteger(value.audio.bytes,25,PROJECT_ARCHIVE_LIMITS.entryBytes,'audio bytes');
    requireSafeInteger(value.audio.channels,1,32,'audio channels'); requireSafeInteger(value.audio.frames,1,0xffffffff,'audio frames');
    requireFinite(value.audio.sampleRate,'audio sample rate');
    const audioPath=safeArchivePath(value.audioPath,'audio path'); expected.add(audioPath);
    if(value.sourcePath!==undefined) expected.add(safeArchivePath(value.sourcePath,'source path'));
  }
  if(!Array.isArray(raw.project.drumSamples) || !Array.isArray(raw.project.multisampleFiles) || raw.project.drumSamples.length+raw.project.multisampleFiles.length>PROJECT_ARCHIVE_LIMITS.samples) throw new Error('Project contains too many sample references');
  raw.project.drumSamples.forEach(value=>validateDrumReference(value,sampleIds));
  raw.project.multisampleFiles.forEach(value=>validateMultiReference(value,sampleIds));
  const referenced=new Map<string,number>();
  for(const ref of [...raw.project.drumSamples,...raw.project.multisampleFiles]) referenced.set(ref.sampleId,(referenced.get(ref.sampleId)??0)+1);
  for(const id of sampleIds) if(!referenced.has(id)) throw new Error(`Unreferenced sample entry: ${id}`);
  let decodedAudioBytes=0;
  for(const sample of raw.samples as unknown as ArchiveSample[]) {
    decodedAudioBytes+=sample.audio.bytes*(referenced.get(sample.id)??0);
    if(!Number.isSafeInteger(decodedAudioBytes) || decodedAudioBytes>PROJECT_ARCHIVE_LIMITS.decodedAudioBytes) throw new Error('Project decoded audio is too large');
  }
  return {manifest:raw as unknown as ArchiveManifestV1,expected};
}

function validateManifest(raw:unknown,entries:Map<string,ZipEntryInfo>):ArchiveManifestV1 {
  const {manifest,expected}=validateManifestMetadata(raw);
  for(const name of entries.keys()) if(!entries.get(name)!.directory && !expected.has(name)) throw new Error(`Unexpected archive entry: ${name}`);
  for(const path of expected) if(!entries.has(path) || entries.get(path)!.directory) throw new Error(`Missing archive entry: ${path}`);
  for(const sample of manifest.samples) {
    if(entries.get(sample.audioPath)!.uncompressedSize!==sample.audio.bytes) throw new Error(`Audio entry size mismatch: ${sample.name}`);
  }
  return manifest;
}

async function blobBytes(blob:Blob):Promise<Uint8Array> {
  if(blob.size>PROJECT_ARCHIVE_LIMITS.archiveBytes) throw new Error('Project archive is too large');
  return new Uint8Array(await blob.arrayBuffer());
}

/** Validate exact manifest metadata without encoding or copying project audio. */
export function validateProjectArchiveMetadata(snapshot:ProjectSnapshot):void {
  const {session,samples}=serializeProject(snapshot,'portable-project',{metadataOnly:true});
  const live=[...snapshot.drumSamples.filter(sample=>sample?.isLoaded&&sample.audioBuffer),...snapshot.multisampleFiles.filter(sample=>sample.isLoaded&&sample.audioBuffer)];
  if(live.length!==samples.length)throw new Error('Project sample metadata is inconsistent');
  const sourcePaths=new Map<Blob,string>();
  const manifestSamples=samples.map((sample,index):ArchiveSample=>{const asset=live[index],audio=asset.audioBuffer!;let sourcePath:string|undefined;
    if(sample.sourceFile){sourcePath=sourcePaths.get(sample.sourceFile);if(!sourcePath){sourcePath=`assets/source-${String(index).padStart(4,'0')}.bin`;sourcePaths.set(sample.sourceFile,sourcePath);}}
    return {id:sample.id,name:sample.name,type:sample.type,size:sample.sourceFile?.size??sample.size,sourceLastModified:sample.sourceLastModified,
      metadata:sample.metadata,tags:sample.tags,audioPath:`assets/audio-${String(index).padStart(4,'0')}.opfloat`,sourcePath,
      audio:{bytes:24+4*audio.numberOfChannels*audio.length,channels:audio.numberOfChannels,frames:audio.length,sampleRate:audio.sampleRate}};});
  const manifest:ArchiveManifestV1={format:'op-patchstudio-project',version:1,project:archiveProject(session),samples:manifestSamples};
  encodeManifest(manifest);
  validateManifestMetadata(manifest);
}

export async function exportProjectArchive(snapshot:ProjectSnapshot):Promise<Blob> {
  const {session,samples}=serializeProject(snapshot,'portable-project');
  const project=archiveProject(session);
  const zip=new JSZip(),audioPaths=new Map<Blob,string>(),sourcePaths=new Map<Blob,string>();
  const manifestSamples:ArchiveSample[]=[];
  const addAsset=async (blob:Blob,kind:'audio'|'source',index:number,map:Map<Blob,string>,prepared?:Uint8Array) => {
    let path=map.get(blob);
    if(!path) {
      path=`assets/${kind}-${String(index).padStart(4,'0')}.${kind==='audio'?'opfloat':'bin'}`;
      map.set(blob,path);
      zip.file(path,prepared??new Uint8Array(await blob.arrayBuffer()),{binary:true,createFolders:false});
    }
    return path;
  };
  for(let index=0;index<samples.length;index++) {
    const sample=samples[index],{data,sourceFile}=sample;
    const dataBytes=new Uint8Array(await data.arrayBuffer()),audioInfo=inspectAudio(dataBytes,sample.name);
    const audioPath=await addAsset(data,'audio',index,audioPaths,dataBytes);
    const sourcePath=sourceFile?.size ? await addAsset(sourceFile,'source',index,sourcePaths) : undefined;
    manifestSamples.push({id:sample.id,name:sample.name,type:sample.type,size:sourceFile?.size??sample.size,sourceLastModified:sample.sourceLastModified,
      metadata:sample.metadata,tags:sample.tags,audioPath,sourcePath,
      audio:{bytes:dataBytes.byteLength,channels:audioInfo.channels,frames:audioInfo.frames,sampleRate:audioInfo.sampleRate}});
  }
  const manifest:ArchiveManifestV1={format:'op-patchstudio-project',version:1,project,samples:manifestSamples};
  const manifestJson=encodeManifest(manifest);
  zip.file(PROJECT_ARCHIVE_MANIFEST,manifestJson,{createFolders:false});
  const generated=await zip.generateAsync({type:'uint8array',compression:'STORE',platform:'DOS'});
  if(generated.byteLength>PROJECT_ARCHIVE_LIMITS.archiveBytes) throw new Error('Project archive is too large to download');
  const entries=inspectZip(generated);
  validateManifest(manifest,entries);
  return new Blob([generated],{type:PROJECT_ARCHIVE_TYPE});
}

export async function importProjectArchive(blob:Blob):Promise<RestoredProject> {
  const raw=await blobBytes(blob),entries=inspectZip(raw);
  const manifestInfo=entries.get(PROJECT_ARCHIVE_MANIFEST);
  if(!manifestInfo || manifestInfo.directory || manifestInfo.uncompressedSize>PROJECT_ARCHIVE_LIMITS.manifestBytes) throw new Error('Project manifest is missing or too large');
  const zip=await JSZip.loadAsync(raw,{checkCRC32:true,createFolders:false});
  const manifestFile=zip.file(PROJECT_ARCHIVE_MANIFEST);
  if(!manifestFile) throw new Error('Project manifest is missing');
  let parsed:unknown;
  try { parsed=JSON.parse(await manifestFile.async('string')); }
  catch { throw new Error('Project manifest is not valid JSON'); }
  const manifest=validateManifest(parsed,entries);
  const extracted=new Map<string,Promise<Uint8Array>>();
  const extract=(path:string) => {
    let pending=extracted.get(path);
    if(!pending) {
      const file=zip.file(path); if(!file) throw new Error(`Missing archive entry: ${path}`);
      pending=file.async('uint8array').then(value=>{ if(value.byteLength!==entries.get(path)!.uncompressedSize) throw new Error(`Archive entry size mismatch: ${path}`); return value; });
      extracted.set(path,pending);
    }
    return pending;
  };
  const sampleMap=new Map<string,SampleData>();
  for(const sample of manifest.samples) {
    const audioBytes=await extract(sample.audioPath),audioInfo=inspectAudio(audioBytes,sample.name);
    if(audioInfo.channels!==sample.audio.channels || audioInfo.frames!==sample.audio.frames || audioInfo.sampleRate!==sample.audio.sampleRate || audioBytes.byteLength!==sample.audio.bytes) throw new Error(`Actual audio dimensions mismatch: ${sample.name}`);
    const sourceBytes=sample.sourcePath ? await extract(sample.sourcePath) : undefined;
    if(sourceBytes && sourceBytes.byteLength!==sample.size) throw new Error(`Source size mismatch: ${sample.name}`);
    sampleMap.set(sample.id,{...sample,data:new Blob([audioBytes],{type:'application/vnd.op-patchstudio.float32'}),
      sourceFile:sourceBytes ? new Blob([sourceBytes],{type:sample.type}) : undefined,createdAt:0});
  }
  const byId=new Map(manifest.samples.map(sample=>[sample.id,sample]));
  for(const ref of manifest.project.drumSamples) {
    const info=inspectAudio(await extract(byId.get(ref.sampleId)!.audioPath),ref.sampleId);
    const legacyMaximum=info.duration+(1/info.sampleRate);
    if(ref.settings.inPoint<0 || ref.settings.outPoint<0 || ref.settings.inPoint>legacyMaximum || ref.settings.outPoint>legacyMaximum) throw new Error('Drum sample markers are outside the audio bounds');
  }
  for(const ref of manifest.project.multisampleFiles) {
    const info=inspectAudio(await extract(byId.get(ref.sampleId)!.audioPath),ref.sampleId);
    const legacyMaximum=info.duration+(1/info.sampleRate);
    if(![ref.inPoint,ref.outPoint,ref.loopStart,ref.loopEnd].every(value=>value>=0 && value<=legacyMaximum)) throw new Error('Multisample markers are outside the audio bounds');
  }
  const session:SessionData={id:'portable-project',timestamp:0,version:2,savedToLibrary:false,...manifest.project};
  return deserializeProject(session,async id=>sampleMap.get(id)??null);
}

export function projectArchiveFilename(state:Pick<AppState,'currentTab'|'drumSettings'|'multisampleSettings'>):string {
  const preferred=state.currentTab==='multisample'?state.multisampleSettings.presetName:state.drumSettings.presetName;
  const safe=(preferred||'op-patchstudio-project').normalize('NFKD').replace(/[^a-z0-9._-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,80) || 'op-patchstudio-project';
  return `${safe}.opstudio`;
}
