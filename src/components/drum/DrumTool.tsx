import { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { RecordingModal, type RecordingTarget } from '../common/RecordingModal';
import { AudioProcessingSection } from '../common/AudioProcessingSection';

import { DrumSampleTable } from './DrumSampleTable';
import { DrumPresetSettings } from './DrumPresetSettings';
import { DrumBulkEditModal } from './DrumBulkEditModal';
import { useFileUpload } from '../../hooks/useFileUpload';
import { audioBufferToWav } from '../../utils/wavExport';
import { AUDIO_FILE_ACCEPT, readAudioMetadata } from '../../utils/audioFormats';
import { DrumKeyboardContainer } from './DrumKeyboardContainer';
import { sessionStorageIndexedDB } from '../../utils/sessionStorageIndexedDB';
import { parseOP1DrumPreset, isOP1DrumPreset } from '../../utils/op1DrumPresetParser';
import { AUDIO_CONSTANTS } from '../../utils/constants';
import { SliceAudioModal, type SliceSourceRequest } from './SliceAudioModal';
import type { PreparedSliceApplication } from '../../utils/audioSlicing';
import { useAudioImport } from '../common/AudioImportContext';
import { DrumFocusWorkspace } from './DrumFocusWorkspace';
import { FirstPresetGuide, KitSetupGuide, StudioDemoLoader } from './StudioDemoLoader';
import type { DrumSample } from '../../context/AppContext';
import type { RecorderRequest } from '../common/MainTabs';

export function DrumTool({ recorderRequest, onRecorderRequestConsumed }: {
  recorderRequest?: RecorderRequest | null;
  onRecorderRequestConsumed?: () => void;
} = {}) {
  const { state, dispatch } = useAppContext();
  const { handleDrumSampleUpload, clearDrumSample } = useFileUpload();
  const audioImport=useAudioImport();
  const consumedRecorderRequest = useRef<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void | Promise<void>;
  }>({ isOpen: false, message: '', onConfirm: async () => {} });
  const [recordingModal, setRecordingModal] = useState<{
    isOpen: boolean;
    target: RecordingTarget;
  }>({ isOpen: false, target: {kind:'drum'} });
  const [bulkEditModal, setBulkEditModal] = useState(false);
  const [isOrganizeMode, setIsOrganizeMode] = useState(false);
  const [workspaceView,setWorkspaceView]=useState<'focus'|'table'>('focus');
  const [selectedSampleIndex,setSelectedSampleIndex]=useState(0);
  const selectedAssetRef=useRef(state.drumSamples[0]);
  const explicitSelectedPadRef=useRef<number|null>(null);
  const [sliceRequest, setSliceRequest] = useState<SliceSourceRequest | null>(null);
  const sliceSourceInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const currentStateRef = useRef(state);
  const op1OperationRef = useRef(0);
  currentStateRef.current = state;

  const selectSample=(index:number,expectedAsset?:DrumSample)=>{setSelectedSampleIndex(index);selectedAssetRef.current=expectedAsset??state.drumSamples[index];explicitSelectedPadRef.current=index<24?index:null;};
  useEffect(()=>{
    const selected=selectedAssetRef.current;
    if(!selected)return;
    const moved=state.drumSamples.findIndex(sample=>sample===selected||(sample?.file===selected.file&&sample?.audioBuffer===selected.audioBuffer&&sample.file!==null));
    if(moved>=0&&moved!==selectedSampleIndex)setSelectedSampleIndex(moved);
  },[state.drumSamples,selectedSampleIndex]);

  const handleSampleRateChange = (value: string) => {
    dispatch({ type: 'SET_DRUM_SAMPLE_RATE', payload: parseInt(value) });
  };

  const handleBitDepthChange = (value: string) => {
    dispatch({ type: 'SET_DRUM_BIT_DEPTH', payload: parseInt(value) });
  };

  const handleChannelsChange = (value: string) => {
    dispatch({ type: 'SET_DRUM_CHANNELS', payload: parseInt(value) });
  };

  const handleNormalizeChange = (enabled: boolean) => {
    dispatch({ type: 'SET_DRUM_NORMALIZE', payload: enabled });
  };

  const handleNormalizeLevelChange = (level: number) => {
    dispatch({ type: 'SET_DRUM_NORMALIZE_LEVEL', payload: level });
  };

  const handleResetAudioSettingsConfirm = () => {
    setConfirmDialog({
      isOpen: true,
      message: 'are you sure you want to reset all audio processing settings to defaults?',
      onConfirm: () => {
        dispatch({ type:'BATCH_EDIT', payload:[
          { type:'SET_DRUM_SAMPLE_RATE', payload:0 },
          { type:'SET_DRUM_BIT_DEPTH', payload:0 },
          { type:'SET_DRUM_CHANNELS', payload:0 },
          { type:'SET_DRUM_NORMALIZE', payload:false },
          { type:'SET_DRUM_NORMALIZE_LEVEL', payload:AUDIO_CONSTANTS.DRUM_NORMALIZATION_LEVEL },
        ] });
        setConfirmDialog({ isOpen: false, message: '', onConfirm: async () => {} });
      }
    });
  };

  const handleFileUpload = async (index: number, file: File) => {
    try {
      if(audioImport){audioImport.beginFiles([file],{instrument:'drum',drumPads:[index]});return;}
      // Validate file before processing
      if (!file || file.size === 0) {
        throw new Error('Invalid file: file is empty or null');
      }

      // Check file type
      const isValidAudioFile = file.type.startsWith('audio/') ||
                              file.name.toLowerCase().endsWith('.wav') ||
                              file.name.toLowerCase().endsWith('.aif') ||
                              file.name.toLowerCase().endsWith('.aiff') ||
                              file.name.toLowerCase().endsWith('.mp3') ||
                              file.name.toLowerCase().endsWith('.m4a') ||
                              file.name.toLowerCase().endsWith('.ogg') ||
                              file.name.toLowerCase().endsWith('.flac');

      if (!isValidAudioFile) {
        throw new Error(`Unsupported file type: ${file.type}. Please upload a WAV, AIF, AIFF, MP3, M4A, OGG, or FLAC file.`);
      }

      await handleDrumSampleUpload(file,index);
    } catch (error) {
      console.error('Error uploading file:', error);
      // You could add user notification here if needed
    }
  };

  const handleFocusedFileUpload=async(index:number,file:File)=>{
    if(index<24){
      const target=state.drumSamples[index];
      if(audioImport&&target?.isLoaded&&target.file&&target.audioBuffer){audioImport.beginFiles([file],{instrument:'drum',drumPadReplacement:{padIndex:index,expected:{file:target.file,audioBuffer:target.audioBuffer}}});return;}
      await handleFileUpload(index,file);return;
    }
    const target=state.drumSamples[index];
    if(audioImport&&target?.file&&target.audioBuffer){audioImport.beginFiles([file],{instrument:'drum',drumReplacement:{file:target.file,audioBuffer:target.audioBuffer}});return;}
    dispatch({type:'ADD_NOTIFICATION',payload:{id:crypto.randomUUID(),type:'error',title:'replacement not applied',message:'The selected tray sound is no longer available. Select it again.'}});
  };

  const handleFilesUpload = async (startIndex:number,files:File[]) => {
    const pads=files.map((_file,offset)=>startIndex+offset).filter(index=>index<24);
    if(audioImport){audioImport.beginFiles(files,{instrument:'drum',drumPads:pads});return;}
    for(const [offset,file] of files.entries())await handleFileUpload(startIndex+offset,file);
  };

  const handleOP1PresetImport = async (file: File) => {
    const expectedProjectGeneration=state.projectGeneration??0;
    const operation=++op1OperationRef.current;
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Check if this is an OP-1 drum preset
      if (!isOP1DrumPreset(arrayBuffer)) {
        throw new Error('This file does not appear to be a valid OP-1 drum preset');
      }

      // Parse the OP-1 drum preset
      const preset = await parseOP1DrumPreset(arrayBuffer, file.name);

      // Convert samples to the format expected by the app context
      const samples = await Promise.all(preset.samples.map(async sample => {
        // Convert AudioBuffer to WAV blob for file creation
        const wavBlob = await audioBufferToWav(sample.audioBuffer);
        const file = new File([wavBlob], `${sample.name}.wav`, { type: 'audio/wav' });

        return {
          keyIndex: sample.keyIndex,
          file,
          audioBuffer: sample.audioBuffer,
          metadata: sample.metadata,
          name: sample.name
        };
      }));

      if(operation!==op1OperationRef.current||(currentStateRef.current.projectGeneration??0)!==expectedProjectGeneration)throw new Error('The project was replaced or another OP-1 import started while this preset was preparing. Start the import again.');

      // Import the preset into the app state
      dispatch({
        type: 'IMPORT_OP1_DRUM_PRESET',
        payload: {
          samples,
          presetName: preset.name
        }
      });

      // Show success notification
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'success',
          title: 'OP-1 preset imported',
          message: `"${preset.name}" loaded with ${preset.samples.length} samples`
        }
      });

    } catch (error) {
      console.error('Error importing OP-1 preset:', error);
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'error',
          title: 'import failed',
          message: error instanceof Error ? error.message : 'failed to import OP-1 preset'
        }
      });
    } finally {
      if(operation===op1OperationRef.current)dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const handleClearSample = (index: number) => {
    setConfirmDialog({
      isOpen: true,
      message: 'are you sure you want to clear this sample?',
      onConfirm: async () => {
        clearDrumSample(index);
        setConfirmDialog({ isOpen: false, message: '', onConfirm: async () => {} });
      }
    });
  };

  const handleAddUnassignedSamples = async (files: File[],selectedPad:number|null=null) => {
    if(audioImport){
      audioImport.beginFiles(files,files.length===1&&selectedPad!==null?{instrument:'drum',drumPads:[selectedPad]}:{instrument:'drum'});
      return;
    }
    for(const file of files){
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const metadata = await readAudioMetadata(file, state.midiNoteMapping);

      dispatch({
        type: 'ADD_UNASSIGNED_DRUM_SAMPLE',
        payload: {
          file,
          audioBuffer: metadata.audioBuffer,
          metadata
        }
      });

      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'success',
          title: 'sample added',
          message: `"${file.name}" added as unassigned sample`
        }
      });

    } catch (error) {
      console.error('Error adding unassigned sample:', error);
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'error',
          title: 'upload failed',
          message: error instanceof Error ? error.message : 'failed to add sample'
        }
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
    }
  };

  const openExistingSlicer = (index: number) => {
    const sample = state.drumSamples[index];
    if (!sample?.isLoaded || !sample.audioBuffer || !sample.file) return;
    const extension = sample.file.name.toLowerCase().split('.').pop();
    const format = extension==='aif'?'aif':extension==='aiff'?'aiff':extension==='mp3'?'mp3':extension==='m4a'?'m4a':extension==='ogg'?'ogg':extension==='flac'?'flac':'wav';
    setSliceRequest({kind:'existing',source:{
      audioBuffer:sample.audioBuffer,file:sample.file,existingIndex:index,
      metadata:{format,sampleRate:sample.audioBuffer.sampleRate,sourceSampleRate:sample.originalSampleRate,
        bitDepth:sample.originalBitDepth,channels:sample.audioBuffer.numberOfChannels,sourceChannels:sample.originalChannels,duration:sample.duration??sample.audioBuffer.duration,
        audioBuffer:sample.audioBuffer,fileSize:sample.fileSize??sample.file.size,midiNote:60,loopStart:0,loopEnd:sample.audioBuffer.duration,hasLoopData:false,isFloat:sample.isFloat},
    }});
  };

  const applyPreparedSlices = (operationId:string,prepared:PreparedSliceApplication) => {
    dispatch({type:'COMMIT_PREPARED_SLICES',payload:{operationId,prepared}});
  };




  const handleClearAll = async () => {
    setConfirmDialog({
      isOpen: true,
      message: 'are you sure you want to clear all loaded samples?',
      onConfirm: async () => {
        // Clear all samples and reset to 24 slots
        dispatch({ type: 'CLEAR_ALL_DRUM_SAMPLES' });
        // Reset saved to library flag since we're starting fresh
        await sessionStorageIndexedDB.resetSavedToLibraryFlag();
        setConfirmDialog({ isOpen: false, message: '', onConfirm: async () => {} });
      }
    });
  };

  const handleResetAll = async () => {
    setConfirmDialog({
      isOpen: true,
      message: 'are you sure you want to reset everything to defaults? this will clear all samples, reset preset name, audio settings and preset settings.',
      onConfirm: async () => {
        dispatch({ type:'BATCH_EDIT', payload:[
          { type:'BUMP_PROJECT_GENERATION' },
          { type:'CLEAR_ALL_DRUM_SAMPLES' },
          { type:'SET_DRUM_PRESET_NAME', payload:'' },
          { type:'SET_DRUM_SAMPLE_RATE', payload:0 },
          { type:'SET_DRUM_BIT_DEPTH', payload:0 },
          { type:'SET_DRUM_CHANNELS', payload:0 },
          { type:'SET_DRUM_NORMALIZE', payload:false },
          { type:'SET_DRUM_NORMALIZE_LEVEL', payload:AUDIO_CONSTANTS.DRUM_NORMALIZATION_LEVEL },
          { type:'SET_DRUM_RENAME_FILES', payload:false },
          { type:'SET_DRUM_FILENAME_SEPARATOR', payload:' ' },
          { type:'SET_DRUM_PRESET_PLAYMODE', payload:'poly' },
          { type:'SET_DRUM_PRESET_TRANSPOSE', payload:0 },
          { type:'SET_DRUM_PRESET_VELOCITY', payload:20 },
          { type:'SET_DRUM_PRESET_VOLUME', payload:69 },
          { type:'SET_DRUM_PRESET_WIDTH', payload:0 },
        ] });

        // Reset saved to library flag since we're starting fresh
        await sessionStorageIndexedDB.resetSavedToLibraryFlag();

        setConfirmDialog({ isOpen: false, message: '', onConfirm: async () => {} });
      }
    });
  };

  const handleOpenRecording = (targetIndex: number | null = null) => {
    const current=targetIndex===null?undefined:state.drumSamples[targetIndex];
    setRecordingModal({ isOpen: true, target: {kind:'drum',...(targetIndex===null?{}:{padIndex:targetIndex,expected:{audioBuffer:current?.audioBuffer??null,file:current?.file??null}})} });
  };

  const handleCloseRecording = () => {
    setRecordingModal(current => ({ ...current, isOpen: false }));
  };

  useEffect(() => {
    if (!recorderRequest || consumedRecorderRequest.current === recorderRequest.id) return;
    consumedRecorderRequest.current = recorderRequest.id;
    setRecordingModal({ isOpen: true, target: { kind: 'drum' } });
    onRecorderRequestConsumed?.();
  }, [recorderRequest, onRecorderRequestConsumed]);

  const hasLoadedSamples = state.drumSamples.some(s => s && s.isLoaded);
  const hasMultipleLoadedSamples = state.drumSamples.filter(s => s && s.isLoaded).length > 1;
  return (
    <div className="studio-editor-root">

      <div className="studio-editor-intro"><StudioDemoLoader onSelected={selectSample}/><KitSetupGuide/><FirstPresetGuide/></div>

      <div className="studio-instrument-grid studio-editor-stage studio-editor-stage--drum">
      <div className="studio-performance-column studio-performance-column--drum">
      {/* Always Visible Drum Keyboard Section with pinning */}
      <div className="studio-performance-body">
        <DrumKeyboardContainer
          onFileUpload={handleFileUpload}
          isOrganizeMode={isOrganizeMode}
          setIsOrganizeMode={setIsOrganizeMode}
          selectedSampleIndex={selectedSampleIndex}
          onSelectSample={selectSample}
          onPlaySample={()=>window.dispatchEvent(new CustomEvent('opstudio-sample-played'))}
        />
      </div>
      <div className="studio-creative-actions studio-editor-command-bar" aria-label="Add and create sounds">
        <button type="button" className="studio-button-primary" onClick={()=>(window as Window & {unassignedSampleInput?:HTMLInputElement}).unassignedSampleInput?.click()}>Add sounds</button>
        <button type="button" className="studio-button-secondary" onClick={()=>sliceSourceInputRef.current?.click()}>Slice audio</button>
        <button type="button" className="studio-button-secondary" data-studio-open-recording="drum" onClick={()=>handleOpenRecording()}>Record takes</button>
      </div>
      </div>

      {/* Tabbed Content Area */}
      <div className="studio-editor-column studio-editor-column--drum">
        {/* Sample Management Section */}
        <div className="studio-management-panel">
          {/* Header */}
          <div className="studio-section-heading">
            <div className="studio-section-heading-title">
              <h3>Sample management</h3>
            </div>
            <div className="studio-view-switch" aria-label="Sample workspace view">
              <button type="button" aria-pressed={workspaceView==='focus'} onClick={()=>setWorkspaceView('focus')}>Focus</button>
              <button type="button" aria-pressed={workspaceView==='table'} onClick={()=>setWorkspaceView('table')}>Table</button>
            </div>
          </div>

          {/* Content */}
          <div className="studio-management-body">
            {workspaceView==='focus' ? <DrumFocusWorkspace
              selectedIndex={selectedSampleIndex}
              onSelect={selectSample}
              onFileUpload={handleFocusedFileUpload}
              onClear={handleClearSample}
              onRecord={index=>handleOpenRecording(index)}
              onSlice={openExistingSlicer}
              onPlayed={()=>window.dispatchEvent(new CustomEvent('opstudio-sample-played'))}
            /> : <DrumSampleTable
              onFileUpload={handleFileUpload}
              onFilesUpload={handleFilesUpload}
              onClearSample={handleClearSample}
              onRecordSample={handleOpenRecording}
              isOrganizeMode={isOrganizeMode}
              onSliceSample={openExistingSlicer}
              selectedIndex={selectedSampleIndex}
              onSelectSample={selectSample}
            />}
            <div className="studio-utility-actions" aria-label="Drum instrument actions">
              {/* Hidden file input for OP-1 preset import */}
              <input
                type="file"
                aria-label="choose OP-1 preset"
                accept=".aif,.aiff"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleOP1PresetImport(file);
                  }
                  // Reset the input
                  e.target.value = '';
                }}
                ref={(input) => {
                  if (input) {
                    (window as Window & {op1PresetInput?:HTMLInputElement}).op1PresetInput = input;
                  }
                }}
              />
              <input ref={input=>{directoryInputRef.current=input;input?.setAttribute('webkitdirectory','')}} aria-label="choose drum sample folder" type="file" multiple accept={AUDIO_FILE_ACCEPT} style={{display:'none'}} onChange={event=>{void handleAddUnassignedSamples(Array.from(event.target.files??[]));event.target.value='';}}/>
              {/* Hidden file input for unassigned samples */}
              <input
                type="file"
                multiple
                aria-label="choose drum audio files"
                accept={AUDIO_FILE_ACCEPT}
                style={{ display: 'none' }}
                onChange={(e) => {
                  const files = [...(e.target.files || [])];
                  void handleAddUnassignedSamples(files,explicitSelectedPadRef.current);
                  // Reset the input
                  e.target.value = '';
                }}
                ref={(input) => {
                  if (input) {
                    (window as Window & {unassignedSampleInput?:HTMLInputElement}).unassignedSampleInput = input;
                  }
                }}
              />
              <input ref={sliceSourceInputRef} aria-label="choose audio to slice" type="file" accept=".wav,.aif,.aiff,audio/wav,audio/aiff" style={{display:'none'}} onChange={event=>{
                const file=event.target.files?.[0];if(file)setSliceRequest({kind:'file',file});event.target.value='';
              }}/>
              <button type="button" className="studio-utility-action studio-utility-action--danger" onClick={handleResetAll}>reset instrument</button>
              <button
                type="button"
                className="studio-utility-action studio-utility-action--danger"
                onClick={handleClearAll}
                disabled={!hasLoadedSamples}
              >
                <i className="fas fa-trash" aria-hidden="true" style={{ fontSize: '1rem' }}></i>
                clear all
              </button>
              <button
                type="button"
                className="studio-utility-action studio-utility-action--import"
                onClick={() => (window as Window & {op1PresetInput?:HTMLInputElement}).op1PresetInput?.click()}
              >
                <i className="fas fa-upload" aria-hidden="true" style={{ fontSize: '1rem' }}></i>
                import OP-1 preset
              </button>
              <button
                type="button"
                className="studio-utility-action"
                onClick={() => setBulkEditModal(true)}
                disabled={!hasMultipleLoadedSamples}
              >
                <i className="fas fa-pencil" aria-hidden="true" style={{ fontSize: '1rem' }}></i>
                bulk edit
              </button>
              <button type="button" className="studio-utility-action" onClick={()=>directoryInputRef.current?.click()}>browse folder</button>
            </div>
          </div>
        </div>
      </div>
      </div>

      <details className="studio-advanced-disclosure">
        <summary>Preset and performance settings <span>{state.drumSettings.presetSettings.playmode} · transpose {state.drumSettings.presetSettings.transpose} · volume {state.drumSettings.presetSettings.volume}%</span></summary>
        <div><DrumPresetSettings /></div>
      </details>

      <details className="studio-advanced-disclosure">
        <summary>Audio output and processing <span>{state.drumSettings.audioFormat.toUpperCase()} · {state.drumSettings.sampleRate/1000} kHz · {state.drumSettings.bitDepth}-bit · {state.drumSettings.channels===1?'mono':state.drumSettings.channels===2?'stereo':'original channels'}</span></summary>
        <div>
        <AudioProcessingSection
          type="drum"
          sampleRate={state.drumSettings.sampleRate}
          bitDepth={state.drumSettings.bitDepth}
          channels={state.drumSettings.channels}
          onSampleRateChange={handleSampleRateChange}
          onBitDepthChange={handleBitDepthChange}
          onChannelsChange={handleChannelsChange}
          samples={state.drumSamples}
          normalize={state.drumSettings.normalize}
          normalizeLevel={state.drumSettings.normalizeLevel}
          onNormalizeChange={handleNormalizeChange}
          onNormalizeLevelChange={handleNormalizeLevelChange}
          autoZeroCrossing={state.drumSettings.autoZeroCrossing}
          onAutoZeroCrossingChange={() => {
            dispatch({ type: 'APPLY_ZERO_CROSSING_TO_ALL_DRUM_SAMPLES' });
          }}
          onResetAudioSettingsConfirm={handleResetAudioSettingsConfirm}
        />
        </div>
      </details>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmDialog.isOpen}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: async () => {} })}
      />

      {/* Recording Modal */}
      <RecordingModal
        isOpen={recordingModal.isOpen}
        onClose={handleCloseRecording}
        instrument="drum"
        target={recordingModal.target}
        maxDuration={20}
      />

      {/* Bulk Edit Modal */}
      <DrumBulkEditModal
        isOpen={bulkEditModal}
        onClose={() => setBulkEditModal(false)}
      />
      <SliceAudioModal isOpen={sliceRequest!==null} request={sliceRequest} existingSamples={state.drumSamples} projectAssets={[...state.drumSamples,...state.multisampleFiles]} midiNoteMapping={state.midiNoteMapping}
        commitResult={state.sliceCommitResult} onClose={()=>setSliceRequest(null)} onApply={applyPreparedSlices}/>
    </div>
  );
}
