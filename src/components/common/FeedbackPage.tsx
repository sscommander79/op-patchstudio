import { useState, useEffect } from 'react';

export function FeedbackPage() {
  const [isMobile, setIsMobile] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    const markOnline = () => setIsOnline(true);
    const markOffline = () => setIsOnline(false);
    window.addEventListener('resize', checkMobile);
    window.addEventListener('online', markOnline);
    window.addEventListener('offline', markOffline);
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('online', markOnline);
      window.removeEventListener('offline', markOffline);
    };
  }, []);

  return (
    <div style={{
      background: 'var(--color-bg-primary)',
      borderRadius: '15px',
      boxShadow: '0 2px 8px var(--color-shadow-primary)',
      border: '1px solid var(--color-border-subtle)',
      overflow: 'hidden',
      margin: isMobile ? '0.5rem 0.5rem 1rem 0.5rem' : '2rem 2rem 1rem 2rem'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.7rem 1rem 0.5rem 1rem',
        borderBottom: '1px solid var(--color-border-medium)',
        backgroundColor: 'var(--color-bg-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <h3 style={{
            margin: 0,
            color: 'var(--color-text-primary)',
            fontSize: '1.25rem',
            fontWeight: 300,
          }}>
            feedback
          </h3>
        </div>
      </div>

      {/* Content */}
      <div style={{
        padding: isMobile ? '1rem' : '2rem',
      }}>
        {/* User note about checking GitHub issues first */}
        <div style={{
          marginBottom: '1.5rem',
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border-light)',
          borderRadius: '6px',
          padding: '1rem',
          color: 'var(--color-text-secondary)',
          fontSize: '1rem',
          textAlign: 'center',
          lineHeight: 1.5
        }}>
          <i className="fas fa-info-circle" style={{ marginRight: '0.5rem', color: 'var(--color-text-secondary)' }}></i>
          before submitting an issue,<br/>please <a href="https://github.com/sscommander79/op-patchstudio/issues" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-text-secondary)', textDecoration: 'underline', wordBreak: 'break-all' }}>check if your bug or request has already been raised here</a>.
        </div>
        {isOnline ? <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
          <iframe
            title="OP-PatchStudio feedback form"
            src="https://docs.google.com/forms/d/e/1FAIpQLSdgfoCaXzmQL6iF4QR08owfFSAwH651jlGChzcnz-pqwsI4Gw/viewform?embedded=true"
            width="1200"
            height="1000"
            frameBorder="0"
            marginHeight={0}
            marginWidth={0}
            style={{
              border: 'none',
              borderRadius: '15px',
              maxWidth: '100%',
              minHeight: '800px',
              background: 'white'
            }}
          >
            loading…
          </iframe>
        </div> : <div role="status" className="studio-message studio-message-info">
          The hosted feedback form is unavailable while offline. Use the Drum, Multisample, or Library tabs to keep working; the form will return when you reconnect.
        </div>}
      </div>
    </div>
  );
}
