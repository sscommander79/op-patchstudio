import { useEffect, useCallback, useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { sessionStorageIndexedDB } from '../utils/sessionStorageIndexedDB';

export function useSessionManagement() {
  const {state,dispatch} = useAppContext();
  const currentState = useRef(state); currentState.current = state;
  const musicalState = [state.drumSamples,state.multisampleFiles,state.drumSettings,state.multisampleSettings,
    state.importedDrumPreset,state.importedMultisamplePreset,state.midiNoteMapping,state.selectedMultisample,state.isDrumKeyboardPinned,state.isMultisampleKeyboardPinned];
  const revision = useRef({number:0,values:musicalState});
  const acceptNextStateAsSaved = useRef(false);
  if (musicalState.some((value,index) => value !== revision.current.values[index])) {
    revision.current = {number:revision.current.number+(acceptNextStateAsSaved.current?0:1),values:musicalState};
    acceptNextStateAsSaved.current = false;
  }
  const saveAttempt = useRef(0);
  const savedRevision = useRef(0);
  const saveInFlight = useRef<Promise<void> | null>(null);
  const saveRequested = useRef(false);
  const recoveryInvalidated = useRef(false);
  const [ready,setReady] = useState(false);
  const readyRef = useRef(false);
  const [recoveryPending,setRecoveryPending] = useState(false);
  const [recoveryError,setRecoveryError] = useState<string | null>(null);
  const checkGeneration = useRef(0);
  const enableAutosave = useCallback(() => { readyRef.current = true; setReady(true); dispatch({type:'SET_SESSION_RECOVERY_RESOLVED',payload:true}); },[dispatch]);
  const message = (error:unknown) => error instanceof Error ? error.message : String(error);

  const checkStartup = useCallback(async () => {
    const generation = ++checkGeneration.current;
    dispatch({type:'SET_SESSION_SAVE_STATUS',payload:{status:'checking'}});
    dispatch({type:'SET_SESSION_RECOVERY_RESOLVED',payload:false});
    try {
      const previous = await sessionStorageIndexedDB.getCurrentSession();
      if (generation !== checkGeneration.current) return;
      if (previous) {
        dispatch({type:'SET_SESSION_INFO',payload:{timestamp:previous.timestamp,drumSamplesCount:previous.drumSamples.length,multisampleFilesCount:previous.multisampleFiles.length}});
        dispatch({type:'SET_SESSION_RESTORATION_MODAL_OPEN',payload:true});
      } else enableAutosave();
      dispatch({type:'SET_SESSION_SAVE_STATUS',payload:{status:'idle',error:null}});
    } catch (error) {
      if (generation === checkGeneration.current) dispatch({type:'SET_SESSION_SAVE_STATUS',payload:{status:'error',error:`Could not check saved work: ${message(error)}`}});
    }
  },[dispatch,enableAutosave]);
  useEffect(() => {
    const generation = checkGeneration.current;
    void checkStartup();
    return () => { if (checkGeneration.current >= generation) checkGeneration.current += 1; };
  },[checkStartup]);

  const saveSession = useCallback(async () => {
    if (!readyRef.current) { if (!currentState.current.isSessionRestorationModalOpen) await checkStartup(); return; }
    if (currentState.current.isSessionRestorationModalOpen) return;
    saveRequested.current = true;
    if (saveInFlight.current) return saveInFlight.current;
    const run = async () => {
      while (saveRequested.current) {
        saveRequested.current = false;
        const attempt = ++saveAttempt.current;
        const savingRevision = revision.current.number;
        dispatch({type:'SET_SESSION_SAVE_STATUS',payload:{status:'saving'}});
        try {
          await sessionStorageIndexedDB.saveSession(currentState.current);
          savedRevision.current = Math.max(savedRevision.current,savingRevision);
          if (attempt !== saveAttempt.current) continue;
          dispatch({type:'SET_SESSION_SAVE_STATUS',payload:revision.current.number === savingRevision
            ? {status:'saved',error:null,lastSavedAt:Date.now()} : {status:'idle'}});
          if (revision.current.number !== savingRevision) saveRequested.current = true;
        } catch (error) {
          saveRequested.current = false;
          if (attempt === saveAttempt.current) dispatch({type:'SET_SESSION_SAVE_STATUS',payload:{status:'error',error:message(error)}});
        }
      }
    };
    saveInFlight.current = run().finally(() => { saveInFlight.current = null; });
    return saveInFlight.current;
  },[dispatch,checkStartup]);

  useEffect(() => {
    // Do not manufacture an empty recovery snapshot merely by opening the app.
    // Every actual edit increments the revision, including settings-only edits.
    if (!ready || state.isSessionRestorationModalOpen || revision.current.number === 0) return;
    if (currentState.current.sessionSaveStatus === 'saved') dispatch({type:'SET_SESSION_SAVE_STATUS',payload:{status:'idle'}});
    const timer = setTimeout(() => {void saveSession();},100);
    return () => clearTimeout(timer);
  },[ready,state.isSessionRestorationModalOpen,state.drumSamples,state.multisampleFiles,state.drumSettings,state.multisampleSettings,
    state.importedDrumPreset,state.importedMultisamplePreset,state.midiNoteMapping,state.selectedMultisample,state.isDrumKeyboardPinned,state.isMultisampleKeyboardPinned,dispatch,saveSession]);

  const markRecoveryInvalid = useCallback(() => {
    recoveryInvalidated.current = true;
    dispatch({type:'SET_SESSION_SAVE_STATUS',payload:{status:'error',error:'Saved recovery changed in another tab. Your current edits remain open; back them up, then reload or restore before saving again.'}});
  },[dispatch]);
  useEffect(() => {
    const unsubscribe=sessionStorageIndexedDB.subscribeExternalChange?.(markRecoveryInvalid);
    return () => { unsubscribe?.(); };
  },[markRecoveryInvalid]);
  useEffect(() => {
    const check = async () => {
      try { if (await sessionStorageIndexedDB.hasExternalRevisionChange?.()) markRecoveryInvalid(); }
      catch { /* the next explicit save/check reports storage failures */ }
    };
    window.addEventListener('focus',check);
    return () => window.removeEventListener('focus',check);
  },[markRecoveryInvalid]);

  useEffect(() => {
    const isDirty = () => readyRef.current && !currentState.current.isSessionRestorationModalOpen
      && (recoveryInvalidated.current || revision.current.number > savedRevision.current);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const bestEffortFlush = () => { if (isDirty()) void saveSession(); };
    const visibility = () => { if (document.visibilityState === 'hidden') bestEffortFlush(); };
    window.addEventListener('beforeunload',beforeUnload);
    window.addEventListener('pagehide',bestEffortFlush);
    document.addEventListener('visibilitychange',visibility);
    return () => {
      window.removeEventListener('beforeunload',beforeUnload);
      window.removeEventListener('pagehide',bestEffortFlush);
      document.removeEventListener('visibilitychange',visibility);
    };
  },[saveSession]);

  const loadSession = useCallback(async () => {
    setRecoveryPending(true); setRecoveryError(null);
    try {
      const project = await sessionStorageIndexedDB.restoreSession();
      acceptNextStateAsSaved.current = true;
      dispatch({type:'RESTORE_SESSION',payload:project});
      savedRevision.current = revision.current.number;
      recoveryInvalidated.current = false;
      enableAutosave();
    } catch (error) { setRecoveryError(`Could not restore saved work: ${message(error)}. The saved copy has been kept; retry restore or explicitly start new.`); }
    finally {setRecoveryPending(false);}
  },[dispatch,enableAutosave]);

  const declineSessionRestoration = useCallback(async () => {
    setRecoveryPending(true); setRecoveryError(null);
    try {
      await sessionStorageIndexedDB.clearCurrentSession();
      recoveryInvalidated.current = false;
      dispatch({type:'SET_SESSION_INFO',payload:null});
      dispatch({type:'SET_SESSION_RESTORATION_MODAL_OPEN',payload:false});
      enableAutosave();
    } catch (error) {
      console.error('Failed to clear session data when declining restoration:',error);
      setRecoveryError(`Could not discard saved work: ${message(error)}. Please retry.`);
    } finally {setRecoveryPending(false);}
  },[dispatch,enableAutosave]);

  return {saveSession,loadSession,declineSessionRestoration,recoveryPending,recoveryError,
    clearCurrentSession: () => sessionStorageIndexedDB.clearCurrentSession(),
    clearAllSessionData: () => sessionStorageIndexedDB.clearAllSessionData(),
    markSessionAsSavedToLibrary: () => sessionStorageIndexedDB.markSessionAsSavedToLibrary(),
    resetSavedToLibraryFlag: () => sessionStorageIndexedDB.resetSavedToLibraryFlag(),
  };
}
