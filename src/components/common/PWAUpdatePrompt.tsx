import { useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

const reloadCurrentPage = () => window.location.reload();

export function PWAUpdatePrompt({ reloadPage = reloadCurrentPage }: { reloadPage?: () => void }) {
  const [notice, setNotice] = useState<'update' | 'offline' | 'blocked' | null>(null);
  const registration = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const reloadConsent = useRef(false);

  useEffect(() => {
    let refreshPending = false;
    let claimedWorker: ServiceWorker | null = null;
    const claimWaitingWorker = () => {
      const worker = registration.current?.waiting ?? null;
      if (!refreshPending || !worker || worker === claimedWorker) return;
      claimedWorker = worker;
      worker.postMessage({ type: 'OPSTUDIO_CLAIM_WAITING' });
    };
    const handleWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'OPSTUDIO_UPDATE_BLOCKED_OPEN_TABS') return;
      reloadConsent.current = false;
      setNotice('blocked');
    };
    navigator.serviceWorker?.addEventListener('message', handleWorkerMessage);
    registerSW({
      onNeedRefresh: () => {
        refreshPending = true;
        claimWaitingWorker();
        setNotice('update');
      },
      onOfflineReady: () => setNotice('offline'),
      onRegisteredSW: (_url, currentRegistration) => {
        registration.current = currentRegistration;
        claimWaitingWorker();
      },
      onNeedReload: () => {
        if (reloadConsent.current) reloadPage();
      },
    });
    return () => navigator.serviceWorker?.removeEventListener('message', handleWorkerMessage);
  }, [reloadPage]);

  if (!notice) return null;

  return (
    <aside className="studio-pwa-notice" role="status" aria-live="polite">
      <p>
        {notice === 'update'
          ? 'An update is ready. Save or back up your project before updating.'
          : notice === 'blocked'
            ? 'Close other OP-PatchStudio tabs before updating, then choose Update now again.'
          : 'The studio is ready to work offline.'}
      </p>
      <div className="studio-pwa-notice__actions">
        {(notice === 'update' || notice === 'blocked') && (
          <button type="button" onClick={() => {
            const waitingWorker = registration.current?.waiting;
            if (!waitingWorker) {
              reloadConsent.current = false;
              setNotice('blocked');
              return;
            }
            reloadConsent.current = true;
            waitingWorker.postMessage({ type: 'OPSTUDIO_ACTIVATE_IF_SOLE_CLIENT' });
          }}>
            Update now
          </button>
        )}
        <button type="button" onClick={() => setNotice(null)}>Later</button>
      </div>
    </aside>
  );
}
