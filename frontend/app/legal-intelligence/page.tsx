'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  getLegalDetail, getLegalFilters, getLegalUpdates, originalSourceUrl,
} from '@/lib/legalIntelligence';
import type { LegalItem } from '@/lib/legalIntelligence';

const sourceNames: Record<string, string> = {
  sci: 'Supreme Court of India',
  indiankanoon: 'Indian Kanoon',
  livelaw: 'LiveLaw',
  barandbench: 'Bar & Bench',
};
const pageSize = 10;
const searchWindow = 25;
const emptyFilters = { q: '', court: '', category: '', date_from: '', date_to: '' };
const inputStyle = 'min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700';
const buttonStyle = 'inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-center text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 disabled:opacity-45';
const primary = `${buttonStyle} bg-slate-900 text-white hover:bg-slate-700`;
const secondary = `${buttonStyle} border border-slate-300 bg-white text-slate-800 hover:bg-slate-100`;

type RequestState<T> =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: T };

function useResearchRequest<T>(
  key: string,
  load: (key: string, signal: AbortSignal) => Promise<T>,
) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; attempt: number; state: RequestState<T> }>();
  useEffect(() => {
    const controller = new AbortController();
    load(key, controller.signal)
      .then(data => {
        if (!controller.signal.aborted) setResult({ key, attempt, state: { status: 'ready', data } });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key, attempt, state: { status: 'error' } });
      });
    return () => controller.abort();
  }, [key, attempt, load]);

  const state: RequestState<T> =
    result?.key === key && result.attempt === attempt ? result.state : { status: 'loading' };
  return { state, retry: () => setAttempt(value => value + 1) };
}

function queryFor(filters: typeof emptyFilters, offset: number) {
  const q = filters.q.trim();
  const params = new URLSearchParams({
    limit: String(q ? searchWindow : pageSize),
    offset: String(q ? 0 : offset),
  });
  if (filters.court) params.set('court', filters.court);
  if (filters.category) params.set('category', filters.category);
  if (q) {
    params.set('q', q);
  } else {
    if (filters.date_from) params.set('date_from', filters.date_from);
    if (filters.date_to) params.set('date_to', filters.date_to);
  }
  return params.toString();
}

function SourceLink({ item }: { item: LegalItem }) {
  const url = originalSourceUrl(item.url);
  if (!url) return null;
  return (
    <a className={secondary} href={url} target="_blank" rel="noopener noreferrer">
      Open original source <span aria-hidden="true" className="ml-1">↗</span>
    </a>
  );
}

function ItemMetadata({ item }: { item: LegalItem }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
      {item.source && <li className="font-semibold text-slate-800">{Object.hasOwn(sourceNames, item.source) ? sourceNames[item.source] : item.source}</li>}
      {item.court_name && <li>{item.court_name}</li>}
      {item.judgment_date && <li><time dateTime={item.judgment_date}>{item.judgment_date}</time></li>}
      {item.subject_category && <li>{item.subject_category}</li>}
    </ul>
  );
}

function RequestError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="space-y-3">
      <p role="alert" className="text-sm text-slate-700">{message}</p>
      <button type="button" onClick={retry} className={secondary}>Try again</button>
    </div>
  );
}

function ResultReader({ item, onClose }: { item: LegalItem; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { state, retry } = useResearchRequest(item.id, getLegalDetail);
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);
  const detail = state.status === 'ready' ? state.data : item;

  return (
    <dialog ref={dialog} onClose={onClose} aria-labelledby="reader-title"
      className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl backdrop:bg-slate-950/60 sm:p-7">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="reader-title" className="min-w-0 text-xl font-semibold [overflow-wrap:anywhere]">{detail.title}</h2>
        <button type="button" onClick={() => dialog.current?.close()} className={secondary}>Close</button>
      </div>
      <div className="space-y-4 [overflow-wrap:anywhere]">
        <ItemMetadata item={detail} />
        <SourceLink item={detail} />
        {state.status === 'loading' && <p role="status">Loading details…</p>}
        {state.status === 'error' && (
          <RequestError message="Details are unavailable. You can still use the original-source link when available." retry={retry} />
        )}
        {state.status === 'ready' && state.data.full_text && (
          <p className="whitespace-pre-wrap leading-relaxed text-slate-800">{state.data.full_text}</p>
        )}
        {(state.status !== 'ready' || !state.data.full_text) && detail.excerpt && (
          <p className="whitespace-pre-wrap leading-relaxed text-slate-800">{detail.excerpt}</p>
        )}
        {state.status === 'ready' && !state.data.full_text && !detail.excerpt && (
          <p className="text-sm text-slate-600">The source has no additional text for this update.</p>
        )}
      </div>
    </dialog>
  );
}

function LegalHub() {
  const [draft, setDraft] = useState(emptyFilters);
  const [selection, setSelection] = useState({ filters: emptyFilters, offset: 0 });
  const [reader, setReader] = useState<LegalItem | null>(null);
  const [formError, setFormError] = useState('');
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const results = useResearchRequest(queryFor(selection.filters, selection.offset), getLegalUpdates);
  const searchResults = Boolean(selection.filters.q.trim());
  const filters = useResearchRequest('filters', getLegalFilters);
  const searching = Boolean(draft.q.trim());
  const options = filters.state.status === 'ready' ? filters.state.data : null;
  const page = results.state.status === 'ready' ? results.state.data : null;
  const visibleItems = searchResults
    ? page?.items.slice(selection.offset, selection.offset + pageSize)
    : page?.items;
  const hasMore = searchResults
    ? selection.offset + pageSize < (page?.items.length ?? 0)
    : Boolean(page?.has_more);

  function edit(field: keyof typeof emptyFilters, value: string) {
    setDraft(current => ({ ...current, [field]: value }));
    setFormError('');
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!searching && draft.date_from && draft.date_to && draft.date_from > draft.date_to) {
      setFormError('The end date must be on or after the start date.');
      return;
    }
    const next = queryFor(draft, 0);
    if (next === queryFor(selection.filters, selection.offset)) {
      if (results.state.status === 'error') results.retry();
      if (selection.offset !== 0) setSelection({ filters: draft, offset: 0 });
      return;
    }
    setSelection({ filters: draft, offset: 0 });
  }

  function changePage(delta: number) {
    resultsHeading.current?.focus();
    setSelection(current => ({ ...current, offset: current.offset + delta }));
  }

  function reset() {
    setDraft(emptyFilters);
    setSelection({ filters: emptyFilters, offset: 0 });
    setFormError('');
  }

  return (
    <section aria-labelledby="legal-title" className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 id="legal-title" className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Legal Intelligence</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
          Search public legal updates from courts and publishers in India.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <label className="block space-y-1.5 text-sm font-semibold">
          <span>Search legal updates</span>
          <input type="search" maxLength={200} value={draft.q} onChange={event => edit('q', event.target.value)}
            className={inputStyle} placeholder="Enter a statute, topic, or public citation" aria-describedby="public-search-note" />
        </label>
        <p id="public-search-note" className="text-xs leading-relaxed text-slate-600">
          Search terms are sent to the legal aggregator. Use public information only.
        </p>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="min-w-0 space-y-1.5 text-sm font-medium">
            <span>Court</span>
            <select className={inputStyle} value={draft.court} disabled={!options}
              onChange={event => edit('court', event.target.value)}>
              <option value="">All courts</option>
              {options?.courts.map(court => <option key={court.code} value={court.code}>{court.name}</option>)}
            </select>
          </label>
          <label className="min-w-0 space-y-1.5 text-sm font-medium">
            <span>Category</span>
            <select className={inputStyle} value={draft.category} disabled={!options}
              onChange={event => edit('category', event.target.value)}>
              <option value="">All categories</option>
              {options?.categories.map(category => <option key={category.name}>{category.name}</option>)}
            </select>
          </label>
          {!searching && (
            <>
              <label className="min-w-0 space-y-1.5 text-sm font-medium">
                <span>From date</span>
                <input type="date" className={inputStyle} value={draft.date_from} onChange={event => edit('date_from', event.target.value)} />
              </label>
              <label className="min-w-0 space-y-1.5 text-sm font-medium">
                <span>To date</span>
                <input type="date" className={inputStyle} value={draft.date_to} onChange={event => edit('date_to', event.target.value)} />
              </label>
            </>
          )}
        </div>
        {filters.state.status === 'error' && (
          <RequestError message="Court and category filters are temporarily unavailable." retry={filters.retry} />
        )}
        {formError && <p role="alert" className="text-sm text-rose-700">{formError}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={primary}>{searching ? 'Search' : 'Apply filters'}</button>
          <button type="button" className={secondary} onClick={reset}>Reset</button>
        </div>
      </form>

      <section aria-labelledby="updates-title" aria-busy={results.state.status === 'loading'} className="space-y-4">
        <h2 id="updates-title" ref={resultsHeading} tabIndex={-1} className="text-xl font-semibold tracking-tight">Legal Updates</h2>
        {results.state.status === 'loading' && <p role="status" className="text-slate-600">Loading legal updates…</p>}
        {results.state.status === 'error' && (
          <RequestError message="Legal updates couldn’t load. The source may be warming up. Try again shortly." retry={results.retry} />
        )}
        {visibleItems && (
          <>
            {visibleItems.length === 0 ? (
              <p role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-slate-700">
                No legal updates found. Try a different search term or reset the filters.
              </p>
            ) : (
              <ul className="space-y-3">
                {visibleItems.map(item => (
                  <li key={item.id}>
                    <article className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 [overflow-wrap:anywhere] sm:p-5">
                      <h3 className="text-lg font-semibold leading-snug text-slate-950">{item.title}</h3>
                      <ItemMetadata item={item} />
                      {item.excerpt && <p className="text-sm leading-relaxed text-slate-700">{item.excerpt}</p>}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button type="button" className={primary} onClick={() => setReader(item)} aria-label={`Read details for ${item.title}`}>
                          Read details
                        </button>
                        <SourceLink item={item} />
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            )}
            {(selection.offset > 0 || hasMore) && (
              <nav aria-label="Results pagination" className="flex flex-wrap items-center gap-2">
                <button type="button" className={secondary} disabled={selection.offset === 0}
                  onClick={() => changePage(-pageSize)}>Previous</button>
                <span role="status" className="px-1 text-sm text-slate-700">Page {selection.offset / pageSize + 1}</span>
                <button type="button" className={secondary} disabled={!hasMore}
                  onClick={() => changePage(pageSize)}>Next</button>
              </nav>
            )}
          </>
        )}
      </section>
      {reader && <ResultReader item={reader} onClose={() => setReader(null)} />}
    </section>
  );
}

export default function LegalIntelligencePage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, loading, router]);

  if (loading) return <p role="status">Checking your session…</p>;
  return isAuthenticated ? <LegalHub /> : null;
}
