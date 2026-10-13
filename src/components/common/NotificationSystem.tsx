import { useEffect } from 'react';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  // In milliseconds. Defaults to 5000, except errors, which stay until dismissed unless a duration is given.
  duration?: number;
}

interface NotificationSystemProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

export function NotificationSystem({ notifications, onDismiss }: NotificationSystemProps) {
  // Auto-dismiss notifications after their duration. An error without an explicit
  // duration gets no timer, so it cannot disappear before it has been read.
  useEffect(() => {
    const timers: number[] = [];

    notifications.forEach(notification => {
      const duration = notification.duration || (notification.type === 'error' ? 0 : 5000);
      if (!duration) return;
      const timer = window.setTimeout(() => {
        onDismiss(notification.id);
      }, duration);
      timers.push(timer);
    });

    return () => {
      timers.forEach(timer => window.clearTimeout(timer));
    };
  }, [notifications, onDismiss]);

  if (notifications.length === 0) return null;

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'success': return 'fa-check-circle';
      case 'error': return 'fa-exclamation-circle';
      case 'warning': return 'fa-exclamation-triangle';
      case 'info': return 'fa-info-circle';
      default: return 'fa-info-circle';
    }
  };

  return (
    <div role="region" aria-label="Notifications" aria-live="polite" aria-relevant="additions text" style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 900,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      maxWidth: '400px',
      fontFamily: '"Montserrat", "Arial", sans-serif'
    }}>
      {notifications.map(notification => {
        const icon = getIcon(notification.type);
        const isError = notification.type === 'error';

        return (
          <div
            key={notification.id}
            // The region announces politely; an error interrupts because it needs a response.
            aria-live={isError ? 'assertive' : undefined}
            aria-atomic="true"
            data-notification-type={notification.type}
            style={{
              backgroundColor: 'var(--color-bg-notification)',
              border: '1px solid var(--color-border-notification)',
              borderRadius: '6px',
              padding: '12px 16px',
              boxShadow: '0 4px 12px var(--color-shadow-elevated)',
              color: 'var(--color-text-secondary)',
              position: 'relative',
              animation: 'slideInRight 0.3s ease-out'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}>
              <i
                aria-hidden="true"
                className={`fas ${icon}`}
                style={{
                  color: 'var(--color-text-secondary)',
                  fontSize: '16px',
                  marginTop: '2px',
                  flexShrink: 0
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontWeight: '600',
                  fontSize: '14px',
                  marginBottom: '4px',
                  color: 'var(--color-text-primary)'
                }}>
                  {(isError || notification.type === 'warning') && <span className="studio-visually-hidden">{isError ? 'Error: ' : 'Warning: '}</span>}
                  {notification.title}
                </div>
                <div style={{
                  fontSize: '13px',
                  lineHeight: '1.4',
                  color: 'var(--color-text-secondary)'
                }}>
                  {notification.message}
                </div>
              </div>
              <button
                type="button"
                aria-label={`Dismiss ${notification.title} notification`}
                title="Dismiss"
                onClick={() => onDismiss(notification.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  fontSize: '16px',
                  padding: '0',
                  // 44px target without growing the card.
                  minWidth: '44px',
                  minHeight: '44px',
                  margin: '-10px -14px -10px 0',
                  opacity: 1,
                  flexShrink: 0
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                }}
              >
                <i aria-hidden="true" className="fas fa-times" />
              </button>
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
