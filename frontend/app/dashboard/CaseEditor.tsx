'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import { getHearingHistory, updateCase } from '@/lib/api';
import type { Case, CaseUpdate, HearingHistoryEntry } from '@/types';
import { FloatingDialog } from '../FloatingDialog';
import styles from './dashboard.module.css';

const hearingDateFormat = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
});

export function formatHearingDate(date: string) {
  return hearingDateFormat.format(new Date(date));
}

export function CaseEditor({ caseItem, trigger, onClose, onSaved }: {
  caseItem: Case;
  trigger: HTMLButtonElement;
  onClose: () => void;
  onSaved: (updated: Case) => void;
}) {
  const formId = useId();
  const [date, setDate] = useState(caseItem.next_hearing_date ?? '');
  const [history, setHistory] = useState<HearingHistoryEntry[] | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dateChanged = (date || null) !== caseItem.next_hearing_date;
  const priorHearing = dateChanged ? caseItem.next_hearing_date : null;

  useEffect(() => {
    let active = true;
    getHearingHistory(caseItem.id).then(entries => {
      if (active) setHistory(entries);
    }).catch(() => {
      if (active) setHistoryError(true);
    });
    return () => { active = false; };
  }, [caseItem.id]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get('case_title')).trim();
    if (!title) {
      setError('Enter a case title.');
      return;
    }
    const changes: CaseUpdate = {};
    if (title !== caseItem.case_title) changes.case_title = title;
    for (const field of ['case_number', 'court_name', 'description'] as const) {
      const value = String(form.get(field) ?? '').trim() || null;
      if (value !== (caseItem[field]?.trim() || null)) changes[field] = value;
    }
    if (dateChanged) {
      changes.next_hearing_date = date || null;
      changes.expected_hearing_date = caseItem.next_hearing_date;
    }
    if (priorHearing) {
      const notes = String(form.get('hearing_notes') ?? '').trim();
      if (notes) changes.hearing_notes = notes;
    }
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    setError('');
    try {
      onSaved(await updateCase(caseItem.id, changes));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes. Try again.');
      setSaving(false);
    }
  }

  return (
    <FloatingDialog title="Edit case" returnFocus={trigger} onDismiss={onClose} busy={saving} error={error}
      footer={
        <>
          <button type="button" disabled={saving} onClick={onClose} className="workspace-control workspace-secondary">Cancel</button>
          <button type="submit" form={formId} disabled={saving} className="workspace-control workspace-primary">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }>
      <form id={formId} onSubmit={save}>
        <fieldset disabled={saving} className={styles.formGrid}>
          <label className={`workspace-label ${styles.full}`}>Case title
            <input name="case_title" defaultValue={caseItem.case_title} maxLength={255} required className="workspace-field" />
          </label>
          <label className="workspace-label">Case number
            <input name="case_number" defaultValue={caseItem.case_number ?? ''} maxLength={100} className="workspace-field" />
          </label>
          <label className="workspace-label">Court
            <input name="court_name" defaultValue={caseItem.court_name ?? ''} maxLength={150} className="workspace-field" />
          </label>
          <div className={styles.full}>
            <label className="workspace-label">Next hearing date
              <input type="date" name="next_hearing_date" value={date} onChange={event => setDate(event.target.value)} className="workspace-field" />
            </label>
            {date && <button type="button" onClick={() => setDate('')} className="workspace-control px-0 underline underline-offset-4">Clear hearing date</button>}
          </div>
          {priorHearing && (
            <label className={`workspace-label ${styles.full}`}>Notes for {formatHearingDate(priorHearing)} (optional)
              <textarea name="hearing_notes" rows={2} maxLength={10000} className="workspace-field" />
            </label>
          )}
          <label className={`workspace-label ${styles.full}`}>Case notes
            <textarea name="description" defaultValue={caseItem.description ?? ''} rows={3} maxLength={10000} className="workspace-field" />
          </label>
        </fieldset>
      </form>
      <section aria-labelledby="hearing-history-heading" className="mt-4 border-t border-[var(--workspace-line)] pt-3">
        <h3 id="hearing-history-heading" className="font-semibold">Hearing history</h3>
        {historyError ? <p role="status" className="mt-1 text-sm text-[var(--workspace-muted)]">Could not load hearing history. Reopen this case to retry.</p>
          : history === null ? <p role="status" className="mt-1 text-sm text-[var(--workspace-muted)]">Loading hearing history…</p>
          : history.length === 0 ? <p className="mt-1 text-sm text-[var(--workspace-muted)]">No hearing date changes recorded yet.</p>
          : <ol className="mt-2 space-y-2">
            {history.map(item => (
              <li key={item.id} className="rounded-lg bg-[var(--workspace-wash)] p-3 text-sm">
                <p className="font-semibold">{formatHearingDate(item.hearing_date)}</p>
                <p className="text-[var(--workspace-muted)]">{item.next_hearing_date ? 'Rescheduled to ' + formatHearingDate(item.next_hearing_date) : 'Hearing date cleared'}</p>
                {item.notes && <p className="mt-1 whitespace-pre-wrap wrap-anywhere">{item.notes}</p>}
              </li>
            ))}
          </ol>}
      </section>
    </FloatingDialog>
  );
}
