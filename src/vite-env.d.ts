/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface Window {
  webkitAudioContext?: typeof AudioContext;
  opPatchstudioActiveNotes?: string[];
}

declare const __APP_VERSION__: string;
declare const __APP_BUILD_ID__: string;
