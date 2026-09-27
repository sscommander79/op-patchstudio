// Patch generation utilities for OP-XY drum and multisample presets
import JSZip from 'jszip';
import { convertAudioFormat, sanitizeName, generateFilename } from './audio';
import { exportAudioBuffer, getAudioFileExtension, type AudioFormat } from './audioExport';
import { baseDrumJson } from '../components/drum/baseDrumJson';
import { baseMultisampleJson } from '../components/multisample/baseMultisampleJson';
import { internalToPercent, percentToInternal } from './valueConversions';
import { mergeImportedDrumSettings, mergeImportedMultisampleSettings } from './jsonImport';
import { allocateUniqueExportNames, planAudioConversion, validateArchiveReferences } from './exportPlanning';
import type { AppState, DrumSample, MultisampleFile } from '../context/AppContext';
import { normalizeSecondRanges } from './loopEditing';

interface IndexedDrumSample extends DrumSample { originalIndex: number }
interface IndexedMultisampleFile extends MultisampleFile { originalIndex: number }

interface DrumRegion {
  'fade.in': number;
  'fade.out': number;
  framecount: number;
  hikey: number;
  lokey: number;
  pan: number;
  'pitch.keycenter': number;
  playmode: string;
  reverse: boolean;
  sample: string;
  transpose: number;
  tune: number;
  gain?: number;
  'sample.start'?: number;
  'sample.end'?: number;
}

interface MultisampleRegion {
  framecount: number;
  gain: number;
  hikey: number;
  lokey: number;
  'loop.crossfade': number;
  'loop.end': number;
  'loop.onrelease': boolean;
  'loop.enabled': boolean;
  'loop.start': number;
  'pitch.keycenter': number;
  reverse: boolean;
  sample: string;
  'sample.end': number;
  'sample.start': number;
  tune: number;
}

interface DrumJson {
  name?: string;
  engine: Record<string, unknown>;
  envelope: Record<string, unknown>;
  fx: Record<string, unknown>;
  lfo: Record<string, unknown>;
  octave: number;
  platform: string;
  regions: DrumRegion[];
  type: string;
  version: number;
}

interface MultisampleJson {
  name?: string;
  engine: Record<string, unknown>;
  envelope: Record<string, unknown>;
  fx: Record<string, unknown>;
  lfo: Record<string, unknown>;
  octave: number;
  platform: string;
  regions: MultisampleRegion[];
  type: string;
  version: number;
}

interface PlannedDrumSample { sample: IndexedDrumSample; outputName: string }
interface PlannedMultisampleSample {
  sample: IndexedMultisampleFile;
  outputName: string;
  sampleNote: number;
  lowKey: number;
  highKey: number;
}
interface ExportedAudio<T> { plan: T; buffer: AudioBuffer; blob: Blob }

function importedEngine(preset: unknown): Record<string, unknown> | undefined {
  if (!preset || typeof preset !== 'object' || Array.isArray(preset)) return undefined;
  const engine = (preset as Record<string, unknown>).engine;
  return engine && typeof engine === 'object' && !Array.isArray(engine)
    ? engine as Record<string, unknown>
    : undefined;
}

function applyPercentSetting(
  engine: Record<string, unknown>,
  key: string,
  percent: number,
  imported: Record<string, unknown> | undefined,
): void {
  if (isNaN(percent)) return;
  const importedValue = imported?.[key];
  if (typeof importedValue === 'number' && internalToPercent(importedValue) === percent) return;
  engine[key] = percentToInternal(percent);
}

function desiredOutputName(
  originalName: string,
  renameFiles: boolean,
  presetName: string,
  separator: AppState['drumSettings']['filenameSeparator'],
  type: 'drum' | 'multisample',
  keyOrNote: number,
  mapping: AppState['midiNoteMapping'],
  audioFormat: AudioFormat,
): string {
  const extension = getAudioFileExtension(audioFormat);
  return renameFiles
    ? generateFilename(presetName, separator, type, keyOrNote, originalName, mapping, extension)
    : `${sanitizeName(originalName).replace(/\.[^/.]+$/, '').replace(/\.+$/, '') || 'sample'}.${extension}`;
}

function requireUsableBuffer(sampleName: string, buffer: AudioBuffer): void {
  if (!Number.isInteger(buffer.length) || buffer.length < 1 || !Number.isFinite(buffer.sampleRate) || buffer.sampleRate <= 0) {
    throw new Error(`Cannot export sample ${sampleName}: audio buffer has no usable frames`);
  }
}

function planDrumSamples(state: AppState, audioFormat: AudioFormat): PlannedDrumSample[] {
  const samples = state.drumSamples
    .map((sample, originalIndex) => ({ ...sample, originalIndex }))
    .filter((sample): sample is IndexedDrumSample & { file: File; audioBuffer: AudioBuffer } =>
      Boolean(sample.isLoaded && sample.file && sample.audioBuffer),
    );
  const desiredNames = samples.map((sample) => desiredOutputName(
    sample.file.name,
    state.drumSettings.renameFiles,
    state.drumSettings.presetName,
    state.drumSettings.filenameSeparator,
    'drum',
    sample.assignedKey ?? sample.originalIndex,
    state.midiNoteMapping,
    audioFormat,
  ));
  const outputNames = allocateUniqueExportNames(desiredNames);
  return samples.map((sample, index) => ({ sample, outputName: outputNames[index] }));
}

function planMultisampleSamples(state: AppState, audioFormat: AudioFormat): PlannedMultisampleSample[] {
  const samples = state.multisampleFiles
    .map((sample, originalIndex) => ({ ...sample, originalIndex }))
    .filter((sample): sample is IndexedMultisampleFile & { file: File; audioBuffer: AudioBuffer } =>
      Boolean(sample.file && sample.audioBuffer),
    )
    .sort((left, right) => {
      const leftNote = left.rootNote >= 0 ? left.rootNote : 60 + left.originalIndex;
      const rightNote = right.rootNote >= 0 ? right.rootNote : 60 + right.originalIndex;
      return leftNote - rightNote;
    });
  const desiredNames = samples.map((sample) => desiredOutputName(
    sample.file.name,
    state.multisampleSettings.renameFiles,
    state.multisampleSettings.presetName,
    state.multisampleSettings.filenameSeparator,
    'multisample',
    sample.rootNote >= 0 ? sample.rootNote : 60 + sample.originalIndex,
    state.midiNoteMapping,
    audioFormat,
  ));
  const outputNames = allocateUniqueExportNames(desiredNames);
  let lastKey = 0;
  return samples.map((sample, index) => {
    const sampleNote = sample.rootNote >= 0 ? sample.rootNote : 60 + sample.originalIndex;
    const plan = { sample, outputName: outputNames[index], sampleNote, lowKey: lastKey, highKey: sampleNote };
    lastKey = sampleNote + 1;
    return plan;
  });
}

function applyDrumSettings(patchJson: DrumJson, state: AppState): void {
  const settings = state.drumSettings.presetSettings;
  if (!patchJson.engine || !settings) return;
  const imported = importedEngine(state.importedDrumPreset);
  if (settings.playmode) patchJson.engine.playmode = settings.playmode;
  if (!isNaN(settings.transpose)) patchJson.engine.transpose = settings.transpose;
  applyPercentSetting(patchJson.engine, 'velocity.sensitivity', settings.velocity, imported);
  applyPercentSetting(patchJson.engine, 'volume', settings.volume, imported);
  applyPercentSetting(patchJson.engine, 'width', settings.width, imported);
}

function applyMultisampleSettings(patchJson: MultisampleJson, state: AppState): void {
  const settings = state.multisampleSettings;
  if (patchJson.engine) {
    const imported = importedEngine(state.importedMultisamplePreset);
    if (settings.playmode) patchJson.engine.playmode = settings.playmode;
    if (!isNaN(settings.transpose)) patchJson.engine.transpose = settings.transpose;
    applyPercentSetting(patchJson.engine, 'velocity.sensitivity', settings.velocitySensitivity, imported);
    applyPercentSetting(patchJson.engine, 'volume', settings.volume, imported);
    applyPercentSetting(patchJson.engine, 'width', settings.width, imported);
    applyPercentSetting(patchJson.engine, 'highpass', settings.highpass, imported);
    if (settings.portamentoType) patchJson.engine['portamento.type'] = settings.portamentoType === 'linear' ? 0 : 32767;
    applyPercentSetting(patchJson.engine, 'portamento.amount', settings.portamentoAmount, imported);
    if (!isNaN(settings.tuningRoot)) patchJson.engine['tuning.root'] = settings.tuningRoot;
  }
  if (patchJson.envelope) {
    const importedAmp = patchJson.envelope.amp;
    const importedFilter = patchJson.envelope.filter;
    if (settings.ampEnvelope) {
      patchJson.envelope.amp = {
        ...(importedAmp && typeof importedAmp === 'object' && !Array.isArray(importedAmp) ? importedAmp : {}),
        ...settings.ampEnvelope,
      };
    }
    if (settings.filterEnvelope) {
      patchJson.envelope.filter = {
        ...(importedFilter && typeof importedFilter === 'object' && !Array.isArray(importedFilter) ? importedFilter : {}),
        ...settings.filterEnvelope,
      };
    }
  }
}

async function exportDrumAudio(
  plan: PlannedDrumSample,
  state: AppState,
  targetSampleRate: number | undefined,
  targetBitDepth: number | undefined,
  targetChannels: string | undefined,
  audioFormat: AudioFormat,
): Promise<ExportedAudio<PlannedDrumSample>> {
  const { sample } = plan;
  const sourceBuffer = sample.audioBuffer!;
  const conversion = planAudioConversion({
    sourceBuffer,
    originalSampleRate: sample.originalSampleRate,
    originalBitDepth: sample.originalBitDepth,
    targetSampleRate,
    targetBitDepth,
    targetChannels,
    normalize: state.drumSettings.normalize,
  });
  try {
    const buffer = conversion.needsConversion
      ? await convertAudioFormat(sourceBuffer, {
          sampleRate: conversion.sampleRate,
          bitDepth: conversion.bitDepth,
          channels: conversion.channels,
          normalize: state.drumSettings.normalize,
          normalizeLevel: state.drumSettings.normalizeLevel,
          sampleName: sample.name,
        })
      : sourceBuffer;
    requireUsableBuffer(sample.name, buffer);
    const blob = await exportAudioBuffer(buffer, {
      format: audioFormat,
      bitDepth: conversion.bitDepth,
      isFloat: audioFormat === 'aiff' && (targetBitDepth === 32 || (!targetBitDepth && sample.originalBitDepth === 32)),
      rootNote: 60,
    });
    return { plan, buffer, blob };
  } catch (error) {
    throw new Error(`Failed to convert sample ${sample.name} to audio file: ${error instanceof Error ? error.message : error}`, { cause: error });
  }
}

async function exportMultisampleAudio(
  plan: PlannedMultisampleSample,
  state: AppState,
  targetSampleRate: number | undefined,
  targetBitDepth: number | undefined,
  targetChannels: string | undefined,
  audioFormat: AudioFormat,
): Promise<ExportedAudio<PlannedMultisampleSample>> {
  const { sample, sampleNote } = plan;
  const sourceBuffer = sample.audioBuffer!;
  const sourceRanges = normalizeSecondRanges(
    sourceBuffer.length,
    sourceBuffer.sampleRate,
    { start: sample.inPoint, end: sample.outPoint },
    { start: sample.loopStart, end: sample.loopEnd },
  );
  const conversion = planAudioConversion({
    sourceBuffer,
    originalSampleRate: sample.originalSampleRate,
    originalBitDepth: sample.originalBitDepth,
    targetSampleRate,
    targetBitDepth,
    targetChannels,
    normalize: state.multisampleSettings.normalize,
    cutAtLoopEnd: state.multisampleSettings.cutAtLoopEnd,
    loopEndFrame: sourceRanges.loop.end,
  });
  try {
    const buffer = conversion.needsConversion
      ? await convertAudioFormat(sourceBuffer, {
          sampleRate: conversion.sampleRate,
          bitDepth: conversion.bitDepth,
          channels: conversion.channels,
          normalize: state.multisampleSettings.normalize,
          normalizeLevel: state.multisampleSettings.normalizeLevel,
          cutAtLoopEnd: state.multisampleSettings.cutAtLoopEnd,
          loopEnd: sourceRanges.loop.end,
          sampleName: sample.name,
        })
      : sourceBuffer;
    requireUsableBuffer(sample.name, buffer);
    const outputRanges = normalizeSecondRanges(
      buffer.length,
      buffer.sampleRate,
      { start: sample.inPoint, end: sample.outPoint },
      { start: sample.loopStart, end: sample.loopEnd },
    );
    const blob = await exportAudioBuffer(buffer, {
      format: audioFormat,
      bitDepth: conversion.bitDepth,
      isFloat: audioFormat === 'aiff' && (targetBitDepth === 32 || (!targetBitDepth && sample.originalBitDepth === 32)),
      rootNote: sampleNote,
      loopStart: state.multisampleSettings.loopEnabled ? outputRanges.loop.start : undefined,
      loopEnd: state.multisampleSettings.loopEnabled ? outputRanges.loop.end : undefined,
    });
    return { plan, buffer, blob };
  } catch (error) {
    throw new Error(`Failed to convert sample ${sample.name} to audio file: ${error instanceof Error ? error.message : error}`, { cause: error });
  }
}

export async function generateDrumPatch(
  state: AppState,
  patchName: string = 'drum_patch',
  targetSampleRate?: number,
  targetBitDepth?: number,
  targetChannels?: string,
  audioFormat: AudioFormat = 'wav',
): Promise<Blob> {
  const zip = new JSZip();
  const patchJson: DrumJson = JSON.parse(JSON.stringify(baseDrumJson));
  patchJson.name = sanitizeName(patchName);
  patchJson.regions = [];
  mergeImportedDrumSettings(patchJson, state.importedDrumPreset);
  applyDrumSettings(patchJson, state);
  const plans = planDrumSamples(state, audioFormat);
  const exported = await Promise.all(plans.map((plan) => exportDrumAudio(plan, state, targetSampleRate, targetBitDepth, targetChannels, audioFormat)));
  const assigned = exported
    .filter(({ plan }) => {
      const { sample } = plan;
      return (sample.isAssigned && typeof sample.assignedKey === 'number' && sample.assignedKey >= 0 && sample.assignedKey < 24) ||
        (sample.originalIndex < 24 && sample.isAssigned !== false);
    })
    .sort((left, right) => (left.plan.sample.assignedKey ?? left.plan.sample.originalIndex) - (right.plan.sample.assignedKey ?? right.plan.sample.originalIndex))
    .slice(0, 24);
  patchJson.regions = assigned.map(({ plan, buffer }) => {
    const { sample, outputName } = plan;
    const sampleKey = sample.assignedKey ?? sample.originalIndex;
    const marker = normalizeSecondRanges(buffer.length, buffer.sampleRate, { start: sample.inPoint, end: sample.outPoint }).sample;
    const midiNote = 53 + sampleKey;
    return {
      'fade.in': 0,
      'fade.out': 0,
      framecount: buffer.length,
      hikey: midiNote,
      lokey: midiNote,
      pan: sample.pan,
      'pitch.keycenter': 60,
      playmode: sample.playmode,
      reverse: sample.reverse,
      sample: outputName,
      transpose: sample.transpose,
      tune: 0,
      gain: sample.gain,
      'sample.start': marker.start,
      'sample.end': marker.end,
    };
  });
  const archiveNames = exported.map(({ plan }) => plan.outputName);
  validateArchiveReferences(patchJson.regions, archiveNames);
  for (const entry of exported) zip.file(entry.plan.outputName, entry.blob);
  zip.file('patch.json', JSON.stringify(patchJson, null, 2));
  return await zip.generateAsync({ type: 'blob' });
}

export async function generateMultisamplePatch(
  state: AppState,
  patchName: string = 'multisample_patch',
  targetSampleRate?: number,
  targetBitDepth?: number,
  targetChannels?: string,
  multisampleGain: number = 0,
  audioFormat: AudioFormat = 'wav',
): Promise<Blob> {
  const zip = new JSZip();
  const patchJson: MultisampleJson = JSON.parse(JSON.stringify(baseMultisampleJson));
  patchJson.name = sanitizeName(patchName);
  patchJson.regions = [];
  mergeImportedMultisampleSettings(patchJson, state.importedMultisamplePreset);
  applyMultisampleSettings(patchJson, state);
  const plans = planMultisampleSamples(state, audioFormat);
  const exported = await Promise.all(plans.map((plan) => exportMultisampleAudio(plan, state, targetSampleRate, targetBitDepth, targetChannels, audioFormat)));
  patchJson.regions = exported.map(({ plan, buffer }) => {
    const ranges = normalizeSecondRanges(
      buffer.length,
      buffer.sampleRate,
      { start: plan.sample.inPoint, end: plan.sample.outPoint },
      { start: plan.sample.loopStart, end: plan.sample.loopEnd },
    );
    const crossfade = Math.max(0, Math.round((plan.sample.loopCrossfade?.fraction ?? 0) * buffer.length));
    return {
      framecount: buffer.length,
      gain: multisampleGain,
      hikey: plan.highKey,
      lokey: plan.lowKey,
      'loop.crossfade': crossfade,
      'loop.end': ranges.loop.end,
      'loop.onrelease': state.multisampleSettings.loopOnRelease,
      'loop.enabled': state.multisampleSettings.loopEnabled,
      'loop.start': ranges.loop.start,
      'pitch.keycenter': plan.sampleNote,
      reverse: false,
      sample: plan.outputName,
      'sample.end': state.multisampleSettings.cutAtLoopEnd ? buffer.length : ranges.sample.end,
      'sample.start': ranges.sample.start,
      tune: 0,
    };
  });
  if (patchJson.regions.length > 0) patchJson.regions[patchJson.regions.length - 1].hikey = 127;
  const archiveNames = exported.map(({ plan }) => plan.outputName);
  validateArchiveReferences(patchJson.regions, archiveNames);
  for (const entry of exported) zip.file(entry.plan.outputName, entry.blob);
  zip.file('patch.json', JSON.stringify(patchJson, null, 2));
  return await zip.generateAsync({ type: 'blob' });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
