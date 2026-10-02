import { test as base } from './control-audit-test';
export * from './control-audit-test';

// Keep the real browser decoder and audio graph. Only the output device rate is
// controlled, so Linux's usual 44.1 kHz can be exercised on a 48 kHz Mac.
export const test = base.extend<{ audioSampleRate: number | undefined; audioDevice: void }>({
  audioSampleRate: [process.env.OPSTUDIO_TEST_SAMPLE_RATE ? Number(process.env.OPSTUDIO_TEST_SAMPLE_RATE) : undefined, { option: true }],
  audioDevice: [async ({ context, audioSampleRate }, use) => {
    if (audioSampleRate !== undefined) {
      if (![44100, 48000].includes(audioSampleRate)) throw new Error('Unsupported test audio sample rate');
      await context.addInitScript(rate => {
        const NativeAudioContext = window.AudioContext;
        window.AudioContext = class extends NativeAudioContext {
          constructor(options?: AudioContextOptions) {
            super({ ...options, sampleRate: options?.sampleRate ?? rate });
          }
        };
      }, audioSampleRate);
    }
    await use();
  }, { auto: true }],
});
