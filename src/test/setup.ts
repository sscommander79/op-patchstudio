import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock AudioBuffer class
class MockAudioBuffer {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  duration: number;
  private channelData: Float32Array[];

  constructor(numberOfChannelsOrOptions: number | AudioBufferOptions, length?: number, sampleRate?: number) {
    const channels=typeof numberOfChannelsOrOptions==='object'?(numberOfChannelsOrOptions.numberOfChannels??1):numberOfChannelsOrOptions;
    const frames=typeof numberOfChannelsOrOptions==='object'?numberOfChannelsOrOptions.length:length!;
    const rate=typeof numberOfChannelsOrOptions==='object'?numberOfChannelsOrOptions.sampleRate:sampleRate!;
    if (!Number.isInteger(channels) || channels <= 0 ||
        !Number.isInteger(frames) || frames <= 0 ||
        !Number.isFinite(rate) || rate <= 0) {
      throw new DOMException('Invalid AudioBuffer dimensions', 'NotSupportedError');
    }

    this.numberOfChannels = channels;
    this.length = frames;
    this.sampleRate = rate;
    this.duration = frames / rate;
    this.channelData = [];
    
    // Create Float32Array for each channel
    for (let i = 0; i < channels; i++) {
      this.channelData[i] = new Float32Array(frames);
    }
  }

  getChannelData(channel: number): Float32Array {
    this.assertChannel(channel);
    return this.channelData[channel];
  }

  copyFromChannel(destination: Float32Array, channelNumber: number, startInChannel: number = 0): void {
    this.assertChannel(channelNumber);
    const source = this.channelData[channelNumber];
    const framesToCopy = Math.max(0, Math.min(destination.length, source.length - startInChannel));
    for (let i = 0; i < framesToCopy; i++) {
      destination[i] = source[startInChannel + i];
    }
  }

  copyToChannel(source: Float32Array, channelNumber: number, startInChannel: number = 0): void {
    this.assertChannel(channelNumber);
    const destination = this.channelData[channelNumber];
    const framesToCopy = Math.max(0, Math.min(source.length, destination.length - startInChannel));
    for (let i = 0; i < framesToCopy; i++) {
      destination[startInChannel + i] = source[i];
    }
  }

  private assertChannel(channel: number): void {
    if (!Number.isInteger(channel) || channel < 0 || channel >= this.numberOfChannels) {
      throw new DOMException('Channel index is outside the AudioBuffer', 'IndexSizeError');
    }
  }
}

// Mock Audio APIs that aren't available in jsdom
global.AudioContext = vi.fn(function MockAudioContext() { return {
  createBufferSource: vi.fn(() => ({
    buffer: null,
    connect: vi.fn(() => ({ connect: vi.fn() })),
    start: vi.fn(),
    stop: vi.fn(),
    playbackRate: { value: 1 }
  })),
  createBuffer: vi.fn((numberOfChannels: number, length: number, sampleRate: number) => {
    return new MockAudioBuffer(numberOfChannels, length, sampleRate);
  }),
  createGain: vi.fn(() => ({
    gain: { value: 1 },
    connect: vi.fn(() => ({ connect: vi.fn() }))
  })),
  createStereoPanner: vi.fn(() => ({
    pan: { value: 0 },
    connect: vi.fn(() => ({ connect: vi.fn() }))
  })),
  destination: {},
  sampleRate: 44100,
  state: 'running',
  resume: vi.fn(() => Promise.resolve()),
  suspend: vi.fn(() => Promise.resolve()),
  close: vi.fn(() => Promise.resolve()),
  decodeAudioData: vi.fn(() => Promise.resolve(new MockAudioBuffer(1, 1000, 44100)))
} }) as unknown as typeof AudioContext

// Make AudioBuffer available globally
global.AudioBuffer = MockAudioBuffer as unknown as typeof AudioBuffer;

// jsdom's Blob omits arrayBuffer(), while browsers and Node provide it.
if (!Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function (): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

// Mock MediaRecorder
interface MediaRecorderDouble {
  start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>; resume: ReturnType<typeof vi.fn>;
  state: RecordingState; ondataavailable: null; onstop: null; onerror: null;
}
const MediaRecorderMock = function (this: MediaRecorderDouble) {
  this.start = vi.fn()
  this.stop = vi.fn()
  this.pause = vi.fn()
  this.resume = vi.fn()
  this.state = 'inactive'
  this.ondataavailable = null
  this.onstop = null
  this.onerror = null
}
MediaRecorderMock.isTypeSupported = vi.fn(() => true)

global.MediaRecorder = MediaRecorderMock as unknown as typeof MediaRecorder

// Mock WebMIDI API
const createMockMidiPort = (id: string, name: string, type: 'input' | 'output', manufacturer: string = 'Test Manufacturer') => ({
  id,
  name,
  manufacturer,
  type,
  connection: 'open' as const,
  state: 'connected' as const,
  onmidimessage: null,
  onstatechange: null,
  send: vi.fn(),
  open: vi.fn(() => Promise.resolve()),
  close: vi.fn(() => Promise.resolve())
})

const createMockMidiAccess = (inputs: ReturnType<typeof createMockMidiPort>[] = [], outputs: ReturnType<typeof createMockMidiPort>[] = []) => ({
  inputs: new Map(inputs.map(input => [input.id, input])),
  outputs: new Map(outputs.map(output => [output.id, output])),
  onstatechange: null,
  sysexEnabled: false
})

// Mock navigator.requestMIDIAccess
Object.defineProperty(navigator, 'requestMIDIAccess', {
  writable: true,
  value: vi.fn()
})

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn(() => Promise.resolve({
      getTracks: () => []
    }))
  }
})

// JSZip mock removed to allow real implementation for testing

// Mock File API methods
global.URL.createObjectURL = vi.fn(() => 'mock-url')
global.URL.revokeObjectURL = vi.fn()

// Mock localStorage and sessionStorage
const localStorageMock: Storage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
}
global.localStorage = localStorageMock
global.sessionStorage = localStorageMock
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Patch AudioParam and GainNode to support setValueCurveAtTime for ADSR tests
class MockAudioParam {
  value = 1;
  setValueCurveAtTime = vi.fn();
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
}
global.AudioParam = MockAudioParam as unknown as typeof AudioParam;
// Patch createGain to return a gain node with a writable gain property
const origCreateGain = global.AudioContext.prototype?.createGain;
if (origCreateGain) {
  global.AudioContext.prototype.createGain = function () {
    const gainNode = origCreateGain.call(this);
    // Overwrite gain with a writable property
    Object.defineProperty(gainNode, 'gain', {
      value: new MockAudioParam(),
      writable: true,
      configurable: true,
      enumerable: true
    });
    return gainNode;
  };
}
// Patch canvas context for setLineDash and basic 2D methods
try {
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = (function (this: HTMLCanvasElement, ...args: Parameters<HTMLCanvasElement['getContext']>) {
    if (args[0] === '2d') {
      // Return a persistent mock object for each canvas
      const ctx = {
        setLineDash: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        arc: vi.fn(),
        rect: vi.fn(),
        fill: vi.fn(),
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        drawImage: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        rotate: vi.fn(),
        // Add any other needed 2d context methods here
      };
      return ctx as unknown as CanvasRenderingContext2D;
    }
    return origGetContext ? origGetContext.apply(this, args) : null;
  }) as typeof HTMLCanvasElement.prototype.getContext;
} catch {
  // If we can't mock, ignore and let tests skip or fail gracefully
}

// Export mock utilities for tests
export { createMockMidiPort, createMockMidiAccess }
