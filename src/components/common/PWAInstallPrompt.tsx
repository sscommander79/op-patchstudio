import React, { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Storage keys for tracking user behavior
const STORAGE_KEYS = {
  INSTALL_DISMISSED: 'pwa_install_dismissed',
  INSTALL_ACCEPTED: 'pwa_install_accepted',
  REMIND_LATER: 'pwa_install_remind_later',
  VISIT_COUNT: 'pwa_visit_count',
  LAST_PROMPT_DATE: 'pwa_last_prompt_date'
};

// Configuration
const PROMPT_CONFIG = {
  FIRST_VISIT_DELAY: 3000, // 3 seconds after first visit
  REPROMPT_INTERVAL: 7 * 24 * 60 * 60 * 1000, // 7 days
  VISIT_THRESHOLD: 6, // After Later, stay hidden until this many further visits
  MOBILE_DELAY: 2000, // Shorter delay for mobile
  DESKTOP_DELAY: 5000 // Longer delay for desktop
};

  const readVisitCount = (): number => {
    const count = parseInt(localStorage.getItem(STORAGE_KEYS.VISIT_COUNT) || '0', 10);
    return Number.isFinite(count) && count > 0 ? count : 0;
  };

  // Check if user should see the prompt
  const shouldShowPrompt = (): boolean => {
    // Don't show if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return false;
    }

    // Don't show if user already accepted
    if (localStorage.getItem(STORAGE_KEYS.INSTALL_ACCEPTED)) {
      return false;
    }

    // Check if user recently dismissed
    const dismissedDate = localStorage.getItem(STORAGE_KEYS.INSTALL_DISMISSED);
    if (dismissedDate) {
      const lastDismissed = new Date(dismissedDate).getTime();
      const now = new Date().getTime();

      // If dismissed within the repropt interval, don't show again
      if (now - lastDismissed < PROMPT_CONFIG.REPROMPT_INTERVAL) {
        return false;
      }
    }

    // Later hides the promotion until the visit threshold is reached again
    if (localStorage.getItem(STORAGE_KEYS.REMIND_LATER) && readVisitCount() < PROMPT_CONFIG.VISIT_THRESHOLD) {
      return false;
    }

    return true;
  };

  // A visit is one loaded document. This module is evaluated once per document, so the flag
  // survives the prompt unmounting and remounting as the user moves between in-app pages.
  let visitCountedForThisDocument = false;

  // Track visit count
  const trackVisit = () => {
    if (visitCountedForThisDocument) return;
    visitCountedForThisDocument = true;
    localStorage.setItem(STORAGE_KEYS.VISIT_COUNT, (readVisitCount() + 1).toString());
  };

const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check device type
  const checkDeviceType = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    setIsMobile(isMobileDevice);
  };

  // trackVisit counts once per document however often this mounts; kept apart from the listener effect, which re-runs when isMobile settles.
  useEffect(() => {
    checkDeviceType();
    trackVisit();
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Show prompt after delay if conditions are met
      if (shouldShowPrompt()) {
        const delay = isMobile ? PROMPT_CONFIG.MOBILE_DELAY : PROMPT_CONFIG.DESKTOP_DELAY;
        setTimeout(() => {
          setShowInstallPrompt(true);
          // Trigger fade in animation
          setTimeout(() => setIsVisible(true), 10);
          localStorage.setItem(STORAGE_KEYS.LAST_PROMPT_DATE, new Date().toISOString());
        }, delay);
      }
    };

    const handleAppInstalled = () => {
      // Hide the app-provided install promotion
      handleFadeOut();
      // Mark as accepted
      localStorage.setItem(STORAGE_KEYS.INSTALL_ACCEPTED, new Date().toISOString());
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isMobile]);

  const handleFadeOut = () => {
    setIsVisible(false);
    setTimeout(() => {
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    }, 200); // Match transition duration
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    // An answered prompt replaces any earlier Later reminder
    localStorage.removeItem(STORAGE_KEYS.REMIND_LATER);
    if (outcome === 'accepted') {
      localStorage.setItem(STORAGE_KEYS.INSTALL_ACCEPTED, new Date().toISOString());
    } else {
      localStorage.setItem(STORAGE_KEYS.INSTALL_DISMISSED, new Date().toISOString());
    }

    // Clear the deferredPrompt
    handleFadeOut();
  };

  const handleDismiss = () => {
    handleFadeOut();
    localStorage.removeItem(STORAGE_KEYS.REMIND_LATER);
    localStorage.setItem(STORAGE_KEYS.INSTALL_DISMISSED, new Date().toISOString());
  };

  const handleRemindLater = () => {
    handleFadeOut();
    // Swap any week-long dismissal for a visit-based reminder, counted from this visit
    localStorage.removeItem(STORAGE_KEYS.INSTALL_DISMISSED);
    localStorage.setItem(STORAGE_KEYS.REMIND_LATER, new Date().toISOString());
    localStorage.setItem(STORAGE_KEYS.VISIT_COUNT, '0');
  };

  if (!showInstallPrompt) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Install OP-PatchStudio"
      style={{
        position: 'fixed',
        bottom: isMobile ? '10px' : '20px',
        right: isMobile ? '10px' : '20px',
        left: isMobile ? '10px' : 'auto',
        backgroundColor: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border-light)',
        borderRadius: '6px',
        padding: isMobile ? '12px' : '16px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: 1000,
        maxWidth: isMobile ? 'none' : '300px',
        color: 'var(--color-text-primary)',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        fontFamily: '"Montserrat", "Arial", sans-serif'
      }}
    >
      <div style={{ marginBottom: '12px' }}>
        <strong style={{
          display: 'block',
          marginBottom: '4px',
          fontSize: '0.95rem',
          fontWeight: '500',
          color: 'var(--color-text-primary)'
        }}>
          Install OP-PatchStudio (optional)
        </strong>
        <span style={{
          fontSize: '0.875rem',
          color: 'var(--color-text-secondary)',
          lineHeight: '1.4'
        }}>
          Installing adds an app shortcut that opens in its own window. The studio works the same in this browser tab, and your work stays in this browser either way. Installing does not back it up.
        </span>
      </div>

      <div style={{
        display: 'flex',
        gap: '8px',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'flex-end'
      }}>
        <button
          type="button"
          title={`Hide this and ask again after ${PROMPT_CONFIG.VISIT_THRESHOLD} more visits`}
          onClick={handleRemindLater}
          style={{
            padding: '0.5rem 0.75rem',
            border: '1px solid var(--color-border-medium)',
            borderRadius: '3px',
            backgroundColor: 'var(--color-bg-primary)',
            color: 'var(--color-text-secondary)',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontFamily: 'inherit',
            minWidth: '80px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
            e.currentTarget.style.borderColor = 'var(--color-border-medium)';
            e.currentTarget.style.color = 'var(--color-interactive-dark)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
            e.currentTarget.style.borderColor = 'var(--color-border-medium)';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          Later
        </button>
        <button
          type="button"
          title="Hide this for a week"
          onClick={handleDismiss}
          style={{
            padding: '0.5rem 0.75rem',
            border: '1px solid var(--color-border-medium)',
            borderRadius: '3px',
            backgroundColor: 'var(--color-bg-primary)',
            color: 'var(--color-text-secondary)',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontFamily: 'inherit',
            minWidth: '80px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
            e.currentTarget.style.borderColor = 'var(--color-border-medium)';
            e.currentTarget.style.color = 'var(--color-interactive-dark)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
            e.currentTarget.style.borderColor = 'var(--color-border-medium)';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          Dismiss
        </button>
        <button
          type="button"
          title="Open the browser's install dialog"
          onClick={handleInstallClick}
          style={{
            padding: '0.5rem 0.75rem',
            border: 'none',
            borderRadius: '3px',
            backgroundColor: 'var(--color-interactive-focus)',
            color: 'var(--studio-accent-text)',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontFamily: 'inherit',
            minWidth: '80px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-interactive-dark)';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-interactive-focus)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Install
        </button>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
