export interface SampleSection {inPoint:number;outPoint:number}
export function normalizeSection(buffer:Pick<AudioBuffer,'length'|'sampleRate'>,section?:SampleSection):SampleSection {
 const rate=buffer.sampleRate,length=buffer.length;
 const start=Math.max(0,Math.min(length-1,Math.round((Number.isFinite(section?.inPoint)?section!.inPoint:0)*rate)));
 const end=Math.max(start+1,Math.min(length,Math.round((Number.isFinite(section?.outPoint)?section!.outPoint:length/rate)*rate)));
 return {inPoint:start/rate,outPoint:end/rate};
}
export function sectionForAnalysis(buffer:AudioBuffer,section:SampleSection) {
 const bounds=normalizeSection(buffer,section),start=Math.round(bounds.inPoint*buffer.sampleRate),end=Math.round(bounds.outPoint*buffer.sampleRate);
 return {length:end-start,sampleRate:buffer.sampleRate,numberOfChannels:buffer.numberOfChannels,getChannelData:(channel:number)=>buffer.getChannelData(channel).subarray(start,end)};
}
