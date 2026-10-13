import React from 'react';
import { useOwnedDialog } from '../../hooks/useOwnedDialog';

interface ConfirmationModalProps {
  isOpen: boolean;
  message: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmationModal({
  isOpen,
  message,
  onConfirm,
  onCancel
}: ConfirmationModalProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const headingId = React.useId();
  const messageId = React.useId();
  const [failed, setFailed] = React.useState(false);
  const dialogRef=React.useRef<HTMLDivElement>(null);
  // Read synchronously by Escape, the backdrop and a second click, before the pending render lands.
  const pendingRef = React.useRef(false);
  const settledRef = React.useRef(false);
  // A running confirm cannot be cancelled: its buttons are disabled, so Escape and the backdrop must agree.
  const handleCancel = () => { if (!pendingRef.current) onCancel(); };
  useOwnedDialog({active:isOpen,dialogRef,onClose:handleCancel});

  React.useEffect(() => { if (!isOpen) setFailed(false); }, [isOpen]);

  // Disabling the focused button drops focus to the page; hold it on the dialog, then hand it back to cancel.
  React.useEffect(() => {
    if (isLoading) dialogRef.current?.focus();
    else if (settledRef.current) {
      settledRef.current = false;
      dialogRef.current?.querySelector<HTMLButtonElement>('[data-initial-focus="true"]')?.focus();
    }
  }, [isLoading]);

  const handleConfirm = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setFailed(false);
    setIsLoading(true);
    try {
      await onConfirm();
    } catch (error) {
      console.error('Error in confirmation callback:', error);
      setFailed(true);
    } finally {
      pendingRef.current = false;
      settledRef.current = true;
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        fontFamily: '"Montserrat", "Arial", sans-serif'
      }}
      onClick={handleCancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-busy={isLoading}
        aria-labelledby={headingId}
        aria-describedby={messageId}
        tabIndex={-1}
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          borderRadius: '6px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
          maxWidth: '400px',
          width: '90%',
          margin: '0 1rem',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1.5rem 1.5rem 1rem 1.5rem',
          borderBottom: '1px solid var(--color-border-subtle)'
        }}>
          <h3 id={headingId} style={{
            margin: '0',
            fontSize: '1.25rem',
            fontWeight: '300',
            color: 'var(--color-text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <i className="fas fa-exclamation-triangle" style={{
              color: 'var(--color-text-primary)',
              fontSize: '1.25rem'
            }} aria-hidden="true"></i>
            confirm action
          </h3>
        </div>

        {/* Content */}
        <div id={messageId} style={{
          padding: '1.5rem',
          color: 'var(--color-text-secondary)',
          fontSize: '0.95rem',
          lineHeight: '1.5'
        }}>
          {message}
        </div>

        <span className="studio-visually-hidden" role="status">
          {isLoading ? 'Working on it. Please wait.' : ''}
        </span>
        {failed && !isLoading && (
          <p role="alert" style={{
            margin: 0,
            padding: '0 1.5rem',
            color: 'var(--color-text-primary)',
            fontSize: '0.875rem',
            lineHeight: '1.5'
          }}>
            That did not finish. This dialog is still open so you can try again or cancel.
          </p>
        )}

        {/* Actions */}
        <div style={{
          padding: '1rem 1.5rem 1.5rem 1.5rem',
          display: 'flex',
          gap: '0.75rem',
          justifyContent: 'flex-end'
        }}>
          <button
            data-initial-focus="true"
            onClick={handleCancel}
            disabled={isLoading}
            style={{
              padding: '0.625rem 1.25rem',
              border: '1px solid var(--color-border-medium)',
              borderRadius: '3px',
              backgroundColor: 'var(--color-bg-primary)',
              color: isLoading ? 'var(--color-border-medium)' : 'var(--color-text-secondary)',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit',
              minWidth: '80px',
              opacity: isLoading ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                e.currentTarget.style.borderColor = 'var(--color-border-medium)';
                e.currentTarget.style.color = 'var(--color-interactive-dark)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                e.currentTarget.style.borderColor = 'var(--color-border-medium)';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }
            }}
          >
            cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            style={{
              padding: '0.625rem 1.25rem',
              border: 'none',
              borderRadius: '3px',
              backgroundColor: isLoading ? 'var(--color-border-medium)' : 'var(--color-interactive-focus)',
              color: 'var(--studio-accent-text)',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit',
              minWidth: '80px',
              opacity: isLoading ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = 'var(--color-interactive-dark)';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = 'var(--color-interactive-focus)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            {isLoading && <i className="fas fa-spinner fa-spin" style={{ fontSize: '0.875rem' }} aria-hidden="true"></i>}
            {isLoading ? 'processing...' : 'ok'}
          </button>
        </div>
      </div>
    </div>
  );
}
