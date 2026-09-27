import { useRef, type ReactNode } from 'react';
import { useOwnedDialog } from '../../hooks/useOwnedDialog';

interface AccessibleDialogProps {
  labelledBy: string;
  onClose: () => void;
  returnFocus?: HTMLElement | null;
  children: ReactNode;
  className?: string;
}

export function AccessibleDialog({ labelledBy, onClose, returnFocus, children, className = 'studio-dialog' }: AccessibleDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useOwnedDialog({active:true,dialogRef,onClose,returnFocus});

  return <div className="studio-dialog-backdrop" onMouseDown={event => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <div ref={dialogRef} className={className} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}>
      {children}
    </div>
  </div>;
}
