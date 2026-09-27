import { describe, expect, it } from 'vitest';
import { appReducer, initialState, type AppAction, type AppState, type DrumSample } from '../../context/AppContext';
import { createHistory, reduceHistory } from '../../utils/projectHistory';
import { generateStudioSeedKit } from '../../utils/studioDemo';
import { validateProjectArchiveMetadata } from '../../utils/projectArchive';

function loadedSample(name:string,index:number,frames=64):DrumSample {
  const audioBuffer=new AudioBuffer({numberOfChannels:1,length:frames,sampleRate:44100});
  const file=new File(['old'],`${name}.wav`,{type:'audio/wav'});
  return {...initialState.drumSamples[index],name,file,audioBuffer,isLoaded:true,isAssigned:true,assignedKey:index,
    inPoint:0,outPoint:audioBuffer.duration,originalBitDepth:16,originalSampleRate:44100,originalChannels:1,fileSize:file.size,duration:audioBuffer.duration,sourceIdentity:`asset-${name}`};
}

function action(kit:Awaited<ReturnType<typeof generateStudioSeedKit>>,state:AppState,mode:'add'|'replace',operationId='demo-1'):AppAction {
  return {type:'COMMIT_STUDIO_SEED',payload:{operationId,expectedProjectGeneration:state.projectGeneration??0,mode,kit}} as AppAction;
}

describe('Studio Seed application', () => {
  it('relocates an unassigned asset into the physical pad and retains an occupied sound in the tray',()=>{
    const occupied=loadedSample('occupied',0),tray={...loadedSample('tray',0),isAssigned:false,assignedKey:undefined};
    const state={...initialState,drumSamples:[occupied,...initialState.drumSamples.slice(1),tray]};
    const next=appReducer(state,{type:'ASSIGN_DRUM_SAMPLE',payload:{sampleIndex:24,targetKeyIndex:0}});
    expect(next.drumSamples[0].file).toBe(tray.file);
    expect(next.drumSamples[0]).toMatchObject({isAssigned:true,assignedKey:0});
    expect(next.drumSamples[24].file).toBe(occupied.file);
    expect(next.drumSamples[24]).toMatchObject({isAssigned:false,assignedKey:undefined});
  });

  it('replaces only the drum kit in one undoable action with explicit device settings', async () => {
    const old=loadedSample('Old kick',0);
    const state={...initialState,drumSamples:[old,...initialState.drumSamples.slice(1)],multisampleFiles:[{...initialState.multisampleFiles[0]}].filter(Boolean)};
    const kit=await generateStudioSeedKit();

    let history=reduceHistory(createHistory(state),action(kit,state,'replace'),appReducer);

    expect(history.present.drumSamples.filter(sample=>sample.isLoaded).map(sample=>sample.name)).toEqual(kit.samples.map(sample=>sample.name));
    expect(history.present.drumSettings).toMatchObject({presetName:'Studio Seed',sampleRate:44100,bitDepth:16,channels:1,normalize:false,audioFormat:'wav'});
    expect(history.present.studioSeedCommitResult).toEqual({operationId:'demo-1',status:'committed',assignedCount:10,unassignedCount:0,selectedIndex:0});
    expect(history.past).toHaveLength(1);

    history=reduceHistory(history,{type:'UNDO'},appReducer);
    expect(history.present.drumSamples[0].file).toBe(old.file);
    expect(history.present.drumSettings.presetName).toBe(initialState.drumSettings.presetName);
    history=reduceHistory(history,{type:'REDO'},appReducer);
    expect(history.present.drumSamples[0].file).toBe(kit.samples[0].file);
  });

  it('adds around occupied destinations without replacing existing audio', async () => {
    const old=loadedSample('Keep kick',0);
    const state={...initialState,drumSettings:{...initialState.drumSettings,presetName:'Keep settings',bitDepth:24},drumSamples:[old,...initialState.drumSamples.slice(1)]};
    const kit=await generateStudioSeedKit();

    const next=appReducer(state,action(kit,state,'add'));

    expect(next.drumSamples[0].file).toBe(old.file);
    expect(next.drumSamples[1].name).toBe('Seed Kick');
    expect(next.drumSettings.presetName).toBe('Keep settings');
    expect(next.drumSettings.bitDepth).toBe(24);
    expect(next.studioSeedCommitResult).toMatchObject({status:'committed',assignedCount:10,unassignedCount:0});
  });

  it('rejects stale preparation and a replacement whose immediately previous assets cannot fit undo history', async () => {
    const kit=await generateStudioSeedKit();
    const stale=appReducer(initialState,{type:'COMMIT_STUDIO_SEED',payload:{operationId:'stale',expectedProjectGeneration:99,mode:'replace',kit}} as AppAction);
    expect(stale.drumSamples).toBe(initialState.drumSamples);
    expect(stale.studioSeedCommitResult).toMatchObject({operationId:'stale',status:'rejected',error:expect.stringMatching(/project changed/i)});

    const huge={...loadedSample('Huge',0),audioBuffer:{length:33_554_433,numberOfChannels:1,sampleRate:44100,getChannelData(){return new Float32Array(0);}} as unknown as AudioBuffer};
    const state={...initialState,drumSamples:[huge,...initialState.drumSamples.slice(1)]};
    const rejected=appReducer(state,action(kit,state,'replace','too-large'));
    expect(rejected.drumSamples).toBe(state.drumSamples);
    expect(rejected.studioSeedCommitResult).toMatchObject({status:'rejected',error:expect.stringMatching(/undo/i)});
  });

  it('rejects Add when the complete backup manifest would exceed its byte limit', async () => {
    const state={...initialState,importedDrumPreset:{type:'drum',payload:'d'.repeat(2_090_000)}};
    validateProjectArchiveMetadata(state);
    const kit=await generateStudioSeedKit();
    const rejected=appReducer(state,action(kit,state,'add','manifest-limit'));
    expect(rejected.drumSamples).toBe(state.drumSamples);
    expect(rejected.studioSeedCommitResult).toMatchObject({operationId:'manifest-limit',status:'rejected',error:expect.stringMatching(/manifest.*large/i)});
  });
});
