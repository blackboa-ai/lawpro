'use client';

import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronRight, FileText } from 'lucide-react';
import type { Case } from '@/types';
import styles from './CaseNotes.module.css';

export function CaseNotes({ caseItem, onEdit }: {
  caseItem: Case;
  onEdit: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const notesRegion = useRef<HTMLDivElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const labelId = useId();
  const titleId = useId();
  const notes = caseItem.description;
  const hasNotes = Boolean(notes?.trim());

  useLayoutEffect(() => {
    const modal = dialog.current;
    const preview = trigger.current;
    if (!isOpen || !modal) return;

    // Fix the body in place so touch scrolling stays inside the dialog on iOS.
    const root = document.documentElement;
    const { scrollX, scrollY } = window;
    root.style.setProperty('--case-notes-scroll-top', `${-scrollY}px`);
    root.style.setProperty('--case-notes-scrollbar-width', `${window.innerWidth - root.clientWidth}px`);
    root.classList.add(styles.scrollLock);
    modal.showModal();

    return () => {
      modal.close();
      root.classList.remove(styles.scrollLock);
      root.style.removeProperty('--case-notes-scroll-top');
      root.style.removeProperty('--case-notes-scrollbar-width');
      window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' });
      preview?.focus({ preventScroll: true });
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-label={`${hasNotes ? 'Case Notes' : 'Add notes'} for ${caseItem.case_title}`}
        onClick={() => setIsOpen(true)}
        className={`${styles.focus} mt-3 flex min-h-11 w-full items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left hover:border-amber-400 hover:bg-amber-50/50`}
      >
        <FileText size={16} aria-hidden={true} className="shrink-0 self-start mt-0.5 text-amber-800" />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-slate-900">Case Notes</span>
          <span className="line-clamp-2 wrap-anywhere text-sm leading-5 text-slate-600">
            {hasNotes ? notes : 'Add notes'}
          </span>
        </span>
        <ChevronRight size={16} aria-hidden={true} className="shrink-0 text-slate-500" />
      </button>
      {isOpen && (
        <dialog
          ref={dialog}
          aria-labelledby={`${labelId} ${titleId}`}
          onCancel={event => {
            event.preventDefault();
            setIsOpen(false);
          }}
          onKeyDown={event => {
            if (event.key !== 'Tab') return;
            const first = notesRegion.current;
            const last = editButton.current;
            const boundary = event.shiftKey ? first : last;
            if (event.target === boundary) {
              event.preventDefault();
              (event.shiftKey ? last : first)?.focus();
            }
          }}
          className={`${styles.dialog} m-auto overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl backdrop:bg-slate-950/45 backdrop:backdrop-blur-sm`}
        >
          <div
            ref={notesRegion}
            role="region"
            aria-label="Notes text"
            tabIndex={0}
            className={`${styles.focus} min-h-0 overflow-y-auto overscroll-contain px-4 py-4 outline-offset-[-3px] sm:px-6 sm:py-5`}
          >
            <p id={labelId} className="text-sm font-semibold text-amber-800">Case Notes</p>
            <h2 id={titleId} className="mt-1 wrap-anywhere text-xl font-semibold">{caseItem.case_title}</h2>
            <p className="mt-4 whitespace-pre-wrap wrap-anywhere text-sm leading-relaxed text-slate-700">
              {hasNotes ? notes : 'No notes yet.'}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className={`${styles.focus} min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50`}
            >
              Close
            </button>
            <button
              ref={editButton}
              type="button"
              onClick={() => {
                setIsOpen(false);
                onEdit();
              }}
              className={`${styles.focus} min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700`}
            >
              Edit Notes
            </button>
          </div>
        </dialog>
      )}
    </>
  );
}
