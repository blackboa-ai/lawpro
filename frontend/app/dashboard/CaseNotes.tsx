'use client';

import { useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { ChevronRight, FileText, X } from 'lucide-react';
import { updateCase } from '@/lib/api';
import type { Case } from '@/types';
import styles from './CaseNotes.module.css';

export function CaseNotes({ caseItem, onSaved }: {
  caseItem: Case;
  onSaved: (id: number, description: Case['description']) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const closeAction = useRef<HTMLButtonElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const primaryAction = useRef<HTMLButtonElement>(null);
  const labelId = useId();
  const titleId = useId();
  const fieldId = useId();
  const notes = caseItem.description;
  const hasNotes = Boolean(notes?.trim());
  const notesValue = notes?.replace(/\r\n?/g, '\n') ?? '';
  const isEditing = draft !== null;
  const dirty = isEditing && draft !== notesValue;

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
    closeAction.current?.focus({ preventScroll: true });

    // iOS can pan and shrink the visual viewport while leaving the layout viewport in place.
    const viewport = window.visualViewport;
    const fitViewport = () => {
      if (!viewport || viewport.scale !== 1) return;
      const bottom = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      modal.style.setProperty('--viewport-top', `${viewport.offsetTop}px`);
      modal.style.setProperty('--sheet-bottom', `${bottom}px`);
      modal.style.setProperty('--sheet-height', `${viewport.height * 0.85}px`);

      const scroller = content.current;
      const field = textarea.current;
      if (scroller && field && document.activeElement === field) {
        const fieldTop = field.getBoundingClientRect().top;
        const bounds = scroller.getBoundingClientRect();
        if (fieldTop < bounds.top || fieldTop + 48 > bounds.bottom) {
          scroller.scrollTop += fieldTop - bounds.top;
        }
      }
    };
    fitViewport();
    viewport?.addEventListener('resize', fitViewport);
    viewport?.addEventListener('scroll', fitViewport);

    return () => {
      viewport?.removeEventListener('resize', fitViewport);
      viewport?.removeEventListener('scroll', fitViewport);
      modal.close();
      root.classList.remove(styles.scrollLock);
      root.style.removeProperty('--case-notes-scroll-top');
      root.style.removeProperty('--case-notes-scrollbar-width');
      window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' });
      preview?.focus({ preventScroll: true });
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isEditing) {
      if (content.current) content.current.scrollTop = 0;
      primaryAction.current?.focus({ preventScroll: true });
    }
  }, [isEditing]);

  const startEditing = () => {
    // Mount and focus during the tap so iOS Safari can open the keyboard.
    flushSync(() => setDraft(notesValue));
    if (content.current) content.current.scrollTop = 0;
    textarea.current?.focus();
  };

  const dismiss = (closeDialog: boolean) => {
    if (saving || (dirty && !window.confirm('Discard unsaved notes?'))) return;
    setDraft(null);
    setError('');
    if (closeDialog) setIsOpen(false);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (draft === null || !dirty || saving) return;
    setSaving(true);
    setError('');
    try {
      const updated = await updateCase(caseItem.id, { description: draft.trim() ? draft : null });
      onSaved(updated.id, updated.description);
      setDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save notes. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-label={`${hasNotes ? 'Case Notes' : 'Add notes'} for ${caseItem.case_title}`}
        onClick={() => setIsOpen(true)}
        className={`${styles.focus} mt-2.5 flex min-h-11 w-full items-center gap-2.5 rounded-lg bg-slate-50 px-2.5 py-2 text-left hover:bg-slate-100`}
      >
        <FileText size={16} aria-hidden={true} className="mt-0.5 shrink-0 self-start text-slate-500" />
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
            dismiss(true);
          }}
          onKeyDown={event => {
            if (event.key !== 'Tab') return;
            const first = closeAction.current;
            const last = primaryAction.current;
            const boundary = event.shiftKey ? first : last;
            if (event.target === boundary) {
              event.preventDefault();
              (event.shiftKey ? last : first)?.focus();
            }
          }}
          className={`${styles.dialog} overflow-hidden border-0 bg-white text-slate-900 shadow-xl backdrop:bg-slate-950/45 backdrop:backdrop-blur-sm`}
        >
          <form onSubmit={save} className="flex min-h-0 flex-col">
            <div ref={content} tabIndex={-1} className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4 outline-none sm:px-6">
              <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p id={labelId} className="text-sm font-semibold text-slate-600">Case Notes</p>
                  <h2 id={titleId} className="mt-0.5 wrap-anywhere text-lg leading-snug font-semibold">{caseItem.case_title}</h2>
                </div>
                <button
                  ref={closeAction}
                  type="button"
                  aria-label="Close"
                  aria-disabled={saving}
                  onClick={() => dismiss(true)}
                  className={`${styles.focus} -mt-1 -mr-1 grid size-11 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 aria-disabled:opacity-60`}
                >
                  <X size={20} aria-hidden={true} />
                </button>
              </header>
              {isEditing ? (
                <div className="mt-3">
                  <label htmlFor={fieldId} className="mb-1 block text-sm font-medium">Notes</label>
                  <div className={`${styles.draft} text-base leading-relaxed`} data-value={draft}>
                    <textarea
                      ref={textarea}
                      id={fieldId}
                      value={draft}
                      onChange={event => setDraft(event.target.value)}
                      maxLength={10000}
                      readOnly={saving}
                      className={`${styles.focus} rounded-lg bg-white outline-offset-[-2px]`}
                    />
                  </div>
                </div>
              ) : (
                <div role="region" aria-label="Notes text" tabIndex={0} className={`${styles.focus} mt-3 rounded-sm outline-offset-2`}>
                  <p className="whitespace-pre-wrap wrap-anywhere text-base leading-relaxed text-slate-700">
                    {hasNotes ? notes : 'No notes yet.'}
                  </p>
                </div>
              )}
            </div>
            <div className="shrink-0 border-t border-slate-200 px-4 py-3 sm:px-6">
              {error && <p role="alert" className="mb-2 wrap-anywhere text-sm text-red-700">{error}</p>}
              <div className="flex flex-wrap justify-end gap-2">
                {isEditing && (
                  <button
                    type="button"
                    aria-disabled={saving}
                    onClick={() => dismiss(false)}
                    className={`${styles.focus} min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50 aria-disabled:opacity-60`}
                  >
                    Cancel
                  </button>
                )}
                <button
                  ref={primaryAction}
                  type={isEditing ? 'submit' : 'button'}
                  aria-disabled={isEditing && (saving || !dirty)}
                  onClick={isEditing ? undefined : startEditing}
                  className={`${styles.focus} min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 aria-disabled:opacity-60`}
                >
                  {saving ? 'Saving…' : isEditing ? 'Save' : 'Edit Notes'}
                </button>
              </div>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}
