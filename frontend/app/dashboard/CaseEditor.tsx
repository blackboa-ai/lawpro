'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getHearingHistory, updateCase } from '@/lib/api';
import type { Case, CaseUpdate, HearingHistoryEntry } from '@/types';

const fieldClass = 'mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-base';
const formatDate = (date: string) => new Intl.DateTimeFormat('en-IN', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
}).format(new Date(date));

export function CaseEditor({ caseItem, onClose, onSaved }: {
  caseItem: Case;
  onClose: () => void;
  onSaved: (updated: Case) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [date, setDate] = useState(caseItem.next_hearing_date ?? '');
  const [history, setHistory] = useState<HearingHistoryEntry[] | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dateChanged = (date || null) !== caseItem.next_hearing_date;
  const canRecordHearing = dateChanged && Boolean(caseItem.next_hearing_date);

  useEffect(() => {
    const current = dialog.current;
    current?.showModal();
    return () => current?.close();
  }, []);

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
    if (canRecordHearing) {
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
    <dialog
      ref={dialog}
      aria-labelledby="edit-case-heading"
      onCancel={event => {
        event.preventDefault();
        if (!saving) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 text-slate-900 shadow-xl backdrop:bg-slate-950/45 backdrop:backdrop-blur-sm sm:p-6"
    >
      <h2 id="edit-case-heading" className="mb-4 text-xl font-semibold">Edit case</h2>
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <form onSubmit={save}>
        <fieldset disabled={saving} className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium sm:col-span-2">Case title
            <input name="case_title" defaultValue={caseItem.case_title} maxLength={255} required className={fieldClass} />
          </label>
          <label className="text-sm font-medium">Case number
            <input name="case_number" defaultValue={caseItem.case_number ?? ''} maxLength={100} className={fieldClass} />
          </label>
          <label className="text-sm font-medium">Court
            <input name="court_name" defaultValue={caseItem.court_name ?? ''} maxLength={150} className={fieldClass} />
          </label>
          <label className="text-sm font-medium sm:col-span-2">Next hearing date
            <input type="date" name="next_hearing_date" value={date} onChange={event => setDate(event.target.value)} className={fieldClass} />
          </label>
          {date && <button type="button" onClick={() => setDate('')} className="min-h-11 justify-self-start text-sm text-violet-800 underline sm:col-span-2">Clear hearing date</button>}
          {canRecordHearing && (
            <label className="text-sm font-medium sm:col-span-2">Notes for {formatDate(caseItem.next_hearing_date!)} (optional)
              <textarea name="hearing_notes" rows={2} maxLength={10000} className={fieldClass} />
            </label>
          )}
          <label className="text-sm font-medium sm:col-span-2">Case notes
            <textarea name="description" defaultValue={caseItem.description ?? ''} rows={3} maxLength={10000} className={fieldClass} />
          </label>
        </fieldset>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <button type="button" disabled={saving} onClick={onClose} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium">Cancel</button>
          <button type="submit" disabled={saving} className="min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
      <section aria-labelledby="hearing-history-heading" className="mt-6 border-t border-slate-200 pt-4">
        <h3 id="hearing-history-heading" className="font-semibold">Hearing history</h3>
        {historyError ? <p role="status" className="mt-2 text-sm text-slate-600">Could not load hearing history. Reopen this case to retry.</p>
          : history === null ? <p role="status" className="mt-2 text-sm text-slate-600">Loading hearing history…</p>
          : history.length === 0 ? <p className="mt-2 text-sm text-slate-600">No hearing date changes recorded yet.</p>
          : <ol className="mt-3 space-y-2">
            {history.map(item => (
              <li key={item.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-medium">{formatDate(item.hearing_date)}</p>
                <p className="text-slate-600">{item.next_hearing_date ? 'Rescheduled to ' + formatDate(item.next_hearing_date) : 'Hearing date cleared'}</p>
                {item.notes && <p className="mt-1 whitespace-pre-wrap wrap-anywhere">{item.notes}</p>}
              </li>
            ))}
          </ol>}
      </section>
    </dialog>
  );
}
