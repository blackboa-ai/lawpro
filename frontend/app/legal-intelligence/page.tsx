'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
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
const chipStyle = 'min-h-11 min-w-0 max-w-full rounded-full border px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 disabled:opacity-50';

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
  const previous = result?.state.status === 'ready' ? result.state.data : null;
  return { state, previous, retry: () => setAttempt(value => value + 1) };
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

function SourceLink({ item, compact = false }: { item: LegalItem; compact?: boolean }) {
  const url = originalSourceUrl(item.url);
  if (!url) return null;
  return (
    <a className={compact ? 'relative z-10 inline-flex min-h-11 items-center rounded text-sm font-semibold text-slate-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2' : secondary}
      href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open original source for ${item.title} (opens in a new tab)`}>
      {compact ? 'Original source' : 'Open original source'} <span aria-hidden="true" className="ml-1">↗</span>
    </a>
  );
}

function ItemMetadata({ item }: { item: LegalItem }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs leading-relaxed text-slate-600 sm:text-sm">
      {item.source && <li className="font-semibold text-slate-800">{Object.hasOwn(sourceNames, item.source) ? sourceNames[item.source] : item.source}</li>}
      {item.court_name && <li>{item.court_name}</li>}
      {item.judgment_date && <li><time dateTime={item.judgment_date}>{item.judgment_date}</time></li>}
      {item.subject_category && <li>{item.subject_category}</li>}
    </ul>
  );
}

function ResultCard({ item, open }: { item: LegalItem; open: () => void }) {
  return (
    <article className="relative space-y-2 rounded-xl border border-slate-200 bg-white px-4 pt-4 pb-1 [overflow-wrap:anywhere] transition-colors hover:border-amber-500 hover:bg-amber-50/40 has-[:active]:bg-amber-50 sm:px-5">
      <h3 className="text-base font-semibold leading-snug text-slate-950 sm:text-lg">{item.title}</h3>
      <ItemMetadata item={item} />
      {item.excerpt && <p className="line-clamp-3 text-sm leading-relaxed text-slate-700">{item.excerpt}</p>}
      <div className="flex flex-wrap items-center justify-between gap-x-4">
        <button type="button" onClick={open} aria-haspopup="dialog" aria-label={`Read details for ${item.title}`}
          className="min-h-11 cursor-pointer text-sm font-semibold text-slate-900 after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-slate-900">
          Read details <span aria-hidden="true" className="ml-1 text-amber-800">→</span>
        </button>
        <SourceLink item={item} compact />
      </div>
    </article>
  );
}

function RequestError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="space-y-3">
      <p role="alert" className="text-sm text-slate-700">{message}</p>
      <button type="button" onClick={retry} className={secondary}>Retry</button>
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
      className="m-auto max-h-[94dvh] w-[calc(100%-1rem)] max-w-3xl overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl backdrop:bg-slate-950/60 sm:max-h-[88dvh] sm:w-[calc(100%-3rem)]">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 sm:px-8">
        <button type="button" onClick={() => dialog.current?.close()} className="min-h-11 cursor-pointer rounded text-sm font-semibold text-slate-800 focus-visible:outline-2">← Back to Results</button>
      </div>
      <div className="mx-auto max-w-[68ch] space-y-4 px-4 py-5 [overflow-wrap:anywhere] sm:px-8 sm:py-8">
        <h2 id="reader-title" className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{detail.title}</h2>
        <ItemMetadata item={detail} />
        <SourceLink item={detail} />
        {state.status === 'loading' && <p role="status">Loading details…</p>}
        {state.status === 'error' && (
          <RequestError message="Details are unavailable. You can still use the original-source link when available." retry={retry} />
        )}
        {state.status === 'ready' && state.data.full_text && (
          <section aria-labelledby="source-text-title" className="border-t border-slate-200 pt-5">
            <h3 id="source-text-title" className="mb-3 text-lg font-semibold">Source text</h3>
            <p className="whitespace-pre-wrap text-base leading-7 text-slate-800">{state.data.full_text}</p>
          </section>
        )}
        {(state.status !== 'ready' || !state.data.full_text) && detail.excerpt && (
          <section aria-labelledby="excerpt-title" className="border-t border-slate-200 pt-5">
            <h3 id="excerpt-title" className="mb-3 text-lg font-semibold">Excerpt</h3>
            <p className="whitespace-pre-wrap text-base leading-7 text-slate-800">{detail.excerpt}</p>
          </section>
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
  const [sort, setSort] = useState('relevance');
  const searchInput = useRef<HTMLInputElement>(null);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const results = useResearchRequest(queryFor(selection.filters, selection.offset), getLegalUpdates);
  const searchResults = Boolean(selection.filters.q.trim());
  const filters = useResearchRequest('filters', getLegalFilters);
  const searching = Boolean(draft.q.trim());
  const options = filters.state.status === 'ready' ? filters.state.data : null;
  const loading = results.state.status === 'loading';
  const page = results.state.status === 'ready' ? results.state.data : loading ? results.previous : null;
  const searchItems = page && sort === 'newest'
    ? [...page.items].sort((a, b) => (b.judgment_date ?? '').localeCompare(a.judgment_date ?? ''))
    : page?.items;
  const visibleItems = searchResults
    ? (loading ? page?.items.slice(0, pageSize) : searchItems?.slice(selection.offset, selection.offset + pageSize))
    : page?.items;
  const hasMore = searchResults
    ? selection.offset + pageSize < (page?.items.length ?? 0)
    : Boolean(page?.has_more);
  const activeFilters = Boolean(draft.court || draft.category || (!searching && (draft.date_from || draft.date_to)));
  const alreadyLoading = loading && queryFor(draft, 0) === queryFor(selection.filters, selection.offset)
    && selection.offset === 0;

  function edit(field: keyof typeof emptyFilters, value: string) {
    setDraft(current => ({ ...current, [field]: value }));
    setFormError('');
  }

  function apply(nextFilters: typeof emptyFilters) {
    if (!nextFilters.q.trim() && nextFilters.date_from && nextFilters.date_to && nextFilters.date_from > nextFilters.date_to) {
      setFormError('The end date must be on or after the start date.');
      return;
    }
    const next = queryFor(nextFilters, 0);
    if (next === queryFor(selection.filters, selection.offset)) {
      if (results.state.status === 'error') results.retry();
      if (selection.offset !== 0) setSelection({ filters: nextFilters, offset: 0 });
      return;
    }
    setSelection({ filters: nextFilters, offset: 0 });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply(draft);
  }

  function selectFilter(field: 'court' | 'category', value: string) {
    edit(field, value);
    apply({ ...selection.filters, [field]: value });
  }

  function clearSearch() {
    const next = { ...draft, q: '' };
    setDraft(next);
    setFormError('');
    apply(next);
    searchInput.current?.focus();
  }

  function changePage(delta: number) {
    resultsHeading.current?.focus();
    setSelection(current => ({ ...current, offset: current.offset + delta }));
  }

  function clearFilters() {
    setDraft({ ...emptyFilters, q: draft.q });
    apply({ ...emptyFilters, q: selection.filters.q });
    setFormError('');
  }

  return (
    <section aria-labelledby="legal-title" className="mx-auto min-w-0 max-w-4xl space-y-4 sm:space-y-5">
      <header>
        <h1 id="legal-title" className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Legal Intelligence</h1>
      </header>

      <form role="search" onSubmit={submit} className="min-w-0 space-y-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-2 lg:z-20">
        <div className="flex min-w-0 gap-2">
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden={true} size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input ref={searchInput} type="search" maxLength={200} value={draft.q} onChange={event => edit('q', event.target.value)}
              className={`${inputStyle} pl-9 text-base [&::-webkit-search-cancel-button]:appearance-none ${draft.q ? 'pr-11' : ''}`}
              placeholder="Statute, topic, or citation" aria-label="Search legal updates" aria-describedby="public-search-note" />
            {draft.q && <button type="button" aria-label="Clear search" onClick={clearSearch}
              className="absolute inset-y-0 right-0 grid min-h-11 w-11 cursor-pointer place-items-center rounded-lg text-slate-600 focus-visible:outline-2">
              <X aria-hidden={true} size={17} />
            </button>}
          </div>
          <button type="submit" disabled={alreadyLoading} className={`${primary} shrink-0 px-3 sm:px-4`}>Search</button>
        </div>
        <p id="public-search-note" className="text-xs leading-relaxed text-slate-600">
          Use public information only. Search terms are sent to the legal aggregator.
        </p>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
            <select aria-label="Court" className={`${chipStyle} w-fit cursor-pointer appearance-none truncate ${draft.court ? 'border-amber-500 bg-amber-50 text-slate-950' : 'border-slate-300 bg-white text-slate-700'}`}
              value={draft.court} disabled={!options} onChange={event => selectFilter('court', event.target.value)}>
              <option value="">All courts</option>
              {options?.courts.map(court => <option key={court.code} value={court.code}>{court.name}</option>)}
            </select>
            <select aria-label="Category" className={`${chipStyle} w-fit cursor-pointer appearance-none truncate ${draft.category ? 'border-amber-500 bg-amber-50 text-slate-950' : 'border-slate-300 bg-white text-slate-700'}`}
              value={draft.category} disabled={!options} onChange={event => selectFilter('category', event.target.value)}>
              <option value="">All categories</option>
              {options?.categories.map(category => <option key={category.name}>{category.name}</option>)}
            </select>
          {activeFilters && <button type="button" onClick={clearFilters} className="min-h-11 cursor-pointer rounded px-2 text-sm font-semibold text-slate-700 underline underline-offset-4 focus-visible:outline-2">Clear filters</button>}
        </div>
          {!searching && (
            <details>
              <summary className={`${chipStyle} flex w-fit cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden ${draft.date_from || draft.date_to ? 'border-amber-500 bg-amber-50' : 'border-slate-300 bg-white text-slate-700'}`}>
                Date range{(draft.date_from || draft.date_to) && ' (set)'}
              </summary>
              <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">
              <label className="min-w-0 space-y-1.5 text-sm font-medium">
                <span>From date</span>
                <input type="date" className={inputStyle} value={draft.date_from} onChange={event => edit('date_from', event.target.value)} />
              </label>
              <label className="min-w-0 space-y-1.5 text-sm font-medium">
                <span>To date</span>
                <input type="date" className={inputStyle} value={draft.date_to} onChange={event => edit('date_to', event.target.value)} />
              </label>
              </div>
              <button type="button" className={`${secondary} mt-2`} onClick={() => apply(draft)}>Apply dates</button>
            </details>
          )}
        {filters.state.status === 'error' && (
          <RequestError message="Court and category filters are temporarily unavailable." retry={filters.retry} />
        )}
        {formError && <p role="alert" className="text-sm text-rose-700">{formError}</p>}
      </form>

      {loading && <p role="status" className="text-sm text-slate-600">Loading legal updates…</p>}
      <section aria-labelledby="updates-title" aria-busy={loading} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h2 id="updates-title" ref={resultsHeading} tabIndex={-1} className="scroll-mt-36 text-lg font-semibold tracking-tight">Legal Updates</h2>
          {searchResults && page && <select aria-label="Sort loaded search results" className={`${chipStyle} border-slate-300 bg-white text-slate-700`}
            value={sort} disabled={loading} onChange={event => { setSort(event.target.value); setSelection(current => ({ ...current, offset: 0 })); }}>
            <option value="relevance">Relevance</option>
            <option value="newest">Newest in loaded results</option>
          </select>}
        </div>
        {loading && !page && (
          <div aria-hidden="true" className="space-y-3">
            {[0, 1, 2].map(index => (
              <div key={index} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 motion-safe:animate-pulse">
                <div className="h-5 w-3/4 rounded bg-slate-200" />
                <div className="h-3 w-1/2 rounded bg-slate-100" />
                <div className="h-3 w-full rounded bg-slate-100" />
              </div>
            ))}
          </div>
        )}
        {results.state.status === 'error' && (
          <RequestError message="Legal updates couldn’t load. The source may be warming up. Try again shortly." retry={results.retry} />
        )}
        {visibleItems && (
          <>
            {visibleItems.length === 0 && !loading ? (
              <p role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-slate-700">
                No legal updates found. Try a different search term or clear the filters.
              </p>
            ) : (
              <ul className="space-y-3">
                {visibleItems.map(item => (
                  <li key={item.id}>
                    <ResultCard item={item} open={() => setReader(item)} />
                  </li>
                ))}
              </ul>
            )}
            {(selection.offset > 0 || hasMore) && (
              <nav aria-label="Results pagination" className="flex flex-wrap items-center gap-2">
                <button type="button" className={secondary} disabled={loading || selection.offset === 0}
                  onClick={() => changePage(-pageSize)}>Previous</button>
                <span role="status" className="px-1 text-sm text-slate-700">Page {selection.offset / pageSize + 1}</span>
                <button type="button" className={secondary} disabled={loading || !hasMore}
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
