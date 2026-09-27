import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { RecordingModal, type GuidedRecordingIntent, type RecordingTarget } from '../common/RecordingModal';
import { AudioProcessingSection } from '../common/AudioProcessingSection';
import { ErrorDisplay } from '../common/ErrorDisplay';
import { MultisampleSampleTable } from './MultisampleSampleTable';
import { MultisamplePresetSettings } from './MultisamplePresetSettings';
import { VirtualMidiKeyboard } from './VirtualMidiKeyboard';
import { useFileUpload } from '../../hooks/useFileUpload';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { cookieUtils, COOKIE_KEYS } from '../../utils/cookies';
import { sessionStorageIndexedDB } from '../../utils/sessionStorageIndexedDB';
import { ToggleSwitch } from '../common/ToggleSwitch';
import { AUDIO_CONSTANTS } from '../../utils/constants';
import { useAudioImport } from '../common/AudioImportContext';
import { AUDIO_FILE_ACCEPT } from '../../utils/audioFormats';
import { MultisampleFocusWorkspace } from './MultisampleFocusWorkspace';
import type { RecorderRequest } from '../common/MainTabs';


export function MultisampleTool({ recorderRequest, onRecorderRequestConsumed }: {
  recorderRequest?: RecorderRequest | null;
  onRecorderRequestConsumed?: () => void;
} = {}) {
  const { state, dispatch } = useAppContext();
  const audioImport=useAudioImport();
  const consumedRecorderRequest = useRef<number | null>(null);
  const { handleMultisampleUpload, clearMultisampleFile } = useFileUpload();
  const { playWithADSR, releaseNote, stopAllNotes } = useAudioPlayer();
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const browseInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const browseFilesRef = useRef<(() => void) | null>(null);
  const [workspaceView,setWorkspaceView]=useState<'focus'|'table'>('focus');
  const [selectedIndex,setSelectedIndex]=useState(state.selectedMultisample??0);
  const selectedAssetRef=useRef<(typeof state.multisampleFiles)[number]|undefined>(state.multisampleFiles[selectedIndex]);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void | Promise<void>;
  }>({ isOpen: false, message: '', onConfirm: async () => {} });
  const [recordingModal, setRecordingModal] = useState<{
    isOpen: boolean;
    target: RecordingTarget;
    guidedIntent?: GuidedRecordingIntent;
  }>({ isOpen: false, target: {kind:'multisample'} });

  const [targetMidiNote, setTargetMidiNote] = useState<number | null>(null);
  const [selectedMidiChannel, setSelectedMidiChannel] = useState(() => {
    const saved = localStorage.getItem('midi-channel');
    return saved ? parseInt(saved, 10) : 1;
  });
  const selectZone=useCallback((index:number)=>{setSelectedIndex(index);selectedAssetRef.current=state.multisampleFiles[index];dispatch({type:'SET_SELECTED_MULTISAMPLE',payload:index});},[dispatch,state.multisampleFiles]);
  useEffect(()=>{const files=state.multisampleFiles;if(!files.length){selectedAssetRef.current=undefined;if(selectedIndex!==0)setSelectedIndex(0);if(state.selectedMultisample!=null)dispatch({type:'SET_SELECTED_MULTISAMPLE',payload:null});return;}
    const selected=selectedAssetRef.current;let resolved=selected?files.findIndex(file=>file===selected||(file.file===selected.file&&file.audioBuffer===selected.audioBuffer)):-1;
    if(resolved<0)resolved=state.selectedMultisample!==null&&state.selectedMultisample!==undefined&&state.selectedMultisample>=0&&state.selectedMultisample<files.length?state.selectedMultisample:Math.min(selectedIndex,files.length-1);
    selectedAssetRef.current=files[resolved];if(resolved!==selectedIndex)setSelectedIndex(resolved);if(state.selectedMultisample!==resolved)dispatch({type:'SET_SELECTED_MULTISAMPLE',payload:resolved});
  },[dispatch,state.multisampleFiles,state.selectedMultisample,selectedIndex]);

  // Get pin state from context
  const { isMultisampleKeyboardPinned } = state;

  const handleTogglePin = useCallback(() => {
    dispatch({ type: 'TOGGLE_MULTISAMPLE_KEYBOARD_PIN' });
  }, [dispatch]);

  // Effect to save pin state to cookies
  useEffect(() => {
    try {
      cookieUtils.setCookie(COOKIE_KEYS.MULTISAMPLE_KEYBOARD_PINNED, String(isMultisampleKeyboardPinned));
    } catch (error) {
      console.warn('Failed to save multisample keyboard pin state to cookie:', error);
    }
  }, [isMultisampleKeyboardPinned]);

  // Create a zone map for the multisamples
  const zoneMap = useMemo(() => {
    const map = new Map<number, { rootNote: number; pitchOffset: number }>();
    if (state.multisampleFiles.length === 0) {
      return map;
    }

    // Sort samples by rootNote ascending for proper zone calculation
    const sortedSamples = [...state.multisampleFiles].sort((a, b) => a.rootNote - b.rootNote);

    // Iterate through all MIDI notes
    for (let midiNote = 0; midiNote <= 127; midiNote++) {
      let rootSample = null;

      // Find the sample that should handle this MIDI note
      // Rule: Each sample covers from its root note DOWN to just above the next lower sample
      // The topmost sample also covers notes UP from its root note

      for (let i = sortedSamples.length - 1; i >= 0; i--) {
        const sample = sortedSamples[i];
        const prevSample = i > 0 ? sortedSamples[i - 1] : null;

        if (i === sortedSamples.length - 1) {
          // Topmost sample - covers from its root note UP to 127
          if (midiNote >= sample.rootNote) {
            rootSample = sample;
            break;
          }
        }

        // All samples (including topmost) cover DOWN from their root note
        if (prevSample) {
          // Has a lower sample - covers from just above prev sample down to its own root
          if (midiNote > prevSample.rootNote && midiNote <= sample.rootNote) {
            rootSample = sample;
            break;
          }
        } else {
          // Lowest sample - covers from its root note down to MIDI note 0
          if (midiNote <= sample.rootNote) {
            rootSample = sample;
            break;
          }
        }
      }

      if (rootSample) {
        map.set(midiNote, {
          rootNote: rootSample.rootNote,
          pitchOffset: midiNote - rootSample.rootNote,
        });
      }
    }
    return map;
  }, [state.multisampleFiles]);

  const handleSampleRateChange = (value: string) => {
    dispatch({ type: 'SET_MULTISAMPLE_SAMPLE_RATE', payload: parseInt(value, 10) });
  };

  const handleBitDepthChange = (value: string) => {
    dispatch({ type: 'SET_MULTISAMPLE_BIT_DEPTH', payload: parseInt(value, 10) });
  };

  const handleChannelsChange = (value: string) => {
    dispatch({ type: 'SET_MULTISAMPLE_CHANNELS', payload: parseInt(value, 10) });
  };

  const handleNormalizeChange = (enabled: boolean) => {
    dispatch({ type: 'SET_MULTISAMPLE_NORMALIZE', payload: enabled });
  };

  const handleNormalizeLevelChange = (level: number) => {
    dispatch({ type: 'SET_MULTISAMPLE_NORMALIZE_LEVEL', payload: level });
  };

  const handleGainChange = (gain: number) => {
    dispatch({ type: 'SET_MULTISAMPLE_GAIN', payload: gain });
  };

  const handleCutAtLoopEndChange = (enabled: boolean) => {
    dispatch({ type: 'SET_MULTISAMPLE_CUT_AT_LOOP_END', payload: enabled });
  };

  const handleResetAudioSettingsConfirm = () => {
    setConfirmDialog({
      isOpen: true,
      message: 'are you sure you want to reset all audio processing settings to defaults?',
      onConfirm: () => {
        dispatch({ type:'BATCH_EDIT', payload:[
          { type:'SET_MULTISAMPLE_SAMPLE_RATE', payload:0 },
          { type:'SET_MULTISAMPLE_BIT_DEPTH', payload:0 },
          { type:'SET_MULTISAMPLE_CHANNELS', payload:0 },
          { type:'SET_MULTISAMPLE_NORMALIZE', payload:false },
          { type:'SET_MULTISAMPLE_NORMALIZE_LEVEL', payload:AUDIO_CONSTANTS.MULTISAMPLE_NORMALIZATION_LEVEL },
          { type:'SET_MULTISAMPLE_CUT_AT_LOOP_END', payload:false },
          { type:'SET_MULTISAMPLE_GAIN', payload:0 },
          { type:'SET_MULTISAMPLE_LOOP_ENABLED', payload:true },
          { type:'SET_MULTISAMPLE_LOOP_ON_RELEASE', payload:true },
        ] });
        setConfirmDialog({ isOpen: false, message: '', onConfirm: async () => {} });
      }
    });
  };

  const handleFilesSelected = async (files: File[]) => {
    if(audioImport)audioImport.beginFiles(files,{instrument:'multisample'});
    else for (const file of files) await handleMultisampleUpload(file);
  };

  const handleFileUpload = async (index: number, file: File) => {
    try {
      const root=state.multisampleFiles[index]?.rootNote;
      if(audioImport)audioImport.beginFiles([file],{instrument:'multisample',multisampleRoot:root});
      else await handleMultisampleUpload(file,root);
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  const handleClearSample = (index: number) => {
    setConfirmDialog({
      isOpen: true,
      message: 'are you sure you want to clear this sample?',
      onConfirm: async () => {
        clearMultisampleFile(index);
        setConfirmDialog({ isOpen: false, message: '', onConfirm: async () => {} });
      }
    });
  };



  const handleClearAll = async () => {
    setConfirmDialog({
      isOpen: true,
      message: 'are you sure you want to clear all loaded samples?',
      onConfirm: async () => {
        dispatch({ type:'BATCH_EDIT', payload:state.multisampleFiles.map((_,index)=>({
          type:'CLEAR_MULTISAMPLE_FILE' as const,
          payload:state.multisampleFiles.length-index-1,
        })) });
        // Reset saved to library flag since we're starting fresh
        await sessionStorageIndexedDB.resetSavedToLibraryFlag();
        setConfirmDialog({ isOpen: false, message: '', onConfirm: async () => {} });
      }
    });
  };

  const handleResetAll = async () => {
    setConfirmDialog({
      isOpen: true,
      message: 'are you sure you want to reset everything to defaults? this will clear all samples, reset preset name and audio settings.',
      onConfirm: async () => {
        dispatch({ type:'BATCH_EDIT', payload:[
          { type:'BUMP_PROJECT_GENERATION' },
          ...state.multisampleFiles.map((_,index)=>({
            type:'CLEAR_MULTISAMPLE_FILE' as const,
            payload:state.multisampleFiles.length-index-1,
          })),
          { type:'SET_MULTISAMPLE_PRESET_NAME', payload:'' },
          { type:'SET_MULTISAMPLE_SAMPLE_RATE', payload:0 },
          { type:'SET_MULTISAMPLE_BIT_DEPTH', payload:0 },
          { type:'SET_MULTISAMPLE_CHANNELS', payload:0 },
          { type:'SET_MULTISAMPLE_NORMALIZE', payload:false },
          { type:'SET_MULTISAMPLE_NORMALIZE_LEVEL', payload:AUDIO_CONSTANTS.MULTISAMPLE_NORMALIZATION_LEVEL },
          { type:'SET_MULTISAMPLE_CUT_AT_LOOP_END', payload:false },
          { type:'SET_MULTISAMPLE_GAIN', payload:0 },
          { type:'SET_MULTISAMPLE_LOOP_ENABLED', payload:true },
          { type:'SET_MULTISAMPLE_LOOP_ON_RELEASE', payload:true },
          { type:'SET_MULTISAMPLE_RENAME_FILES', payload:false },
          { type:'SET_MULTISAMPLE_FILENAME_SEPARATOR', payload:' ' },
        ] });

        // Reset saved to library flag since we're starting fresh
        await sessionStorageIndexedDB.resetSavedToLibraryFlag();

        setConfirmDialog({ isOpen: false, message: '', onConfirm: async () => {} });
      }
    });
  };

  const handleOpenRecording = useCallback((targetIndex: number | null = null, guidedIntent?:GuidedRecordingIntent) => {
    stopAllNotes();
    const current=targetIndex===null?undefined:state.multisampleFiles[targetIndex];
    setRecordingModal({isOpen:true,target:{kind:'multisample',...(current?{rootNote:current.rootNote,expected:{audioBuffer:current.audioBuffer,file:current.file}}:{})},guidedIntent});
  },[state.multisampleFiles,stopAllNotes]);

  const handleCloseRecording = () => {
    setRecordingModal(current=>({...current,isOpen:false,guidedIntent:undefined}));
  };

  useEffect(() => {
    if (!recorderRequest || consumedRecorderRequest.current === recorderRequest.id) return;
    consumedRecorderRequest.current = recorderRequest.id;
    handleOpenRecording(null, recorderRequest.guided ? { source: recorderRequest.source, requestId: recorderRequest.id } : undefined);
    onRecorderRequestConsumed?.();
  }, [handleOpenRecording, onRecorderRequestConsumed, recorderRequest]);

  const handleAudioFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be selected again
    event.target.value = '';

    if (targetMidiNote !== null) {
      try {
        // Here, we manually create the payload for handleMultisampleUpload
        // so we can set the rootNote BEFORE it goes into the context and gets sorted.
        if(audioImport)audioImport.beginFiles([file],{instrument:'multisample',multisampleRoot:targetMidiNote});
        else await handleMultisampleUpload(file, targetMidiNote);
        setTargetMidiNote(null);
      } catch (error) {
        console.error('Error uploading file for MIDI note assignment:', error);
        setTargetMidiNote(null);
      }
    }
  };

  // Handler for clicking an assigned key
  const handleKeyClick = useCallback(async (midiNote: number) => {
    const zoneInfo = zoneMap.get(midiNote);
    if (!zoneInfo) return;

    const { rootNote, pitchOffset } = zoneInfo;

    // Find the sample that is the root for this zone
    const rootSample = state.multisampleFiles.find(f => f.rootNote === rootNote);

    if (rootSample && rootSample.audioBuffer) {
      try {
        // Apply pitch shifting
        const playbackRate = Math.pow(2, pitchOffset / 12);

        // Get ADSR settings from current multisample settings (which includes defaults and user adjustments)
        const adsrSettings = state.multisampleSettings.ampEnvelope;

        // Get play mode from current multisample settings
        const playMode = state.multisampleSettings.playmode;

        // Use the ADSR-enabled audio player
        const noteId = `multisample-${midiNote}-${Date.now()}`;
        await playWithADSR(rootSample.audioBuffer, noteId, {
          playbackRate,
          gain: state.multisampleSettings.gain || 0,
          pan: 0, // No pan control for multisample
          adsr: adsrSettings,
          playMode: playMode as 'poly' | 'mono' | 'legato',
          velocity: 127, // Full velocity for keyboard clicks
          // Loop settings
          loopEnabled: state.multisampleSettings.loopEnabled,
          loopOnRelease: state.multisampleSettings.loopOnRelease,
          loopStart: rootSample.loopStart,
          loopEnd: rootSample.loopEnd,
        });
      } catch (error) {
        console.error("Error playing pitched sample:", error);
      }
    }
  }, [zoneMap, state.multisampleFiles, playWithADSR, state.multisampleSettings.gain, state.multisampleSettings.ampEnvelope, state.multisampleSettings.playmode, state.multisampleSettings.loopEnabled, state.multisampleSettings.loopOnRelease]);

  // Handler for releasing a key (for ADSR release phase)
  const handleKeyRelease = useCallback((midiNote: number) => {
    // Release all notes that match this MIDI note (could be multiple if same note played multiple times)
    // The audio player will handle finding and releasing the correct note(s)
    // We'll try all possible noteIds for this midiNote
    // (e.g., multisample-60, multisample-60-<timestamp>)
    // For robust release, release all notes that start with `multisample-${midiNote}`
    const activeNotes = window.opPatchstudioActiveNotes || [];
    if (Array.isArray(activeNotes)) {
      activeNotes
        .filter((id: string) => id.startsWith(`multisample-${midiNote}`))
        .forEach((id: string) => releaseNote(id));
    } else {
      // Fallback: try to release any note that starts with the correct pattern
      // Since we can't access the global active notes, we'll use a pattern approach
      // The audio player will find and release all notes starting with this pattern
      releaseNote(`multisample-${midiNote}-`);
    }
  }, [releaseNote]);

  // Empty keys become the current import target. The nearby Add action opens the chooser.
  const handleUnassignedKeyClick = useCallback((midiNote: number) => {
    setTargetMidiNote(midiNote);
  }, []);

  // Handler for dropping files onto keys
  const handleKeyDrop = useCallback(async (midiNote: number, files: File[]) => {
    // Handle drag and drop onto specific MIDI keys
    if (files.length > 0) {
      if(audioImport)audioImport.beginFiles(files,{instrument:'multisample',multisampleRoot:midiNote});
      else await handleMultisampleUpload(files[0], midiNote);
    }
  }, [audioImport, handleMultisampleUpload]);

  const hasLoadedSamples = state.multisampleFiles.length > 0;
  return (
    <div className="studio-editor-root">
      {/* Header Section */}


      {/* Separate input for audio files from MIDI key clicks */}
      <input
        ref={audioFileInputRef}
        type="file"
        accept={AUDIO_FILE_ACCEPT}
        onChange={handleAudioFileImport}
        style={{ display: 'none' }}
      />
      <input ref={input=>{directoryInputRef.current=input;input?.setAttribute('webkitdirectory','')}} aria-label="choose multisample folder" type="file" multiple accept={AUDIO_FILE_ACCEPT} onChange={event=>{void handleFilesSelected(Array.from(event.target.files??[]));event.target.value='';}} style={{display:'none'}}/>
      <input ref={browseInputRef} aria-label="choose multisample audio files" type="file" multiple accept={AUDIO_FILE_ACCEPT} onChange={event=>{void handleFilesSelected(Array.from(event.target.files??[]));event.target.value='';}} style={{display:'none'}}/>

      <div className="studio-instrument-grid studio-editor-stage studio-editor-stage--multisample">
      <div className="studio-performance-column studio-performance-column--multisample">
      <div className="studio-performance-body">
        <ErrorDisplay message={state.error || ''} />

        <div className="studio-keyboard-positioner">
          <VirtualMidiKeyboard
            assignedNotes={Array.from(zoneMap.keys())}
            onKeyClick={handleKeyClick} // Pass the handler directly so source is respected
            onKeyRelease={handleKeyRelease} // Add release handler for ADSR
            onUnassignedKeyClick={handleUnassignedKeyClick}
            onKeyDrop={handleKeyDrop}
            loadedSamplesCount={state.multisampleFiles.length}
            isPinned={isMultisampleKeyboardPinned}
            onTogglePin={handleTogglePin}
            selectedMidiChannel={selectedMidiChannel}
            onMidiChannelChange={(channel) => {
              setSelectedMidiChannel(channel);
              localStorage.setItem('midi-channel', channel.toString());
            }}
            isActive={state.currentTab === 'multisample'&&!recordingModal.isOpen}
          />
        </div>
        <div className="studio-creative-actions studio-editor-command-bar">
          <button type="button" className="studio-button-primary" onClick={()=>targetMidiNote===null?browseInputRef.current?.click():audioFileInputRef.current?.click()}>
            Add sounds{targetMidiNote===null?'':` to MIDI ${targetMidiNote}`}
          </button>
          <button type="button" className="studio-button-primary" data-studio-open-recording="multisample" onClick={()=>handleOpenRecording()}>
            Record takes
          </button>
        </div>
      </div>
      </div>

      <div className="studio-editor-column studio-editor-column--multisample">
        {/* Sample Management Section */}
        <div className="studio-management-panel">
          {/* Header */}
          <div className="studio-section-heading">
            <div className="studio-section-heading-title">
              <h3>Sample management</h3>
            </div>
            <div className="studio-section-heading-actions">
              <div className="studio-view-switch" aria-label="Multisample workspace view"><button type="button" aria-pressed={workspaceView==='focus'} onClick={()=>setWorkspaceView('focus')}>Focus</button><button type="button" aria-pressed={workspaceView==='table'} onClick={()=>setWorkspaceView('table')}>Table</button></div>
              <ToggleSwitch
                leftLabel="c3=60"
                rightLabel="c4=60"
                isRight={state.midiNoteMapping === 'C4'}
                onToggle={() => {
                  dispatch({
                    type: 'SET_MIDI_NOTE_MAPPING',
                    payload: state.midiNoteMapping === 'C3' ? 'C4' : 'C3'
                  })
                }}
              />
            </div>
          </div>

          {/* Content */}
          <div className="studio-management-body">
            {workspaceView==='focus'?<MultisampleFocusWorkspace selectedIndex={Math.min(selectedIndex,Math.max(0,state.multisampleFiles.length-1))} onSelect={selectZone} onBrowse={()=>browseInputRef.current?.click()} onReplace={handleFileUpload} onClear={handleClearSample} onRecord={handleOpenRecording}/>:<MultisampleSampleTable
              onFileUpload={handleFileUpload}
              onClearSample={handleClearSample}
              onRecordSample={handleOpenRecording}
              onFilesSelected={handleFilesSelected}
              onBrowseFilesRef={browseFilesRef}
            />}
            <div className="studio-utility-actions" aria-label="Multisample instrument actions">
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
              <button type="button" className="studio-utility-action" onClick={()=>directoryInputRef.current?.click()}>browse folder</button>
            </div>
          </div>
        </div>
      </div>
      </div>

      <details className="studio-advanced-disclosure">
        <summary>Preset and performance settings <span>{state.multisampleSettings.playmode} · transpose {state.multisampleSettings.transpose} · volume {state.multisampleSettings.volume}%</span></summary>
        <div>
        <MultisamplePresetSettings />
        </div>
      </details>

      <details className="studio-advanced-disclosure">
        <summary>Audio output and processing <span>{state.multisampleSettings.audioFormat.toUpperCase()} · {state.multisampleSettings.sampleRate/1000} kHz · {state.multisampleSettings.bitDepth}-bit · {state.multisampleSettings.channels===1?'mono':state.multisampleSettings.channels===2?'stereo':'original channels'}</span></summary>
        <div>
        <AudioProcessingSection
          type="multisample"
          sampleRate={state.multisampleSettings.sampleRate}
          bitDepth={state.multisampleSettings.bitDepth}
          channels={state.multisampleSettings.channels}
          onSampleRateChange={handleSampleRateChange}
          onBitDepthChange={handleBitDepthChange}
          onChannelsChange={handleChannelsChange}
          samples={state.multisampleFiles}
          normalize={state.multisampleSettings.normalize}
          normalizeLevel={state.multisampleSettings.normalizeLevel}
          onNormalizeChange={handleNormalizeChange}
          onNormalizeLevelChange={handleNormalizeLevelChange}
          autoZeroCrossing={state.multisampleSettings.autoZeroCrossing}
          onAutoZeroCrossingChange={() => {
            dispatch({ type: 'APPLY_ZERO_CROSSING_TO_ALL_MULTISAMPLE_FILES' });
          }}
          gain={state.multisampleSettings.gain}
          onGainChange={handleGainChange}
          cutAtLoopEnd={state.multisampleSettings.cutAtLoopEnd}
          onCutAtLoopEndChange={handleCutAtLoopEndChange}
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
        instrument="multisample"
        target={recordingModal.target}
        guidedIntent={recordingModal.guidedIntent}
        maxDuration={20}
      />


    </div>
  );
}
