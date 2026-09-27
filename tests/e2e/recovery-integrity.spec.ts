import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Exercise source storage integration in a real browser without mounting the app's
  // autosave lifecycle, which is covered separately by the UI workflow tests.
  await page.route('http://127.0.0.1:5187/', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>Storage integrity</title>',
  }));
});

// These use the app's real source storage functions and the browser's real IndexedDB.
// A transaction fault is injected at the browser boundary, not a fake database.
test('failed session replacement retains the previous complete recovery snapshot', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const defaultsUrl = '/src/utils/defaultSettings.ts';
    const sessionUrl = '/src/utils/sessionStorageIndexedDB.ts';
    const dbUrl = '/src/utils/indexedDB.ts';
    const { defaultDrumSettings, defaultMultisampleSettings } = await import(defaultsUrl);
    const { sessionStorageIndexedDB: session } = await import(sessionUrl);
    const { indexedDB: db } = await import(dbUrl);
    const audio = new AudioBuffer({ length: 32, sampleRate: 48000, numberOfChannels: 1 });
    audio.getChannelData(0).fill(Math.fround(0.12345678));
    const sample = {
      file: new File([new Uint8Array([1, 2, 3, 4])], 'original.wav', { type: 'audio/wav' }),
      audioBuffer: audio, name: 'original.wav', isLoaded: true, isAssigned: true,
      assignedKey: 5, inPoint: 0, outPoint: audio.duration, playmode: 'oneshot',
      reverse: false, transpose: 0, pan: 0, gain: 0, hasBeenEdited: false,
      originalBitDepth: 24, originalSampleRate: 48000, originalChannels: 1,
    };
    const state = {
      drumSettings: { ...defaultDrumSettings, presetName: 'Keep me' },
      multisampleSettings: defaultMultisampleSettings, drumSamples: [sample], multisampleFiles: [],
      selectedMultisample: null, isDrumKeyboardPinned: false, isMultisampleKeyboardPinned: false,
      importedDrumPreset: null, importedMultisamplePreset: null, midiNoteMapping: 'C4',
    };
    await session.saveSession(state);
    const before = await db.getSession('current-session');
    const original = IDBObjectStore.prototype.put;
    let rejected = false;
    try {
      IDBObjectStore.prototype.put = function (...args) {
        if (this.name === 'sessions') throw new DOMException('Injected transaction failure', 'DataCloneError');
        return original.apply(this, args);
      };
      await session.saveSession({ ...state, drumSettings: { ...state.drumSettings, presetName: 'Must not replace' } });
    } catch {
      rejected = true;
    } finally {
      IDBObjectStore.prototype.put = original;
    }
    const after = await db.getSession('current-session');
    const referenced = await Promise.all(before.drumSamples.map(async (entry: { sampleId: string }) => {
      const row = await db.getSample(entry.sampleId);
      return !!row && row.data.size > 0;
    }));
    return { rejected, before, after, referenced };
  });
  expect(result.rejected).toBe(true);
  expect(result.after).toEqual(result.before);
  expect(result.referenced).toEqual([true]);
});

test('library audio preserves precision, channel count and original sample rate', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const libraryUrl = '/src/utils/libraryUtils.ts';
    const defaultsUrl = '/src/utils/defaultSettings.ts';
    const dbUrl = '/src/utils/indexedDB.ts';
    const { savePresetToLibrary, blobToAudioBuffer } = await import(libraryUrl);
    const { defaultDrumSettings, defaultMultisampleSettings } = await import(defaultsUrl);
    const { indexedDB: db } = await import(dbUrl);
    const audio = new AudioBuffer({ length: 32, sampleRate: 48000, numberOfChannels: 2 });
    audio.getChannelData(0).fill(Math.fround(0.12345678));
    audio.getChannelData(1).fill(Math.fround(-0.00000013));
    const state = {
      drumSettings: defaultDrumSettings, multisampleSettings: defaultMultisampleSettings,
      drumSamples: [{ file: new File(['source'], 'precise.wav'), audioBuffer: audio,
        name: 'precise.wav', isLoaded: true, isAssigned: true, assignedKey: 0,
        originalBitDepth: 24, originalSampleRate: 48000, originalChannels: 2,
        duration: audio.duration, inPoint: 0, outPoint: audio.duration }],
      multisampleFiles: [], importedDrumPreset: null, importedMultisamplePreset: null,
    };
    const saved = await savePresetToLibrary(state, 'Precision fixture', 'drum');
    if (!saved.success) throw new Error(saved.error);
    const presets = await db.getAllPresets();
    const preset = presets.find((item: { name: string }) => item.name === 'Precision fixture');
    const context = new AudioContext({ sampleRate: 44100 });
    try {
      const restored = await blobToAudioBuffer(preset.data.drumSamples[0].audioBlob, context);
      return { channels: restored.numberOfChannels, rate: restored.sampleRate, length: restored.length,
        left: restored.getChannelData(0)[0], right: restored.getChannelData(1)[0] };
    } finally { await context.close(); }
  });
  expect(result).toEqual({ channels: 2, rate: 48000, length: 32,
    left: Math.fround(0.12345678), right: Math.fround(-0.00000013) });
});
