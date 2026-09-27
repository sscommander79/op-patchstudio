import { useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateDrumPatch, generateMultisamplePatch, downloadBlob } from '../utils/patchGeneration';
import { isMappedDrumSample } from '../utils/deviceExportPreflight';

export function usePatchGeneration() {
  const { state, dispatch } = useAppContext();

  const generateDrumPatchFile = useCallback(async (patchName?: string,options:{includeUnassigned?:boolean}={}) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const loadedSamples = state.drumSamples.filter(sample => sample.isLoaded);
      if (loadedSamples.length === 0) {
        throw new Error('No samples loaded');
      }

      const finalPatchName = patchName || state.drumSettings.presetName || `drum_patch_${Date.now()}`;
      
      // Get audio format settings from drum settings
      const targetSampleRate = state.drumSettings.sampleRate || undefined;
      const targetBitDepth = state.drumSettings.bitDepth || undefined;
      const targetChannels = state.drumSettings.channels === 1 ? "mono" : "keep";
      
      const exportState=options.includeUnassigned===false?{...state,drumSamples:state.drumSamples.map((sample,index)=>{
        const mapped=sample.isLoaded&&isMappedDrumSample(sample,index);
        return mapped?sample:{...sample,isLoaded:false};
      })}:state;
      const patchBlob = await generateDrumPatch(
        exportState,
        finalPatchName,
        targetSampleRate,
        targetBitDepth,
        targetChannels,
        state.drumSettings.audioFormat
      );
      
      const filename=`${finalPatchName}.preset.zip`;
      downloadBlob(patchBlob, filename);
      return {ok:true as const,filename};
      
      // Show success message (could be enhanced with a proper notification system)
      
    } catch (error) {
      console.error('Error generating drum patch:', error);
      const message=error instanceof Error ? error.message : 'Failed to generate patch';
      dispatch({ 
        type: 'SET_ERROR', 
        payload: message
      });
      return {ok:false as const,error:message};
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state, dispatch]);

  const generateMultisamplePatchFile = useCallback(async (patchName?: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      if (state.multisampleFiles.length === 0) {
        throw new Error('No samples loaded');
      }

      const finalPatchName = patchName || state.multisampleSettings.presetName || `multisample_patch_${Date.now()}`;
      
      // Get audio format settings from multisample settings
      const targetSampleRate = state.multisampleSettings.sampleRate || undefined;
      const targetBitDepth = state.multisampleSettings.bitDepth || undefined;
      const targetChannels = state.multisampleSettings.channels === 1 ? "mono" : "keep";
      const multisampleGain = state.multisampleSettings.gain || 0; // Get gain from UI settings
      
      const patchBlob = await generateMultisamplePatch(
        state, 
        finalPatchName,
        targetSampleRate,
        targetBitDepth,
        targetChannels,
        multisampleGain,
        state.multisampleSettings.audioFormat
      );
      
      const filename=`${finalPatchName}.preset.zip`;
      downloadBlob(patchBlob, filename);
      return {ok:true as const,filename};
      
      // Show success message
      
    } catch (error) {
      console.error('Error generating multisample patch:', error);
      const message=error instanceof Error ? error.message : 'Failed to generate patch';
      dispatch({ 
        type: 'SET_ERROR', 
        payload: message
      });
      return {ok:false as const,error:message};
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state, dispatch]);

  return {
    generateDrumPatchFile,
    generateMultisamplePatchFile,
  };
}
