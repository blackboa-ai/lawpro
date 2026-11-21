'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { ChevronRight, FileText } from 'lucide-react';
import { updateCase } from '@/lib/api';
import type { Case } from '@/types';
import { FloatingDialog } from '../FloatingDialog';
import { ConfirmationDialog } from './ConfirmationDialog';
import styles from './dashboard.module.css';
import notesStyles from './CaseNotes.module.css';

export function CaseNotes({ caseItem, onSaved }: {
  caseItem: Case;
  onSaved: (id: number, description: Case['description']) => void;
}) {
  const [entry, setEntry] = useState<'keyboard' | 'pointer' | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [discard, setDiscard] = useState<{ close: boolean; keyboard: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const formId = useId();
  const notes = caseItem.description;
  const hasNotes = Boolean(notes?.trim());
  const notesValue = notes?.replace(/\r\n?/g, '\n') ?? '';
  const isEditing = draft !== null;
  const dirty = isEditing && draft !== notesValue;

  function finishEditing(close: boolean) {
    flushSync(() => {
      setDraft(null);
      setError('');
      if (close) setEntry(null);
    });
    if (!close) editButton.current?.focus({ preventScroll: true });
  }

  function dismiss(close: boolean, keyboard: boolean) {
    if (saving) return;
    if (dirty) {
      setDiscard({ close, keyboard });
    } else {
      finishEditing(close);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft === null || !dirty || saving) return;
    setSaving(true);
    setError('');
    try {
      const updated = await updateCase(caseItem.id, { description: draft.trim() ? draft : null, expected_updated_at: caseItem.updated_at });
      onSaved(updated.id, updated.description);
      finishEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save notes. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-label={`${hasNotes ? 'Case Notes' : 'Add notes'} for ${caseItem.case_title}`}
        onClick={event => setEntry(event.detail === 0 ? 'keyboard' : 'pointer')}
        className={styles.notesPreview}
      >
        <FileText size={16} aria-hidden={true} className="shrink-0" />
        <span className="min-w-0 flex-1">
          {hasNotes ? (
            <>
              <span className="block text-xs font-semibold text-[var(--workspace-navy)]">Case notes</span>
              <span className="line-clamp-2 wrap-anywhere text-sm leading-5">{notes}</span>
            </>
          ) : <span className="text-sm font-medium">Add notes</span>}
        </span>
        <ChevronRight size={16} aria-hidden={true} className="shrink-0" />
      </button>
      {entry && (
        <FloatingDialog title="Case Notes" subtitle={caseItem.case_title}
          borderless initialKeyboardFocus={entry === 'keyboard'}
          returnFocus={trigger.current} onDismiss={keyboard => dismiss(true, keyboard)} busy={saving} error={error}
          bodyLabel={isEditing ? undefined : 'Notes text'} focusBody={!isEditing}
          footer={isEditing ? (
            <>
              <button type="button" onClick={event => dismiss(false, event.detail === 0)} disabled={saving}
                className="workspace-control workspace-secondary">Cancel</button>
              <button type="submit" form={formId} disabled={saving || !dirty} className="workspace-control workspace-primary">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <button type="button" ref={editButton} className="workspace-control workspace-primary"
              onClick={() => {
                // Focus within the tap handler so iOS can open the on-screen keyboard.
                flushSync(() => setDraft(notesValue));
                textarea.current?.focus({ preventScroll: true });
              }}>
              Edit Notes
            </button>
          )}>
          {isEditing ? (
            <form id={formId} onSubmit={save}>
              <label className={`workspace-label ${notesStyles.label}`}>
                <span className={notesStyles.labelText}>Notes</span>
                <span className={notesStyles.draft} data-value={draft}>
                  <textarea
                    ref={textarea}
                    value={draft}
                    onChange={event => setDraft(event.target.value)}
                    maxLength={10000}
                    readOnly={saving}
                  />
                </span>
              </label>
            </form>
          ) : (
            <p className="whitespace-pre-wrap wrap-anywhere text-base leading-relaxed text-[var(--workspace-muted)]">
              {hasNotes ? notes : 'No notes yet.'}
            </p>
          )}
        </FloatingDialog>
      )}
      {discard && (
        <ConfirmationDialog title="Discard unsaved notes?" cancelLabel="Keep editing" confirmLabel="Discard changes"
          borderless initialKeyboardFocus={discard.keyboard} onDismiss={() => {
            flushSync(() => setDiscard(null));
            textarea.current?.focus({ preventScroll: true });
          }} destructive onConfirm={() => {
            flushSync(() => setDiscard(null));
            finishEditing(discard.close);
          }}>
          <p>Your changes to these case notes will be lost.</p>
        </ConfirmationDialog>
      )}
    </>
  );
}
