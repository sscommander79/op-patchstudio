import { lazy, Suspense } from 'react';
import { useAppContext } from '../../context/AppContext';
import { FEATURE_FLAGS } from '../../utils/constants';

const MultisampleTool = lazy(() => import('../multisample/MultisampleTool').then(module => ({ default: module.MultisampleTool })));
const DrumTool = lazy(() => import('../drum/DrumTool').then(module => ({ default: module.DrumTool })));
const LibraryPage = lazy(() => import('../library/LibraryPage').then(module => ({ default: module.LibraryPage })));
const FeedbackPage = lazy(() => import('./FeedbackPage').then(module => ({ default: module.FeedbackPage })));
const DonatePage = lazy(() => import('./DonatePage').then(module => ({ default: module.DonatePage })));

const loadingSurface = <p className="studio-workspace-loading">Loading workspace…</p>;

export type RecorderRequest = { id: number; tab: 'drum' | 'multisample'; guided: boolean; source: 'hardware' | 'software' };

export function MainTabs({ recorderRequest, onRecorderRequestConsumed }: {
  recorderRequest?: RecorderRequest | null;
  onRecorderRequestConsumed?: () => void;
} = {}) {
  const { state } = useAppContext();

  return (
    <div className="studio-workspace-tabs">
      {/* The shell owns navigation; this component renders only the chosen working surface. */}
      {state.currentTab === 'drum' && (
        <section
          id="drum-tabpanel"
          aria-label="drum tool content"
          className="studio-workspace-panel"
        >
          <Suspense fallback={loadingSurface}><DrumTool recorderRequest={recorderRequest?.tab === 'drum' ? recorderRequest : null} onRecorderRequestConsumed={onRecorderRequestConsumed} /></Suspense>
        </section>
      )}
      
      {state.currentTab === 'multisample' && (
        <section
          id="multisample-tabpanel"
          aria-label="multisample tool content"
          className="studio-workspace-panel"
        >
          <Suspense fallback={loadingSurface}><MultisampleTool recorderRequest={recorderRequest?.tab === 'multisample' ? recorderRequest : null} onRecorderRequestConsumed={onRecorderRequestConsumed} /></Suspense>
        </section>
      )}
      
      {state.currentTab === 'feedback' && (
        <section
          id="feedback-tabpanel"
          aria-label="feedback and support content"
          className="studio-workspace-panel"
        >
          <Suspense fallback={loadingSurface}><FeedbackPage /></Suspense>
        </section>
      )}
      
      {state.currentTab === 'donate' && FEATURE_FLAGS.DONATE_PAGE && (
        <section
          id="donate-tabpanel"
          aria-label="donation and support content"
          className="studio-workspace-panel"
        >
          <Suspense fallback={loadingSurface}><DonatePage /></Suspense>
        </section>
      )}
      
      {state.currentTab === 'library' && (
        <section
          id="library-tabpanel"
          aria-label="preset library content"
          className="studio-workspace-panel"
        >
          <Suspense fallback={loadingSurface}><LibraryPage /></Suspense>
        </section>
      )}
    </div>
  );
}
