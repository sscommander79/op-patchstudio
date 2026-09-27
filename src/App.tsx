import { Content, Theme } from '@carbon/react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { StudioShell } from './components/common/StudioShell';
import { NotificationSystem } from './components/common/NotificationSystem';
import { AppContextProvider, useAppContext } from './context/AppContext';
import { StudioThemeProvider } from './context/StudioThemeContext';
import { useStudioTheme } from './context/StudioTheme';
import PWAInstallPrompt from './components/common/PWAInstallPrompt';
import { PWAUpdatePrompt } from './components/common/PWAUpdatePrompt';
import { BuildIdentityNotice } from './components/common/BuildIdentityNotice';
import { Footer } from './components/common/Footer';
import { SessionRestorationModal } from './components/common/SessionRestorationModal';
import { useSessionManagement } from './hooks/useSessionManagement';
import { registerOverlayControl } from './components/common/WaveformEditor';
import { ProjectKeyboardShortcuts } from './components/common/ProjectKeyboardShortcuts';
import { AudioImportProvider } from './components/common/AudioImportProvider';
import './theme/device-themes.scss';
import './styles/studio.css';

const FeedbackPage = lazy(() => import('./components/common/FeedbackPage').then(module => ({ default: module.FeedbackPage })));
const DonatePage = lazy(() => import('./components/common/DonatePage').then(module => ({ default: module.DonatePage })));

function ThemePicker() {
  const { preference, setPreference } = useStudioTheme();
  return <label className="studio-theme-picker"><span>Theme</span><select aria-label="Theme" value={preference} onChange={event => setPreference(event.target.value as 'light' | 'dark' | 'system')}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>;
}

// Retained API for waveform callers. Small screens open the requested editor
// directly; the studio never blocks work behind an orientation requirement.
export const triggerRotateOverlay = (zoomCallback?: () => void) => zoomCallback?.();
export const hideRotateOverlay = () => undefined;

function AppContent() {
  const { state, dispatch } = useAppContext();
  const { resolved } = useStudioTheme();
  const [currentRoute, setCurrentRoute] = useState(() => window.location.hash === '#/feedback' ? 'feedback' : window.location.hash === '#/donate' ? 'donate' : 'home');
  const { loadSession, declineSessionRestoration, saveSession, recoveryPending, recoveryError } = useSessionManagement();

  useEffect(() => {
    registerOverlayControl(callback => callback?.());
  }, []);

  useEffect(() => {
    const handleHashChange = () => setCurrentRoute(window.location.hash === '#/feedback' ? 'feedback' : window.location.hash === '#/donate' ? 'donate' : 'home');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return <Theme theme={resolved === 'dark' ? 'g100' : 'white'} className="opxy-theme studio-app">
    <ProjectKeyboardShortcuts />
    <Content className="studio-content">
      {currentRoute === 'feedback' ? <Suspense fallback={<p>Loading feedback…</p>}><FeedbackPage /></Suspense> : currentRoute === 'donate' ? <Suspense fallback={<p>Loading support…</p>}><DonatePage /></Suspense> : <>
        <StudioShell onRetrySave={saveSession} themePicker={<ThemePicker />} />
        <NotificationSystem notifications={state.notifications} onDismiss={id => dispatch({ type: 'REMOVE_NOTIFICATION', payload: id })} />
        <PWAInstallPrompt />
        <PWAUpdatePrompt />
        <BuildIdentityNotice />
        <Footer />
      </>}
    </Content>
    <SessionRestorationModal
      isOpen={state.isSessionRestorationModalOpen}
      onLoadSession={loadSession}
      onStartNew={declineSessionRestoration}
      sessionInfo={state.sessionInfo}
      pending={recoveryPending}
      error={recoveryError}
    />
  </Theme>;
}

export default function App() {
  return <StudioThemeProvider><AppContextProvider><AudioImportProvider><AppContent /></AudioImportProvider></AppContextProvider></StudioThemeProvider>;
}
