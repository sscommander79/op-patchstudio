import type { AppState, DrumSample, MultisampleFile } from '../context/AppContext';

// Store bytes rather than Blob/File objects: some WebKit runtimes abort Blob writes.
// Public reads still return Blobs/Files; existing native Blob records remain readable.
const binaryBytes = new WeakMap<Blob, Promise<ArrayBuffer>>();
type BinaryRecord = { __opPatchBinary: 1; bytes: ArrayBuffer; mime: string; name?: string; lastModified?: number };
function isBinaryRecord(value: unknown): value is BinaryRecord {
  return value !== null && typeof value === 'object' && '__opPatchBinary' in value;
}
async function prepareDatabaseValue(value: unknown): Promise<unknown> {
  if (value instanceof Blob) {
    let bytes = binaryBytes.get(value);
    if (!bytes) { bytes = value.arrayBuffer(); binaryBytes.set(value,bytes); }
    const record: BinaryRecord = {__opPatchBinary:1,bytes:await bytes,mime:value.type};
    if (value instanceof File) { record.name=value.name; record.lastModified=value.lastModified; }
    return record;
  }
  if (Array.isArray(value)) return Promise.all(value.map(prepareDatabaseValue));
  if (value && Object.prototype.toString.call(value) === '[object Object]') {
    return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key,item]) => [key,await prepareDatabaseValue(item)])));
  }
  return value;
}
function restoreDatabaseValue(value: unknown): unknown {
  if (isBinaryRecord(value) && value.__opPatchBinary === 1 && Object.prototype.toString.call(value.bytes) === '[object ArrayBuffer]' && typeof value.mime === 'string') {
    return typeof value.name === 'string'
      ? new File([value.bytes],value.name,{type:value.mime,lastModified:value.lastModified})
      : new Blob([value.bytes],{type:value.mime});
  }
  if (Array.isArray(value)) return value.map(restoreDatabaseValue);
  if (value && Object.prototype.toString.call(value) === '[object Object]') {
    return Object.fromEntries(Object.entries(value).map(([key,item]) => [key,restoreDatabaseValue(item)]));
  }
  return value;
}

// Database configuration
const DB_NAME = 'op-patchstudio-db';
const DB_VERSION = 2;

// Store names
export const STORES = {
  SESSIONS: 'sessions',
  SAMPLES: 'samples',
  PRESETS: 'presets', // Future use
  PRESET_SUMMARIES: 'presetSummaries',
  METADATA: 'metadata' // Future use
} as const;

// Database schema interfaces
export interface SessionData {
  id: string;
  /** Opaque compare-and-swap token. Older rows without one are treated as the legacy null revision. */
  revisionToken?: string;
  timestamp: number;
  version?: number; // Schema version for future compatibility
  name?: string;
  drumSettings: AppState['drumSettings'];
  multisampleSettings: AppState['multisampleSettings'];
  drumSamples: Array<{
    originalIndex: number;
    name?: string;
    sampleId: string; // Reference to samples store
    isAssigned: boolean; // Assignment status
    assignedKey?: number; // Assigned drum key (0-23) if assigned
    sourceIdentity?: string;
    sliceProvenance?: DrumSample['sliceProvenance'];
    settings: {
      inPoint: number;
      outPoint: number;
      playmode: 'oneshot' | 'group' | 'loop' | 'gate';
      reverse: boolean;
      transpose: number;
      pan: number;
      gain: number;
      hasBeenEdited: boolean;
    };
  }>;
  multisampleFiles: Array<{
    sampleId: string; // Reference to samples store
    name?: string;
    fileName: string; // File name for matching during restoration
    sourceIdentity?: string;
    rootNote: number;
    note?: string;
    inPoint: number;
    outPoint: number;
    loopStart: number;
    loopEnd: number;
    loopCrossfade?: MultisampleFile['loopCrossfade'];
  }>;
  selectedMultisample: number | null;
  isDrumKeyboardPinned: boolean;
  isMultisampleKeyboardPinned: boolean;
  importedDrumPreset?: AppState['importedDrumPreset'];
  importedMultisamplePreset?: AppState['importedMultisamplePreset'];
  midiNoteMapping?: AppState['midiNoteMapping'];
  savedToLibrary?: boolean; // Track if this session has been saved to library
}

export class SessionRevisionConflictError extends Error {
  constructor() {
    super('Saved recovery changed in another tab. Your edits are still open; back them up, then reload or restore before saving again.');
    this.name = 'SessionRevisionConflictError';
  }
}

export interface SampleData {
  id: string;
  name: string;
  type: string;
  size: number;
  sourceFile?: Blob;
  sourceLastModified?: number;
  data: Blob; // Raw audio data as Blob to avoid detached ArrayBuffer issues
  metadata: {
    isFloat?: boolean;
    sampleRate?: number;
    bitDepth?: number;
    channels?: number;
    duration: number;
    midiNote?: number;
    note?: string;
  };
  createdAt: number;
  tags?: string[]; // Future: for organizing samples
}

export interface PresetData {
  id: string;
  name: string;
  type: 'drum' | 'multisample';
  data: object; // Preset-specific data
  createdAt: number;
  updatedAt: number;
  isFavorite?: boolean;
  tags?: string[];
  description?: string;
  sampleCount?: number; // Number of samples in the preset
}

export interface PresetSummary {
  id: string;
  name: string;
  type: 'drum' | 'multisample';
  createdAt: number;
  updatedAt: number;
  isFavorite: boolean;
  tags?: string[];
  description?: string;
  sampleCount: number;
  hasPreview: boolean;
}

function summarizePreset(preset: PresetData): PresetSummary {
  const data = preset.data as {drumSamples?:unknown[];multisampleFiles?:unknown[]};
  const samples = preset.type === 'drum' ? data?.drumSamples : data?.multisampleFiles;
  const sampleCount = typeof preset.sampleCount === 'number' ? preset.sampleCount : Array.isArray(samples) ? samples.length : 0;
  const hasPreview=Array.isArray(samples)&&samples.some(sample=>sample!==null&&typeof sample==='object'&&'audioBlob' in sample);
  return {id:preset.id,name:preset.name,type:preset.type,createdAt:preset.createdAt,updatedAt:preset.updatedAt,
    isFavorite:!!preset.isFavorite,tags:preset.tags,description:preset.description,sampleCount,hasPreview};
}

export interface LibraryCollection {
  key: string;
  id: string;
  name: string;
  presetIds: string[];
  createdAt: number;
  updatedAt: number;
}

const collectionKey = (id: string) => `library-collection:${id}`;
export type CollectionChange =
  | { type: 'rename'; name: string }
  | { type: 'add'; presetIds: string[] }
  | { type: 'remove'; presetId: string }
  | { type: 'move'; presetId: string; direction: -1 | 1 };

export interface PresetMetadataPatch {
  toggleFavorite?: boolean;
  tags?: string[];
  description?: string;
}

class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private static instance: IndexedDBManager;
  private initializing: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): IndexedDBManager {
    if (!IndexedDBManager.instance) {
      IndexedDBManager.instance = new IndexedDBManager();
    }
    return IndexedDBManager.instance;
  }

  // Initialize database
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      let blocked = false;

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        if (blocked) { request.result.close(); return; }
        const opened=request.result;
        this.db = opened;
        opened.onversionchange = () => { opened.close(); if(this.db===opened)this.db = null; };
        resolve();
      };

      request.onblocked = () => {
        blocked = true;
        reject(new Error('Library database upgrade is blocked by another open tab. Close other OP PatchStudio tabs and reload.'));
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create sessions store
        if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
          const sessionsStore = db.createObjectStore(STORES.SESSIONS, { keyPath: 'id' });
          sessionsStore.createIndex('timestamp', 'timestamp', { unique: false });
          sessionsStore.createIndex('name', 'name', { unique: false });
        }

        // Create samples store
        if (!db.objectStoreNames.contains(STORES.SAMPLES)) {
          const samplesStore = db.createObjectStore(STORES.SAMPLES, { keyPath: 'id' });
          samplesStore.createIndex('name', 'name', { unique: false });
          samplesStore.createIndex('type', 'type', { unique: false });
          samplesStore.createIndex('createdAt', 'createdAt', { unique: false });
          samplesStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
        }

        // Create presets store (future use)
        if (!db.objectStoreNames.contains(STORES.PRESETS)) {
          const presetsStore = db.createObjectStore(STORES.PRESETS, { keyPath: 'id' });
          presetsStore.createIndex('name', 'name', { unique: false });
          presetsStore.createIndex('type', 'type', { unique: false });
          presetsStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.PRESET_SUMMARIES)) {
          const summaries = db.createObjectStore(STORES.PRESET_SUMMARIES, {keyPath:'id'});
          summaries.createIndex('type','type',{unique:false});
          summaries.createIndex('updatedAt','updatedAt',{unique:false});
          if (db.objectStoreNames.contains(STORES.PRESETS)) {
            const cursor = (event.target as IDBOpenDBRequest).transaction!.objectStore(STORES.PRESETS).openCursor();
            cursor.onsuccess = () => {
              const row = cursor.result;
              if (!row) return;
              summaries.put(summarizePreset(row.value as PresetData));
              row.continue();
            };
          }
        }

        // Create metadata store (future use)
        if (!db.objectStoreNames.contains(STORES.METADATA)) {
          db.createObjectStore(STORES.METADATA, { keyPath: 'key' });
        }


      };
    });
  }

  // Ensure database is initialized
  private async ensureInit(): Promise<void> {
    if (!this.db) {
      this.initializing ??= this.init().finally(() => { this.initializing = null; });
      await this.initializing;
    }
  }

  // Generic CRUD operations
  async add<T>(storeName: string, data: T): Promise<void> {
    if (storeName === STORES.PRESETS) return this.writePreset(data as PresetData,'add');
    const prepared = await prepareDatabaseValue(data);
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(prepared);

      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(transaction.error ?? request.error ?? new Error('Database transaction aborted'));
    });
  }

  async get<T>(storeName: string, id: string): Promise<T | null> {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve((restoreDatabaseValue(request.result) as T | null) ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async update<T>(storeName: string, data: T): Promise<void> {
    if (storeName === STORES.PRESETS) return this.writePreset(data as PresetData,'put');
    const prepared = await prepareDatabaseValue(data);
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(prepared);

      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(transaction.error ?? request.error ?? new Error('Database transaction aborted'));
    });
  }

  async delete(storeName: string, id: string): Promise<void> {
    if (storeName === STORES.PRESETS) return this.deletePresetFromLibrary(id);
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(transaction.error ?? request.error ?? new Error('Database transaction aborted'));
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(restoreDatabaseValue(request.result) as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  async getByIndex<T>(storeName: string, indexName: string, value: IDBValidKey | IDBKeyRange): Promise<T[]> {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(restoreDatabaseValue(request.result) as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  /** Commit metadata and its complete sample set together. Prepare all blobs before calling. */
  async replaceSessionWithSamples(session: SessionData, samples: SampleData[], expectedRevision?: string | null): Promise<void> {
    const [preparedSession,preparedSamples] = await Promise.all([prepareDatabaseValue(session),prepareDatabaseValue(samples)]);
    await this.mutateSessionSamples(session.id, preparedSession as SessionData, preparedSamples as SampleData[], expectedRevision);
  }

  async deleteSessionWithSamples(id: string, expectedRevision?: string | null): Promise<void> {
    await this.mutateSessionSamples(id, null, [], expectedRevision);
  }

  private async mutateSessionSamples(id: string, session: SessionData | null, samples: SampleData[], expectedRevision?: string | null): Promise<void> {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES.SESSIONS, STORES.SAMPLES], 'readwrite');
      tx.oncomplete = () => resolve();
      let conflict = false;
      tx.onabort = tx.onerror = () => reject(conflict ? new SessionRevisionConflictError() : tx.error ?? new Error('Session transaction aborted'));
      const sessions = tx.objectStore(STORES.SESSIONS);
      const audio = tx.objectStore(STORES.SAMPLES);
      const prior = sessions.get(id);
      prior.onsuccess = () => {
        try {
          const old = prior.result as SessionData | undefined;
          if (expectedRevision !== undefined && (old?.revisionToken ?? null) !== expectedRevision) {
            conflict = true;
            tx.abort();
            return;
          }
          const keep = new Set(samples.map(s => s.id));
          for (const ref of [...(old?.drumSamples ?? []), ...(old?.multisampleFiles ?? [])]) {
            if (!keep.has(ref.sampleId)) audio.delete(ref.sampleId);
          }
          for (const sample of samples) audio.put(sample);
          if (session) sessions.put(session); else sessions.delete(id);
        } catch (error) { tx.abort(); reject(error); }
      };
    });
  }

  /** Read a session and every referenced sample from one readonly snapshot. */
  async getSessionWithSamples(id: string): Promise<{session: SessionData; samples: Map<string, SampleData>} | null> {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES.SESSIONS, STORES.SAMPLES], 'readonly');
      const sessionRequest = tx.objectStore(STORES.SESSIONS).get(id);
      let result: {session: SessionData; samples: Map<string, SampleData>} | null = null;
      tx.oncomplete = () => resolve(result ? {
        session: restoreDatabaseValue(result.session) as SessionData,
        samples: new Map([...result.samples].map(([key, value]) => [key, restoreDatabaseValue(value) as SampleData])),
      } : null);
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Session read transaction aborted'));
      sessionRequest.onsuccess = () => {
        const session = sessionRequest.result as SessionData | undefined;
        if (!session) return;
        const ids = [...new Set([...session.drumSamples, ...session.multisampleFiles].map(item => item.sampleId))];
        const samples = new Map<string, SampleData>();
        result = {session, samples};
        for (const sampleId of ids) {
          const request = tx.objectStore(STORES.SAMPLES).get(sampleId);
          request.onsuccess = () => { if (request.result) samples.set(sampleId, request.result as SampleData); };
        }
      };
    });
  }

  async updateSessionWithRevision(id: string, expectedRevision: string | null, update: (session: SessionData) => SessionData): Promise<string | null> {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES.SESSIONS, STORES.SAMPLES], 'readwrite');
      const store = tx.objectStore(STORES.SESSIONS);
      const nextRevision = crypto.randomUUID();
      let committedRevision: string | null = null;
      let failure: Error | undefined;
      tx.oncomplete = () => resolve(committedRevision);
      tx.onabort = tx.onerror = () => reject(failure ?? tx.error ?? new Error('Session transaction aborted'));
      const request = store.get(id);
      request.onsuccess = () => {
        const current = request.result as SessionData | undefined;
        if (!current && expectedRevision === null) return;
        if (!current || (current.revisionToken ?? null) !== expectedRevision) {
          failure = new SessionRevisionConflictError();
          tx.abort();
          return;
        }
        committedRevision = nextRevision;
        store.put({...update(current), revisionToken: nextRevision});
      };
    });
  }

  // Session-specific operations
  async saveSession(sessionData: SessionData): Promise<void> {
    await this.update(STORES.SESSIONS, sessionData);
  }

  async getSession(id: string): Promise<SessionData | null> {
    return this.get<SessionData>(STORES.SESSIONS, id);
  }

  async getAllSessions(): Promise<SessionData[]> {
    return this.getAll<SessionData>(STORES.SESSIONS);
  }

  async deleteSession(id: string): Promise<void> {
    await this.delete(STORES.SESSIONS, id);
  }

  // Sample-specific operations
  async saveSample(sampleData: SampleData): Promise<void> {
    await this.update(STORES.SAMPLES, sampleData);
  }

  async getSample(id: string): Promise<SampleData | null> {
    return this.get<SampleData>(STORES.SAMPLES, id);
  }

  async getAllSamples(): Promise<SampleData[]> {
    return this.getAll<SampleData>(STORES.SAMPLES);
  }

  async deleteSample(id: string): Promise<void> {
    await this.delete(STORES.SAMPLES, id);
  }

  async getSamplesByType(type: string): Promise<SampleData[]> {
    return this.getByIndex<SampleData>(STORES.SAMPLES, 'type', type);
  }

  // Preset-specific operations
  async savePreset(presetData: PresetData): Promise<void> {
    await this.writePreset(presetData,'put');
  }

  private async writePreset(presetData: PresetData, mode: 'add'|'put'): Promise<void> {
    const prepared = await prepareDatabaseValue(presetData) as PresetData;
    const summary = summarizePreset(presetData);
    await this.ensureInit();
    return new Promise((resolve,reject)=>{
      const tx=this.db!.transaction([STORES.PRESETS,STORES.PRESET_SUMMARIES],'readwrite');
      const request=tx.objectStore(STORES.PRESETS)[mode](prepared);
      tx.objectStore(STORES.PRESET_SUMMARIES)[mode](summary);
      tx.oncomplete=()=>resolve();
      tx.onabort=tx.onerror=()=>reject(tx.error??request.error??new Error('Preset transaction aborted'));
    });
  }

  async getPreset(id: string): Promise<PresetData | null> {
    return this.get<PresetData>(STORES.PRESETS, id);
  }

  async getAllPresets(): Promise<PresetData[]> {
    return this.getAll<PresetData>(STORES.PRESETS);
  }

  async getPresetSummaries(): Promise<PresetSummary[]> {
    return this.getAll<PresetSummary>(STORES.PRESET_SUMMARIES);
  }

  async getLibraryCollections(): Promise<LibraryCollection[]> {
    const rows = await this.getAll<LibraryCollection>(STORES.METADATA);
    return rows.filter(row => row && typeof row.key === 'string' && row.key === collectionKey(row.id)
      && typeof row.name === 'string' && Array.isArray(row.presetIds))
      .sort((a, b) => a.createdAt - b.createdAt || a.name.localeCompare(b.name));
  }

  async createLibraryCollection(name: string, id: string = crypto.randomUUID()): Promise<LibraryCollection> {
    const cleanName = name.trim();
    if (!cleanName || cleanName.length > 80) throw new Error('Collection name must be 1 to 80 characters');
    if (!id || id.includes(':')) throw new Error('Invalid collection ID');
    const now = Date.now();
    const collection = { key: collectionKey(id), id, name: cleanName, presetIds: [], createdAt: now, updatedAt: now };
    await this.add(STORES.METADATA, collection);
    return collection;
  }

  /** Read the latest collection and write its change in the same transaction. */
  async changeLibraryCollection(id: string, change: CollectionChange): Promise<LibraryCollection> {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES.METADATA, STORES.PRESETS], 'readwrite');
      const collectionStore = tx.objectStore(STORES.METADATA);
      const presetStore = tx.objectStore(STORES.PRESETS);
      let updated: LibraryCollection | undefined;
      let failure: Error | undefined;
      tx.oncomplete = () => resolve(updated!);
      tx.onabort = tx.onerror = () => reject(failure ?? tx.error ?? new Error('Collection update failed'));
      const request = collectionStore.get(collectionKey(id));
      request.onsuccess = () => {
        const current = request.result as LibraryCollection | undefined;
        if (!current) { failure = new Error('Collection no longer exists'); tx.abort(); return; }
        const members = [...current.presetIds];
        if (change.type === 'rename') {
          const name = change.name.trim();
          if (!name || name.length > 80) { failure = new Error('Collection name must be 1 to 80 characters'); tx.abort(); return; }
          updated = { ...current, name, updatedAt: Date.now() };
          collectionStore.put(updated);
        } else if (change.type === 'add') {
          const toAdd = [...new Set(change.presetIds.filter(Boolean))].filter(presetId => !members.includes(presetId));
          if (!toAdd.length) { updated = current; return; }
          let remaining = toAdd.length;
          for (const presetId of toAdd) {
            const presetRequest = presetStore.get(presetId);
            presetRequest.onsuccess = () => {
              if (!presetRequest.result) { failure = new Error('Selected preset no longer exists'); tx.abort(); return; }
              if (--remaining === 0) {
                updated = { ...current, presetIds: [...members, ...toAdd], updatedAt: Date.now() };
                collectionStore.put(updated);
              }
            };
          }
        } else {
          const index = members.indexOf(change.presetId);
          if (index < 0) { failure = new Error('Preset is no longer in this collection'); tx.abort(); return; }
          if (change.type === 'remove') members.splice(index, 1);
          else {
            const next = index + change.direction;
            if (next < 0 || next >= members.length) { updated = current; return; }
            [members[index], members[next]] = [members[next], members[index]];
          }
          updated = { ...current, presetIds: members, updatedAt: Date.now() };
          collectionStore.put(updated);
        }
      };
    });
  }

  async deleteLibraryCollection(id: string): Promise<void> {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES.METADATA], 'readwrite');
      const store = tx.objectStore(STORES.METADATA);
      let missing = false;
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(missing ? new Error('Collection no longer exists') : tx.error ?? new Error('Collection delete failed'));
      const request = store.get(collectionKey(id));
      request.onsuccess = () => {
        if (!request.result) { missing = true; tx.abort(); return; }
        store.delete(collectionKey(id));
      };
    });
  }

  /** Merge metadata with the latest row inside one transaction; never recreate a deleted preset. */
  async updatePresetMetadata(id:string, patch:PresetMetadataPatch):Promise<PresetSummary> {
    await this.ensureInit();
    return new Promise((resolve,reject)=>{
      const transaction=this.db!.transaction([STORES.PRESETS,STORES.PRESET_SUMMARIES],'readwrite');
      const store=transaction.objectStore(STORES.PRESETS);
      let updated: PresetData | undefined;
      let summary: PresetSummary | undefined;
      let missing=false;
      transaction.oncomplete=()=>resolve(summary!);
      transaction.onabort=transaction.onerror=()=>reject(missing?new Error('Preset no longer exists'):transaction.error??new Error('Preset metadata transaction aborted'));
      const request=store.get(id);
      request.onsuccess=()=>{
        const current=request.result as PresetData|undefined;
        if(!current){missing=true;transaction.abort();return;}
        updated={...current,updatedAt:Date.now(),
          ...(patch.toggleFavorite?{isFavorite:!current.isFavorite}:{}),
          ...(patch.tags!==undefined?{tags:patch.tags}:{}),
          ...(patch.description!==undefined?{description:patch.description}:{})};
        store.put(updated);
        summary=summarizePreset(updated);
        transaction.objectStore(STORES.PRESET_SUMMARIES).put(summary);
      };
    });
  }

  async deletePreset(id: string): Promise<void> {
    await this.deletePresetFromLibrary(id);
  }

  /** Delete audio once and remove its ID from every collection in the same transaction. */
  async deletePresetFromLibrary(id: string): Promise<void> {
    return this.deletePresetsFromLibrary([id]);
  }

  async deletePresetsFromLibrary(ids: string[]): Promise<void> {
    await this.ensureInit();
    const unique=[...new Set(ids.filter(Boolean))];
    if(!unique.length)return;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES.PRESETS, STORES.PRESET_SUMMARIES, STORES.METADATA], 'readwrite');
      const metadata = tx.objectStore(STORES.METADATA);
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Preset deletion failed'));
      const request = metadata.getAll();
      request.onsuccess = () => {
        for (const row of request.result as LibraryCollection[]) {
          if (row?.key !== collectionKey(row.id) || !Array.isArray(row.presetIds) || !row.presetIds.some(member=>unique.includes(member))) continue;
          metadata.put({ ...row, presetIds: row.presetIds.filter(member => !unique.includes(member)), updatedAt: Date.now() });
        }
        for(const id of unique){tx.objectStore(STORES.PRESETS).delete(id);tx.objectStore(STORES.PRESET_SUMMARIES).delete(id);}
      };
    });
  }

  async getPresetsByType(type: 'drum' | 'multisample'): Promise<PresetData[]> {
    return this.getByIndex<PresetData>(STORES.PRESETS, 'type', type);
  }

  // Utility methods
  async clearAll(): Promise<void> {
    await this.ensureInit();
    const stores = Object.values(STORES);
    
    for (const storeName of stores) {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        transaction.oncomplete = () => resolve();
        transaction.onabort = transaction.onerror = () => reject(transaction.error ?? request.error ?? new Error('Database transaction aborted'));
      });
    }
  }

  async getDatabaseSize(): Promise<number> {
    // Note: This is an approximation as IndexedDB doesn't provide exact size
    const sessions = await this.getAllSessions();
    const samples = await this.getAllSamples();
    
    let totalSize = 0;
    
    // Estimate session size
    sessions.forEach(session => {
      totalSize += JSON.stringify(session).length;
    });
    
    // Add sample sizes
    samples.forEach(sample => {
      totalSize += sample.data.size;
      totalSize += JSON.stringify(sample.metadata).length;
    });
    
    return totalSize;
  }
}

// Export singleton instance
export const indexedDB = IndexedDBManager.getInstance();
