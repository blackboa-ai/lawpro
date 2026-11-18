import type { ReactNode } from 'react';
import { FloatingDialog } from '../FloatingDialog';

export function ConfirmationDialog({
  title, children, confirmLabel, onConfirm, onDismiss, cancelLabel = 'Cancel',
  destructive = false, busy = false, error, returnFocus, fallbackFocusId,
  borderless, initialKeyboardFocus,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onDismiss: () => void;
  cancelLabel?: string;
  destructive?: boolean;
  borderless?: boolean;
  initialKeyboardFocus?: boolean;
  busy?: boolean;
  error?: string;
  returnFocus?: HTMLElement | null;
  fallbackFocusId?: string;
}) {
  return (
    <FloatingDialog
      title={title}
      size="compact"
      busy={busy}
      borderless={borderless}
      initialKeyboardFocus={initialKeyboardFocus}
      preferInitialControl
      onDismiss={onDismiss}
      returnFocus={returnFocus}
      fallbackFocusId={fallbackFocusId}
      footer={
        <>
          <button type="button" data-dialog-focus="" className="workspace-control workspace-secondary"
            disabled={busy} onClick={onDismiss}>
            {cancelLabel}
          </button>
          <button type="button" className={`workspace-control ${destructive ? 'workspace-danger' : 'workspace-primary'}`}
            disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-2 text-sm leading-relaxed wrap-anywhere text-[var(--workspace-muted)]">{children}</div>
      {error && <p className="workspace-error mt-3" role="alert">{error}</p>}
    </FloatingDialog>
  );
}
