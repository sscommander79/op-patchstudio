const COMPRESSED_INPUT_LIMIT = 64 * 1024 * 1024;
const MAX_CONTAINER_CHUNKS = 1024;

export interface AudioImportPreflight {
  kind: 'pcm' | 'compressed';
  estimatedDecodedBytes?: number;
}

const abort = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException('Import canceled', 'AbortError');
};

async function range(file: File, start: number, length: number, signal?: AbortSignal): Promise<ArrayBuffer> {
  abort(signal);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(length) || start < 0 || length < 0 || start + length > file.size) {
    throw new Error('Audio container has a truncated chunk table');
  }
  const value = await file.slice(start, start + length).arrayBuffer();
  abort(signal);
  if (value.byteLength !== length) throw new Error('Audio container header read was truncated');
  return value;
}

const fourCC = (value: ArrayBuffer, offset = 0) => String.fromCharCode(...new Uint8Array(value, offset, 4));
const decodedCost = (frames: number, channels: number, sourceRate: number, decoderRate: number) => {
  const outputFrames = Math.ceil(frames * decoderRate / sourceRate);
  const bytes = 24 + 4 * channels * outputFrames;
  if (!Number.isSafeInteger(bytes) || frames < 1 || channels < 1 || sourceRate <= 0) throw new Error('Audio container dimensions are invalid');
  return bytes;
};

const nextChunkOffset=(file:File,offset:number,size:number,label:string)=>{
  const dataEnd=offset+8+size,paddedEnd=dataEnd+(size&1);
  if(!Number.isSafeInteger(dataEnd)||dataEnd>file.size)throw new Error(`${label} chunk is truncated`);
  // Accept legacy files whose final odd-sized chunk omitted the RIFF/AIFF pad byte.
  if(paddedEnd>file.size) {
    if(dataEnd===file.size)return dataEnd;
    throw new Error(`${label} chunk is truncated`);
  }
  return paddedEnd;
};

async function wav(file: File, decoderRate: number, signal?: AbortSignal): Promise<number|undefined> {
  let offset = 12, channels = 0, sourceRate = 0, blockAlign = 0, dataBytes = -1,formatTag=0,chunks=0;
  while (offset + 8 <= file.size) {
    if(++chunks>MAX_CONTAINER_CHUNKS)throw new Error('WAV contains too many chunks');
    const header = await range(file, offset, 8, signal), view = new DataView(header);
    const id = fourCC(header), size = view.getUint32(4, true), next=nextChunkOffset(file,offset,size,`WAV ${id}`);
    if (id === 'fmt ') {
      if (size < 16) throw new Error('WAV fmt chunk is malformed');
      const fmt = new DataView(await range(file, offset + 8, 16, signal));
      formatTag=fmt.getUint16(0,true);channels = fmt.getUint16(2, true); sourceRate = fmt.getUint32(4, true); blockAlign = fmt.getUint16(12, true);
    } else if (id === 'data') dataBytes = size;
    if (channels && dataBytes >= 0) break;
    offset = next;
  }
  if(formatTag!==1&&formatTag!==3)return undefined;
  if (!channels || !sourceRate || !blockAlign || dataBytes < 0 || dataBytes % blockAlign) throw new Error('WAV dimensions or data extent are invalid');
  return decodedCost(dataBytes / blockAlign, channels, sourceRate, decoderRate);
}

function extended80(view: DataView): number {
  const exponent = view.getUint16(0, false), high = view.getUint32(2, false), low = view.getUint32(6, false);
  if((exponent&0x8000)!==0||(exponent&0x7fff)===0x7fff)return Number.NaN;
  if ((exponent & 0x7fff) === 0 && high === 0 && low === 0) return 0;
  return Math.pow(2, (exponent & 0x7fff) - 16383 - 31) * (high + low / 0x1_0000_0000);
}

async function aiff(file: File, decoderRate: number, signal?: AbortSignal): Promise<number> {
  let offset = 12, channels = 0, frames = 0, sourceRate = 0,sampleBits=0,soundBytes=-1,soundOffset=0,chunks=0;
  while (offset + 8 <= file.size) {
    if(++chunks>MAX_CONTAINER_CHUNKS)throw new Error('AIFF contains too many chunks');
    const header = await range(file, offset, 8, signal), view = new DataView(header);
    const id = fourCC(header), size = view.getUint32(4, false), next=nextChunkOffset(file,offset,size,`AIFF ${id}`);
    if (id === 'COMM') {
      if (size < 18) throw new Error('AIFF COMM chunk is malformed');
      const comm = new DataView(await range(file, offset + 8, 18, signal));
      channels = comm.getUint16(0, false); frames = comm.getUint32(2, false);sampleBits=comm.getUint16(6,false); sourceRate = extended80(new DataView(comm.buffer, 8, 10));
    } else if (id === 'SSND') {
      if (size < 8) throw new Error('AIFF SSND chunk is malformed');
      const sound=new DataView(await range(file,offset+8,8,signal));soundOffset=sound.getUint32(0,false);soundBytes=size-8;
      if(soundOffset>soundBytes)throw new Error('AIFF SSND audio offset is invalid');
    }
    if (channels && soundBytes>=0) break;
    offset = next;
  }
  if(soundBytes<0)throw new Error('AIFF is missing audio data');
  const bytesPerSample=Math.ceil(sampleBits/8),expectedBytes=frames*channels*bytesPerSample,availableBytes=soundBytes-soundOffset;
  if(!Number.isSafeInteger(expectedBytes)||sampleBits<1||sampleBits>32||availableBytes<expectedBytes)throw new Error('AIFF dimensions or SSND data extent are invalid');
  return decodedCost(frames, channels, sourceRate, decoderRate);
}

export async function preflightAudioImport(file: File, remainingDecodedBytes: number, decoderRate: number, signal?: AbortSignal): Promise<AudioImportPreflight> {
  const head = await range(file, 0, Math.min(12, file.size), signal);
  if (head.byteLength < 12) throw new Error('Audio file is too short to contain a supported signature');
  const first = fourCC(head), form = fourCC(head, 8);
  let estimatedDecodedBytes: number | undefined;
  if (first === 'RIFF' && form === 'WAVE') estimatedDecodedBytes = await wav(file, decoderRate, signal);
  else if (first === 'FORM' && form === 'AIFF') estimatedDecodedBytes = await aiff(file, decoderRate, signal);
  else {
    if (file.size > COMPRESSED_INPUT_LIMIT) throw new Error('Compressed audio input exceeds the 64 MiB import limit');
    return { kind: 'compressed' };
  }
  if(estimatedDecodedBytes===undefined) {
    if(file.size>COMPRESSED_INPUT_LIMIT)throw new Error('Compressed audio input exceeds the 64 MiB import limit');
    return {kind:'compressed'};
  }
  if (estimatedDecodedBytes > remainingDecodedBytes) throw new Error('128 MiB decoded-audio project limit reached');
  return { kind: 'pcm', estimatedDecodedBytes };
}
