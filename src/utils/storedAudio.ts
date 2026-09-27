/** Lossless planar Float32 audio. Header: OPAS, u32 version/channels/frames, f64 rate (LE). */
export const STORED_AUDIO_TYPE = 'application/vnd.op-patchstudio.float32';
const HEADER = 24;
const MAGIC = 0x5341504f;
const MAX_BYTES = 512 * 1024 * 1024;
const encodedAudio = new WeakMap<AudioBuffer, Blob>();

function validateDimensions(channels: number, length: number, rate: number, bytes?: number) {
  const size = HEADER + channels * length * 4;
  if (!Number.isInteger(channels) || channels < 1 || channels > 32 ||
      !Number.isInteger(length) || length < 1 || !Number.isFinite(rate) || rate < 8000 || rate > 768000 ||
      !Number.isSafeInteger(size) || size > MAX_BYTES || (bytes !== undefined && bytes !== size)) {
    throw new Error('Invalid stored audio dimensions or truncated payload');
  }
  return size;
}

/** AudioBuffers are immutable project assets: replace a buffer when editing audio. */
export function encodeStoredAudio(audio: AudioBuffer): Blob {
  const cached = encodedAudio.get(audio);
  if (cached) return cached;
  const bytes = new ArrayBuffer(validateDimensions(audio.numberOfChannels, audio.length, audio.sampleRate));
  const view = new DataView(bytes);
  view.setUint32(0, MAGIC, true); view.setUint32(4, 1, true);
  view.setUint32(8, audio.numberOfChannels, true); view.setUint32(12, audio.length, true);
  view.setFloat64(16, audio.sampleRate, true);
  let offset = HEADER;
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const channel = audio.getChannelData(c);
    if (channel.length !== audio.length) throw new Error('Invalid audio channel length');
    for (const value of channel) {
      if (!Number.isFinite(value)) throw new Error('Audio contains a non-finite sample');
      view.setFloat32(offset, value, true); offset += 4;
    }
  }
  const blob = new Blob([bytes], {type: STORED_AUDIO_TYPE});
  encodedAudio.set(audio, blob);
  return blob;
}

/** New payloads never pass through device-rate decoding. Legacy JSON/audio remain readable. */
export async function decodeStoredAudio(blob: Blob, legacyContext?: AudioContext): Promise<AudioBuffer> {
  if (!blob || typeof blob.arrayBuffer !== 'function' || blob.size < 1 || blob.size > MAX_BYTES) throw new Error('Missing or oversized audio payload');
  const bytes = await blob.arrayBuffer();
  const view = new DataView(bytes);
  if (blob.type === STORED_AUDIO_TYPE || (bytes.byteLength >= 4 && view.getUint32(0, true) === MAGIC)) {
    if (bytes.byteLength < HEADER || view.getUint32(0, true) !== MAGIC || view.getUint32(4, true) !== 1) throw new Error('Invalid stored audio header or version');
    const channels = view.getUint32(8, true), length = view.getUint32(12, true), sampleRate = view.getFloat64(16, true);
    validateDimensions(channels, length, sampleRate, bytes.byteLength);
    // Validate before allocation so malformed payloads never allocate a huge AudioBuffer.
    for (let offset = HEADER; offset < bytes.byteLength; offset += 4) {
      if (!Number.isFinite(view.getFloat32(offset, true))) throw new Error('Audio contains a non-finite sample');
    }
    const audio = new AudioBuffer({numberOfChannels: channels, length, sampleRate});
    let offset = HEADER;
    for (let c = 0; c < channels; c++) {
      const channel = audio.getChannelData(c);
      for (let i = 0; i < length; i++, offset += 4) channel[i] = view.getFloat32(offset, true);
    }
    encodedAudio.set(audio, blob);
    return audio;
  }
  if (blob.type === 'application/json') {
    const data = JSON.parse(new TextDecoder().decode(bytes));
    validateDimensions(data.numberOfChannels, data.length, data.sampleRate);
    if (!Array.isArray(data.channelData) || data.channelData.length !== data.numberOfChannels ||
        data.channelData.some((c: unknown) => !Array.isArray(c) || c.length !== data.length || c.some(v => typeof v !== 'number' || !Number.isFinite(v) || !Number.isFinite(Math.fround(v))))) throw new Error('Invalid legacy audio channels');
    const audio = new AudioBuffer({numberOfChannels: data.numberOfChannels, length: data.length, sampleRate: data.sampleRate});
    data.channelData.forEach((c: number[], i: number) => audio.getChannelData(i).set(c));
    return audio;
  }
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  if (!legacyContext && !AudioContextClass) throw new Error('Web Audio is not available');
  const context = legacyContext ?? new (AudioContextClass as typeof AudioContext)();
  try {
    const audio = await context.decodeAudioData(bytes);
    validateDimensions(audio.numberOfChannels, audio.length, audio.sampleRate);
    return audio;
  } finally { if (!legacyContext) await context.close(); }
}

/** Keep original source bytes when available; synthesized files explicitly identify their format. */
export function restoreSourceFile(source: Blob | null | undefined, name: string, payload: Blob, audio: AudioBuffer, lastModified?: number): File {
  if (source?.size) return new File([source], name, {type: source.type || 'application/octet-stream', lastModified});
  const binary = payload.type === 'application/json' ? encodeStoredAudio(audio) : payload;
  const isFloat = binary.type === STORED_AUDIO_TYPE;
  return new File([binary], isFloat ? name.replace(/\.[^.]*$/, '') + '.opfloat' : name,
    {type: binary.type || 'application/octet-stream', lastModified});
}
