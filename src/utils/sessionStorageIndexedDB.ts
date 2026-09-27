import type { AppState } from '../context/AppContext';
import { indexedDB, SessionRevisionConflictError, type SessionData } from './indexedDB';
import { createProjectSnapshot, serializeProject, deserializeProject, decodeSampleData } from './projectSerialization';
const SINGLE_SESSION_ID = 'current-session';
const CURRENT_SESSION_KEY = 'op-patchstudio-current-session';
const SESSION_CHANGE_KEY = 'op-patchstudio-session-change';

export class SessionStorageManagerIndexedDB {
  private static instance: SessionStorageManagerIndexedDB;
  private queue: Promise<unknown> = Promise.resolve();
  private expectedRevision: string | null | undefined;
  private readonly sourceId = crypto.randomUUID();
  private readonly listeners = new Set<() => void>();
  private channel: BroadcastChannel | null = null;
  private externalChangeVersion = 0;
  private readonly storageHandler = (event: StorageEvent) => {
    if (event.key !== SESSION_CHANGE_KEY || !event.newValue) return;
    try {
      const change = JSON.parse(event.newValue) as {sourceId?:string;revisionToken?:string|null};
      if (change.sourceId !== this.sourceId) this.externalChanged(change.revisionToken);
    } catch { this.externalChanged(); }
  };
  constructor() {
    if (typeof window !== 'undefined' && typeof window.BroadcastChannel !== 'undefined') {
      try {
        this.channel = new window.BroadcastChannel('op-patchstudio-session');
        this.channel.addEventListener('message', event => {
          if (event.data?.sourceId !== this.sourceId) this.externalChanged(event.data?.revisionToken);
        });
      } catch { this.channel = null; }
    }
    if (typeof window !== 'undefined') window.addEventListener('storage',this.storageHandler);
  }
  static getInstance() { return this.instance ??= new SessionStorageManagerIndexedDB(); }
  static createForTesting() { return new SessionStorageManagerIndexedDB(); }
  subscribeExternalChange(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  dispose() { this.channel?.close(); this.channel=null; if(typeof window!=='undefined')window.removeEventListener('storage',this.storageHandler);this.listeners.clear(); }
  /** Test isolation for a replaced fake IndexedDB factory. */
  resetForTesting() { this.expectedRevision = undefined; this.queue = Promise.resolve(); }
  private externalChanged(revisionToken?: string | null) {
    if (revisionToken !== undefined && this.expectedRevision !== undefined && revisionToken === this.expectedRevision) return;
    this.externalChangeVersion += 1; this.listeners.forEach(listener => listener());
  }
  private notifyChanged(revisionToken: string | null) {
    const change={sourceId:this.sourceId,nonce:crypto.randomUUID(),revisionToken};
    this.channel?.postMessage(change);
    try { localStorage.setItem(SESSION_CHANGE_KEY,JSON.stringify(change)); } catch { /* storage can be disabled */ }
  }
  private async initializeExpectedRevision() {
    if (this.expectedRevision !== undefined) return;
    const current = await indexedDB.getSession(SINGLE_SESSION_ID);
    this.expectedRevision = current?.revisionToken ?? null;
  }
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {});
    return result;
  }
  saveSession(state: AppState): Promise<string> {
    const snapshot = createProjectSnapshot(state);
    return this.enqueue(async () => {
      await this.initializeExpectedRevision();
      const {session,samples} = serializeProject(snapshot);
      const revisionToken = crypto.randomUUID();
      await indexedDB.replaceSessionWithSamples({...session,revisionToken},samples,this.expectedRevision);
      this.expectedRevision = revisionToken;
      // This optional legacy pointer is not authoritative; IndexedDB is the source of truth.
      try { localStorage.setItem(CURRENT_SESSION_KEY,SINGLE_SESSION_ID); } catch { /* storage can be disabled */ }
      this.notifyChanged(revisionToken);
      return SINGLE_SESSION_ID;
    });
  }
  async loadSession(): Promise<SessionData | null> {
    await this.queue;
    const session = await indexedDB.getSession(SINGLE_SESSION_ID);
    // A first startup read establishes the base. Later inspection must never
    // silently authorize a stale manager to overwrite a newer revision.
    if (this.expectedRevision === undefined) this.expectedRevision = session?.revisionToken ?? null;
    return session;
  }
  async restoreSession() {
    await this.queue;
    const changeVersion = this.externalChangeVersion;
    const bundle = await indexedDB.getSessionWithSamples(SINGLE_SESSION_ID);
    if (!bundle) throw new Error('Saved session is no longer available');
    const capturedRevision = bundle.session.revisionToken ?? null;
    const project = await deserializeProject(bundle.session,id => Promise.resolve(bundle.samples.get(id) ?? null));
    const current = await indexedDB.getSession(SINGLE_SESSION_ID);
    if (!current || this.externalChangeVersion !== changeVersion || (current.revisionToken ?? null) !== capturedRevision) {
      throw new SessionRevisionConflictError();
    }
    // Explicit restore adopts this exact snapshot as the manager's new base revision.
    this.expectedRevision = capturedRevision;
    return project;
  }
  async hasExternalRevisionChange() {
    await this.queue;
    await this.initializeExpectedRevision();
    const current = await indexedDB.getSession(SINGLE_SESSION_ID);
    return (current?.revisionToken ?? null) !== this.expectedRevision;
  }
  getCurrentSessionId() { return SINGLE_SESSION_ID; }
  async hasPreviousSession() { return !!(await this.getCurrentSession()); }
  async getCurrentSession() {
    // A committed edit is recoverable even before audio is added or after the last sample is removed.
    return this.loadSession();
  }
  clearCurrentSession(): Promise<void> {
    return this.enqueue(async () => {
      await this.initializeExpectedRevision();
      await indexedDB.deleteSessionWithSamples(SINGLE_SESSION_ID,this.expectedRevision);
      this.expectedRevision = null;
      try { localStorage.removeItem(CURRENT_SESSION_KEY); } catch { /* optional legacy pointer */ }
      this.notifyChanged(null);
    });
  }
  clearAllSessionData() { return this.clearCurrentSession(); }
  private setLibraryFlag(savedToLibrary: boolean) {
    return this.enqueue(async () => {
      await this.initializeExpectedRevision();
      const revision = await indexedDB.updateSessionWithRevision(SINGLE_SESSION_ID,this.expectedRevision!,session => ({...session,savedToLibrary}));
      this.expectedRevision = revision;
      if (revision !== null) this.notifyChanged(revision);
    });
  }
  markSessionAsSavedToLibrary() { return this.setLibraryFlag(true); }
  resetSavedToLibraryFlag() { return this.setLibraryFlag(false); }
  /** Diagnostic only: never mutate a damaged recovery snapshot. */
  async clearCorruptedData() { const session = await this.loadSession(); if (session) await deserializeProject(session,id => indexedDB.getSample(id)); }
  async arrayBufferToFile(bytes: ArrayBuffer, name: string, type: string) { return new File([bytes],name,{type}); }
  async arrayBufferToAudioBuffer(bytes: ArrayBuffer) {
    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('Web Audio is not available');
    const context = new AudioContextClass();
    try { return await context.decodeAudioData(bytes); } finally { await context.close(); }
  }
  async loadSampleFromSession(id: string) {
    const data = await indexedDB.getSample(id);
    if (!data) throw new Error(`Missing saved sample: ${id}`);
    return decodeSampleData(data);
  }
}
export const sessionStorageIndexedDB = SessionStorageManagerIndexedDB.getInstance();
