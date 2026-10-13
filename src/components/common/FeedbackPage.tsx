import { useState, useEffect } from 'react';

export function FeedbackPage() {
  const [showForm,setShowForm]=useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const markOnline = () => setIsOnline(true);
    const markOffline = () => setIsOnline(false);
    window.addEventListener('online', markOnline);
    window.addEventListener('offline', markOffline);
    return () => {
      window.removeEventListener('online', markOnline);
      window.removeEventListener('offline', markOffline);
    };
  }, []);

  return (
    <div className="studio-shell-content">
      <a className="studio-back-link" href="#/studio/overview" style={{ display: 'inline-flex', alignItems: 'center' }}>← Back to the studio</a>
      <p className="studio-eyebrow">Help improve the studio</p>
      <h1>Feedback</h1>
      <p className="studio-shell-lead">Report a problem or suggest an improvement. Your project stays open in the studio while you are here.</p>

      <div style={{ display: 'grid', gap: '1rem' }}>
        <section className="studio-setup-panel" aria-labelledby="feedback-before-heading">
          <h2 id="feedback-before-heading">Before you send</h2>
          <p>
            Someone may have reported the same thing. Please{' '}
            <a href="https://github.com/sscommander79/op-patchstudio/issues" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>check if your bug or request has already been raised here</a>
            {' '}(opens GitHub in a new tab).
          </p>
        </section>

        <section className="studio-setup-panel" aria-labelledby="feedback-form-heading">
          <h2 id="feedback-form-heading">Feedback form</h2>
          <p>
            This form is an outside service: it is hosted by Google Forms. Showing it connects your browser to Google, and what you type
            is sent to Google and shared with the people who run this project when you submit it. Your presets, samples, and projects are not attached or sent.
          </p>
          {isOnline&&!showForm&&<button type="button" className="studio-button-primary" onClick={()=>setShowForm(true)}>Load Google form</button>}
          {isOnline&&showForm ? <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
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
                borderRadius: '8px',
                maxWidth: '100%',
                minHeight: '800px',
                background: 'white'
              }}
            >
              Loading…
            </iframe>
          </div> : !isOnline&&<div role="status" className="studio-message studio-message-warning">
            The hosted feedback form is unavailable while offline. Use Back to the studio to keep working. You can load the form after reconnecting.
          </div>}
        </section>
      </div>
    </div>
  );
}
