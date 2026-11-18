'use client';

import { useId, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';

let scrollLocks = 0;
let restorePage: (() => void) | undefined;

function lockPage() {
  if (scrollLocks++ === 0) {
    const root = document.documentElement;
    const body = document.body;
    const { scrollX, scrollY } = window;
    const scrollbar = window.innerWidth - root.clientWidth;
    const padding = getComputedStyle(body).paddingInlineEnd;
    const previousPadding = body.style.paddingInlineEnd;

    // Keeping the body fixed also stops touch scrolling past the dialog on iOS.
    root.style.setProperty('--dialog-scroll-top', `${-scrollY}px`);
    root.classList.add('dialog-open');
    body.style.paddingInlineEnd = `calc(${padding} + ${scrollbar}px)`;

    restorePage = () => {
      root.classList.remove('dialog-open');
      root.style.removeProperty('--dialog-scroll-top');
      body.style.paddingInlineEnd = previousPadding;
      window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' });
    };
  }

  return () => {
    if (--scrollLocks === 0) {
      restorePage?.();
      restorePage = undefined;
    }
  };
}

function keepTabInside(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== 'Tab') return;
  const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
    'a[href], button, input, select, textarea, [tabindex]',
  )).filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length);
  const first = controls[0];
  const last = controls.at(-1);
  const active = document.activeElement;
  if (!first || !last) {
    event.preventDefault();
  } else if ((event.shiftKey && (active === first || !controls.includes(active as HTMLElement))) ||
    (!event.shiftKey && active === last)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
}

type FloatingDialogProps = {
  children: ReactNode;
  footer?: ReactNode;
  error?: string;
  bodyLabel?: string;
  focusBody?: boolean;
  bodyClassName?: string;
  returnFocus?: HTMLElement | null;
  fallbackFocusId?: string;
  onDismiss: () => void;
  busy?: boolean;
  size?: 'compact' | 'standard' | 'wide';
} & (
  | { title: string; subtitle?: string; header?: never; labelledBy?: never; preferInitialControl?: boolean }
  | { header: ReactNode; labelledBy: string; title?: never; subtitle?: never; preferInitialControl?: never }
);

export function FloatingDialog({
  title, subtitle, header, labelledBy, children, footer, error, bodyLabel, focusBody, bodyClassName = '',
  returnFocus, fallbackFocusId, onDismiss, busy = false, size = 'standard', preferInitialControl,
}: FloatingDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const subtitleId = useId();
  const invoker = useRef(returnFocus);
  const fallback = useRef(fallbackFocusId);

  useLayoutEffect(() => {
    const element = dialog.current!;
    const previousFocus = invoker.current ?? document.activeElement as HTMLElement | null;
    const unlock = lockPage();
    const viewport = window.visualViewport;
    const fitViewport = () => {
      if (!viewport) return;
      // Ignore the transient pan reported while the body is fixed at its scroll position.
      const maxTop = Math.max(0, window.innerHeight - viewport.height);
      const maxLeft = Math.max(0, window.innerWidth - viewport.width);
      element.style.setProperty('--dialog-viewport-height', `${viewport.height}px`);
      element.style.setProperty('--dialog-viewport-width', `${viewport.width}px`);
      element.style.setProperty('--dialog-viewport-top', `${Math.max(0, Math.min(viewport.offsetTop, maxTop))}px`);
      element.style.setProperty('--dialog-viewport-left', `${Math.max(0, Math.min(viewport.offsetLeft, maxLeft))}px`);
      element.toggleAttribute('data-short', viewport.height < 220);
    };
    fitViewport();
    viewport?.addEventListener('resize', fitViewport);
    viewport?.addEventListener('scroll', fitViewport);
    window.addEventListener('resize', fitViewport);

    const initialFocus = element.querySelector<HTMLElement>('[data-dialog-focus]');
    initialFocus?.setAttribute('autofocus', '');
    element.showModal();
    initialFocus?.removeAttribute('autofocus');
    if (document.activeElement !== initialFocus) initialFocus?.focus({ preventScroll: true });
    fitViewport();

    return () => {
      viewport?.removeEventListener('resize', fitViewport);
      viewport?.removeEventListener('scroll', fitViewport);
      window.removeEventListener('resize', fitViewport);
      element.close();
      unlock();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      const fallbackId = fallback.current;
      if (fallbackId) {
        // A delete can remove the invoker in the same React commit as the dialog.
        queueMicrotask(() => {
          if (!previousFocus?.isConnected) {
            document.getElementById(fallbackId)?.focus({ preventScroll: true });
          }
        });
      }
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className="floating-dialog"
      data-size={size}
      aria-labelledby={labelledBy ?? titleId}
      aria-describedby={subtitle ? subtitleId : undefined}
      onKeyDown={keepTabInside}
      onCancel={event => {
        event.preventDefault();
        if (!busy) onDismiss();
      }}
    >
      {header ?? (
        <header className="floating-header">
          <div className="min-w-0">
            <h2 id={titleId} tabIndex={-1} data-dialog-focus={!focusBody && !preferInitialControl ? '' : undefined}>
              {title}
            </h2>
            {subtitle && <p id={subtitleId}>{subtitle}</p>}
          </div>
          <button
            type="button"
            aria-label="Close"
            disabled={busy}
            onClick={onDismiss}
            className="workspace-icon-button"
          >
            <X size={20} aria-hidden={true} />
          </button>
        </header>
      )}
      <div
        className={`floating-body ${bodyClassName}`}
        role={bodyLabel ? 'region' : undefined}
        aria-label={bodyLabel}
        tabIndex={bodyLabel ? 0 : undefined}
        data-dialog-focus={focusBody ? '' : undefined}
      >
        {children}
      </div>
      {footer && (
        <footer className="floating-footer">
          {error && <p role="alert" className="workspace-error w-full">{error}</p>}
          {footer}
        </footer>
      )}
    </dialog>
  );
}
