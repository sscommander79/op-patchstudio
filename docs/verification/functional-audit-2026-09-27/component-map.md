# Component and function audit map

Coverage below means execution in unit tests only. Every control still needs an explicit interaction/outcome mapping; browser suite evidence is listed separately in README.

| Source file | Interactive source sites | Unit-executed functions / instrumented | Coverage gap |
|---|---:|---:|---|
| src/App.tsx | 4 | 0 / 0 | Behavior assertions and browser mapping still required |
| src/audio/recording/autoSampler.ts | 0 | 26 / 29 | Unit functions unexecuted |
| src/audio/recording/captureCore.ts | 0 | 23 / 23 | Behavior assertions and browser mapping still required |
| src/audio/recording/captureProcessor.ts | 0 | 5 / 5 | Behavior assertions and browser mapping still required |
| src/audio/recording/captureSession.ts | 0 | 30 / 38 | Unit functions unexecuted |
| src/audio/recording/stemBrowser.ts | 0 | 5 / 5 | Behavior assertions and browser mapping still required |
| src/audio/recording/stemCapture.ts | 0 | 40 / 43 | Unit functions unexecuted |
| src/components/common/ADSREnvelope.tsx | 5 | 0 / 0 | Behavior assertions and browser mapping still required |
| src/components/common/AccessibleDialog.tsx | 1 | 2 / 2 | Behavior assertions and browser mapping still required |
| src/components/common/AudioFormatControls.tsx | 3 | 3 / 6 | Unit functions unexecuted |
| src/components/common/AudioImportContext.ts | 0 | 1 / 1 | Behavior assertions and browser mapping still required |
| src/components/common/AudioImportProvider.tsx | 6 | 37 / 47 | Unit functions unexecuted |
| src/components/common/AudioProcessingSection.tsx | 7 | 0 / 0 | Behavior assertions and browser mapping still required |
| src/components/common/AutoSamplingPanel.tsx | 21 | 80 / 92 | Unit functions unexecuted |
| src/components/common/BuildIdentityNotice.tsx | 1 | 6 / 6 | Behavior assertions and browser mapping still required |
| src/components/common/ConfirmationModal.tsx | 4 | 3 / 7 | Unit functions unexecuted |
| src/components/common/DonatePage.tsx | 7 | 8 / 16 | Unit functions unexecuted |
| src/components/common/EnhancedTooltip.tsx | 0 | 3 / 5 | Unit functions unexecuted |
| src/components/common/EnhancedWaveformEditor.tsx | 2 | 14 / 15 | Unit functions unexecuted |
| src/components/common/ExportPreflight.tsx | 13 | 11 / 14 | Unit functions unexecuted |
| src/components/common/FeedbackPage.tsx | 1 | 5 / 7 | Unit functions unexecuted |
| src/components/common/FileDetailsBadges.tsx | 0 | 4 / 4 | Behavior assertions and browser mapping still required |
| src/components/common/FileDropZone.tsx | 3 | 0 / 0 | Behavior assertions and browser mapping still required |
| src/components/common/Footer.tsx | 3 | 2 / 2 | Behavior assertions and browser mapping still required |
| src/components/common/FourKnobControl.tsx | 1 | 0 / 0 | Behavior assertions and browser mapping still required |
| src/components/common/GeneratePresetSection.tsx | 8 | 0 / 0 | Behavior assertions and browser mapping still required |
| src/components/common/IconButton.tsx | 1 | 1 / 1 | Behavior assertions and browser mapping still required |
| src/components/common/MainTabs.tsx | 2 | 2 / 11 | Unit functions unexecuted |
| src/components/common/MidiDeviceSelector.tsx | 4 | 5 / 17 | Unit functions unexecuted |
| src/components/common/NotificationSystem.tsx | 1 | 0 / 0 | Behavior assertions and browser mapping still required |
| src/components/common/PWAInstallPrompt.tsx | 3 | 0 / 0 | Behavior assertions and browser mapping still required |
| src/components/common/PWAUpdatePrompt.tsx | 2 | 10 / 12 | Unit functions unexecuted |
| src/components/common/PercussionIllustration.tsx | 0 | 1 / 1 | Behavior assertions and browser mapping still required |
| src/components/common/ProjectKeyboardShortcuts.tsx | 0 | 4 / 4 | Behavior assertions and browser mapping still required |
| src/components/common/ProjectToolbar.tsx | 14 | 15 / 26 | Unit functions unexecuted |
| src/components/common/RecordingModal.tsx | 27 | 82 / 109 | Unit functions unexecuted |
| src/components/common/SessionRestorationModal.tsx | 2 | 7 / 12 | Unit functions unexecuted |
| src/components/common/SmallWaveform.tsx | 2 | 10 / 20 | Unit functions unexecuted |
| src/components/common/StemRecordingModal.tsx | 27 | 54 / 102 | Unit functions unexecuted |
| src/components/common/StudioShell.tsx | 38 | 54 / 95 | Unit functions unexecuted |
| src/components/common/TabNavigation.tsx | 1 | 10 / 10 | Behavior assertions and browser mapping still required |
| src/components/common/ToggleSwitch.tsx | 1 | 0 / 0 | Behavior assertions and browser mapping still required |
| src/components/common/WaveformEditor.tsx | 2 | 0 / 0 | Behavior assertions and browser mapping still required |
| src/components/common/WaveformZoomModal.tsx | 13 | 52 / 60 | Unit functions unexecuted |
| src/components/devices/DevicesWorkspace.tsx | 30 | 38 / 39 | Unit functions unexecuted |
| src/components/devices/useDevicesWorkspace.ts | 0 | 62 / 66 | Unit functions unexecuted |
| src/components/drum/DrumBulkEditModal.tsx | 11 | 7 / 18 | Unit functions unexecuted |
| src/components/drum/DrumFocusWorkspace.tsx | 24 | 12 / 38 | Unit functions unexecuted |
| src/components/drum/DrumKeyboard.tsx | 3 | 34 / 54 | Unit functions unexecuted |
| src/components/drum/DrumKeyboardContainer.tsx | 8 | 18 / 39 | Unit functions unexecuted |
| src/components/drum/DrumPresetSettings.tsx | 9 | 15 / 26 | Unit functions unexecuted |
| src/components/drum/DrumSampleSettingsModal.tsx | 13 | 13 / 37 | Unit functions unexecuted |
| src/components/drum/DrumSampleTable.tsx | 21 | 0 / 0 | Behavior assertions and browser mapping still required |
| src/components/drum/DrumTool.tsx | 25 | 34 / 61 | Unit functions unexecuted |
| src/components/drum/SliceAudioModal.tsx | 33 | 101 / 115 | Unit functions unexecuted |
| src/components/drum/SliceKeyboardMapping.tsx | 1 | 10 / 11 | Unit functions unexecuted |
| src/components/drum/StudioDemoLoader.tsx | 11 | 13 / 24 | Unit functions unexecuted |
| src/components/library/LibraryFilters.tsx | 5 | 5 / 5 | Behavior assertions and browser mapping still required |
| src/components/library/LibraryPage.tsx | 34 | 70 / 102 | Unit functions unexecuted |
| src/components/library/LibraryPagination.tsx | 4 | 4 / 12 | Unit functions unexecuted |
| src/components/library/LibraryTable.tsx | 1 | 1 / 5 | Unit functions unexecuted |
| src/components/library/LibraryTableContent.tsx | 22 | 10 / 26 | Unit functions unexecuted |
| src/components/library/PresetNameInput.tsx | 1 | 4 / 4 | Behavior assertions and browser mapping still required |
| src/components/library/useLibraryPreview.ts | 0 | 12 / 16 | Unit functions unexecuted |
| src/components/multisample/MultisampleAdvancedSettings.tsx | 13 | 0 / 0 | Behavior assertions and browser mapping still required |
| src/components/multisample/MultisampleFocusWorkspace.tsx | 16 | 25 / 36 | Unit functions unexecuted |
| src/components/multisample/MultisamplePresetSettings.tsx | 18 | 10 / 40 | Unit functions unexecuted |
| src/components/multisample/MultisampleSampleTable.tsx | 25 | 0 / 0 | Behavior assertions and browser mapping still required |
| src/components/multisample/MultisampleTool.tsx | 19 | 18 / 59 | Unit functions unexecuted |
| src/components/multisample/VirtualMidiKeyboard.tsx | 5 | 25 / 69 | Unit functions unexecuted |
| src/context/AppContext.tsx | 0 | 29 / 38 | Unit functions unexecuted |
| src/context/StudioTheme.ts | 0 | 1 / 1 | Behavior assertions and browser mapping still required |
| src/context/StudioThemeContext.tsx | 0 | 7 / 9 | Unit functions unexecuted |
| src/hooks/audioVoiceLifecycle.ts | 0 | 5 / 5 | Behavior assertions and browser mapping still required |
| src/hooks/useAudioPlayer.ts | 0 | 31 / 47 | Unit functions unexecuted |
| src/hooks/useFileUpload.ts | 0 | 5 / 5 | Behavior assertions and browser mapping still required |
| src/hooks/useOwnedDialog.ts | 0 | 8 / 8 | Behavior assertions and browser mapping still required |
| src/hooks/usePatchGeneration.ts | 0 | 4 / 5 | Unit functions unexecuted |
| src/hooks/useProjectEditGesture.ts | 0 | 6 / 6 | Behavior assertions and browser mapping still required |
| src/hooks/useSessionManagement.ts | 0 | 26 / 31 | Unit functions unexecuted |
| src/hooks/useStudioCanvasTheme.ts | 0 | 7 / 9 | Unit functions unexecuted |
| src/hooks/useWebMidi.ts | 0 | 9 / 37 | Unit functions unexecuted |
| src/midi/browserSession.ts | 0 | 54 / 60 | Unit functions unexecuted |
| src/midi/ccProfile.ts | 0 | 9 / 9 | Behavior assertions and browser mapping still required |
| src/midi/deviceSetup.ts | 0 | 22 / 22 | Behavior assertions and browser mapping still required |
| src/midi/ninaProfile.ts | 0 | 4 / 4 | Behavior assertions and browser mapping still required |
| src/midi/routeLease.ts | 0 | 7 / 7 | Behavior assertions and browser mapping still required |
| src/utils/aifParser.ts | 0 | 7 / 8 | Unit functions unexecuted |
| src/utils/aiffExport.ts | 0 | 6 / 6 | Behavior assertions and browser mapping still required |
| src/utils/audio.ts | 0 | 22 / 25 | Unit functions unexecuted |
| src/utils/audioAssetSerialization.ts | 0 | 2 / 2 | Behavior assertions and browser mapping still required |
| src/utils/audioBufferConversion.ts | 0 | 3 / 3 | Behavior assertions and browser mapping still required |
| src/utils/audioContext.ts | 0 | 11 / 11 | Behavior assertions and browser mapping still required |
| src/utils/audioExport.ts | 0 | 3 / 9 | Unit functions unexecuted |
| src/utils/audioFormats.ts | 0 | 10 / 11 | Unit functions unexecuted |
| src/utils/audioImport.ts | 0 | 17 / 17 | Behavior assertions and browser mapping still required |
| src/utils/audioImportPreflight.ts | 0 | 9 / 9 | Behavior assertions and browser mapping still required |
| src/utils/audioSlicing.ts | 0 | 63 / 63 | Behavior assertions and browser mapping still required |
| src/utils/buildIdentity.ts | 0 | 5 / 5 | Behavior assertions and browser mapping still required |
| src/utils/cookies.ts | 0 | 2 / 3 | Unit functions unexecuted |
| src/utils/defaultSettings.ts | 0 | 10 / 10 | Behavior assertions and browser mapping still required |
| src/utils/deviceExportPreflight.ts | 0 | 19 / 21 | Unit functions unexecuted |
| src/utils/exportPlanning.ts | 0 | 8 / 8 | Behavior assertions and browser mapping still required |
| src/utils/externalFileIntake.ts | 0 | 19 / 20 | Unit functions unexecuted |
| src/utils/importedCrossfade.ts | 0 | 8 / 9 | Unit functions unexecuted |
| src/utils/indexedDB.ts | 0 | 109 / 121 | Unit functions unexecuted |
| src/utils/jsonImport.ts | 0 | 10 / 11 | Unit functions unexecuted |
| src/utils/keyboardOwnership.ts | 0 | 5 / 5 | Behavior assertions and browser mapping still required |
| src/utils/libraryBatchExport.ts | 0 | 9 / 9 | Behavior assertions and browser mapping still required |
| src/utils/libraryUtils.ts | 0 | 9 / 10 | Unit functions unexecuted |
| src/utils/loopEditing.ts | 0 | 10 / 10 | Behavior assertions and browser mapping still required |
| src/utils/midi.ts | 0 | 2 / 5 | Unit functions unexecuted |
| src/utils/op1DrumPresetParser.ts | 0 | 5 / 6 | Unit functions unexecuted |
| src/utils/patchGeneration.ts | 0 | 28 / 30 | Unit functions unexecuted |
| src/utils/patreonPosts.ts | 0 | 6 / 8 | Unit functions unexecuted |
| src/utils/presetImport.ts | 0 | 11 / 11 | Behavior assertions and browser mapping still required |
| src/utils/projectArchive.ts | 0 | 36 / 36 | Behavior assertions and browser mapping still required |
| src/utils/projectEditIdentity.ts | 0 | 2 / 2 | Behavior assertions and browser mapping still required |
| src/utils/projectHistory.ts | 0 | 16 / 16 | Behavior assertions and browser mapping still required |
| src/utils/projectSerialization.ts | 0 | 13 / 13 | Behavior assertions and browser mapping still required |
| src/utils/recordingApplication.ts | 0 | 22 / 22 | Behavior assertions and browser mapping still required |
| src/utils/sampleSuggestions.ts | 0 | 8 / 8 | Behavior assertions and browser mapping still required |
| src/utils/sessionStorage.ts | 0 | 8 / 21 | Unit functions unexecuted |
| src/utils/sessionStorageIndexedDB.ts | 0 | 27 / 37 | Unit functions unexecuted |
| src/utils/storedAudio.ts | 0 | 7 / 7 | Behavior assertions and browser mapping still required |
| src/utils/studioDemo.ts | 0 | 18 / 20 | Unit functions unexecuted |
| src/utils/valueConversions.ts | 0 | 4 / 4 | Behavior assertions and browser mapping still required |
| src/utils/version.ts | 0 | 1 / 1 | Behavior assertions and browser mapping still required |
| src/utils/wavExport.ts | 0 | 6 / 6 | Behavior assertions and browser mapping still required |
