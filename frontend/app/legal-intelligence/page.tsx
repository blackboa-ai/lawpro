'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, ExternalLink, Info, Search, SlidersHorizontal, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  getLegalDetail, getLegalFilters, getLegalUpdates, originalSourceUrl,
} from '@/lib/legalIntelligence';
import type { LegalItem } from '@/lib/legalIntelligence';
import { formatLegalText } from '@/lib/legalText';
import { FloatingDialog } from '../FloatingDialog';
import styles from './legal-intelligence.module.css';

const sourceNames: Record<string, string> = {
  sci: 'Supreme Court of India',
  indiankanoon: 'Indian Kanoon',
  livelaw: 'LiveLaw',
  barandbench: 'Bar & Bench',
};
const pageSize = 10;
const searchWindow = 25;
const emptyFilters = { q: '', court: '', category: '', date_from: '', date_to: '' };
const inputStyle = 'block min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-950';
const buttonStyle = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-center text-sm font-semibold disabled:opacity-50';
const primary = `${buttonStyle} ${styles.primary}`;
const secondary = `${buttonStyle} border border-slate-300 bg-white text-slate-800 hover:bg-slate-100`;

type ReaderEntry = { item: LegalItem; trigger: HTMLButtonElement; keyboard: boolean };

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
    <a className={compact ? styles.cardSource : primary}
      href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open original source for ${item.title} (opens in a new tab)`}>
      {compact ? 'Original Source' : 'Open Original Source'} <ExternalLink aria-hidden={true} size={14} />
    </a>
  );
}

function ItemMetadata({ item }: { item: LegalItem }) {
  if (!item.source && !item.court_name && !item.judgment_date && !item.subject_category) return null;
  return (
    <ul role="list" className={styles.metadata} aria-label="Document metadata">
      {item.source && <li className={styles.publisher}>{Object.hasOwn(sourceNames, item.source) ? sourceNames[item.source] : item.source}</li>}
      {item.court_name && <li>{item.court_name}</li>}
      {item.judgment_date && <li><time dateTime={item.judgment_date}>{item.judgment_date}</time></li>}
      {item.subject_category && <li>{item.subject_category}</li>}
    </ul>
  );
}

function ResultCard({ item, open }: { item: LegalItem; open: (entry: ReaderEntry) => void }) {
  return (
    <article className={styles.card}>
      <h3 className="text-base font-semibold leading-snug tracking-tight text-slate-950 sm:text-lg">{item.title}</h3>
      <ItemMetadata item={item} />
      {item.excerpt && <p className="line-clamp-3 text-sm leading-relaxed text-slate-700">{item.excerpt}</p>}
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <button type="button" onClick={event => open({ item, trigger: event.currentTarget, keyboard: event.detail === 0 })}
          aria-haspopup="dialog" aria-label={`Read details for ${item.title}`} className={styles.cardAction}>
          Read Details <ArrowRight aria-hidden={true} size={15} />
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

function SourceText({ title, text }: { title: string; text: string }) {
  const blocks = formatLegalText(text);
  return (
    <section aria-labelledby="reader-text-title" className={styles.sourceText}>
      <h3 id="reader-text-title" className="text-lg font-semibold tracking-tight text-slate-950">{title}</h3>
      {blocks.map((block, index) => (
        <p key={index} data-kind={block.kind}>{block.text}</p>
      ))}
    </section>
  );
}

function ResultReader({ entry, onClose }: { entry: ReaderEntry; onClose: () => void }) {
  const { item, trigger, keyboard } = entry;
  const { state, retry } = useResearchRequest(item.id, getLegalDetail);
  const detail = state.status === 'ready' ? state.data : item;
  const fullText = state.status === 'ready' ? state.data.full_text : null;

  return (
    <FloatingDialog size="wide" labelledBy="reader-title" returnFocus={trigger}
      onDismiss={onClose} bodyLabel="Document content" bodyClassName={styles.readerScroll}
      header={
        <div className={styles.readerToolbar}>
          <button type="button" data-dialog-focus={keyboard ? '' : undefined} onClick={onClose} className={styles.back}>
            <ArrowLeft aria-hidden={true} size={17} /> Back to Results
          </button>
        </div>
      }>
        <div className={styles.readerContent}>
          <h2 id="reader-title" tabIndex={-1} data-dialog-focus={!keyboard ? '' : undefined}
            data-pointer-focus={!keyboard} className={styles.readerTitle}>{detail.title}</h2>
          <ItemMetadata item={detail} />
          <SourceLink item={detail} />
          {state.status === 'loading' && <p role="status" className="text-sm text-slate-600">Loading details…</p>}
          {state.status === 'error' && (
            <RequestError message="Details are unavailable. You can still use the original-source link when available." retry={retry} />
          )}
          {fullText ? <SourceText title="Source text" text={fullText} /> : detail.excerpt && <SourceText title="Excerpt" text={detail.excerpt} />}
          {state.status === 'ready' && !fullText && !detail.excerpt && (
            <p className="text-sm text-slate-600">The source has no additional text for this update.</p>
          )}
        </div>
    </FloatingDialog>
  );
}

function FilterChip({ label, value, placeholder, options, onChange }: {
  label: string;
  value: string;
  placeholder: string;
  options: { value: string; label: string }[] | undefined;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}) {
  const selectedLabel = options?.find(option => option.value === value)?.label ?? value;
  return (
    <label className={`${styles.chip} ${styles.selectChip}`} data-selected={Boolean(value)}>
      <span aria-hidden="true" className="truncate">{selectedLabel || placeholder}</span>
      <select aria-label={label} value={value} disabled={!options} onChange={onChange}>
        <option value="">{placeholder}</option>
        {options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function LegalHub() {
  const [draft, setDraft] = useState(emptyFilters);
  const [selection, setSelection] = useState({ filters: emptyFilters, offset: 0 });
  const [reader, setReader] = useState<ReaderEntry | null>(null);
  const [formError, setFormError] = useState('');
  const [sort, setSort] = useState('relevance');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const results = useResearchRequest(queryFor(selection.filters, selection.offset), getLegalUpdates);
  const searchResults = Boolean(selection.filters.q.trim());
  const filters = useResearchRequest('filters', getLegalFilters);
  const searching = Boolean(draft.q.trim());
  const options = filters.state.status === 'ready' ? filters.state.data : null;
  const internationalNews = options?.courts.find(court => /international.*news/i.test(court.name));
  const standardCourts = options?.courts.filter(court => court.code !== internationalNews?.code);
  const showingInternationalNews = Boolean(internationalNews && selection.filters.court === internationalNews.code);
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
  const hasDates = Boolean(draft.date_from || draft.date_to);
  const activeFilters = Boolean(draft.court || draft.category || hasDates);
  const alreadyLoading = loading && queryFor(draft, 0) === queryFor(selection.filters, selection.offset)
    && selection.offset === 0;

  function edit(field: keyof typeof emptyFilters, value: string) {
    setDraft(current => ({ ...current, [field]: value }));
    setFormError('');
  }

  function apply(nextFilters: typeof emptyFilters) {
    if (!nextFilters.q.trim() && nextFilters.date_from && nextFilters.date_to && nextFilters.date_from > nextFilters.date_to) {
      setFilterPanelOpen(true);
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
    apply({ ...draft, [field]: value });
  }

  function clearSearch() {
    const next = { ...draft, q: '' };
    setDraft(next);
    setFormError('');
    apply(next);
    searchInput.current?.focus({ preventScroll: true });
  }

  function changePage(delta: number) {
    resultsHeading.current?.focus();
    setSelection(current => ({ ...current, offset: current.offset + delta }));
  }

  function clearFilters() {
    setDraft({ ...emptyFilters, q: draft.q });
    apply({ ...emptyFilters, q: draft.q });
    setFormError('');
  }

  return (
    <section aria-labelledby="legal-title" className={styles.hub}>
      <div className={styles.hero}>
        <header className={styles.heroHeader}>
          <h1 id="legal-title">Legal Intelligence</h1>
          <details className={styles.privacy}>
            <summary aria-label="Search privacy information" title="Search privacy information">
              <Info aria-hidden={true} size={18} />
            </summary>
            <p id="public-search-note">Use public information only. Search terms are sent to the legal aggregator.</p>
          </details>
          <p className={styles.subtitle}>Search judgments, statutes, and legal updates from Indian courts and publishers.</p>
        </header>

        <form role="search" onSubmit={submit} className={styles.searchForm}>
          <div className={styles.searchBar}>
            <Search aria-hidden={true} size={18} className={styles.searchLeadingIcon} />
            <input ref={searchInput} type="search" enterKeyHint="search" maxLength={200} value={draft.q}
              onChange={event => edit('q', event.target.value)} placeholder="Statute, topic, or citation"
              aria-label="Search legal updates" aria-describedby="public-search-note" />
            {draft.q && <button type="button" aria-label="Clear search" onClick={clearSearch} className={styles.clearSearch}>
              <X aria-hidden={true} size={17} />
            </button>}
            <button type="submit" aria-label="Search" disabled={alreadyLoading} className={`${styles.submit} ${styles.primary}`}>
              <Search aria-hidden={true} size={18} /> <span>Search</span>
            </button>
          </div>

          <div className={styles.chipRow} role="group" aria-label="Research filters; swipe horizontally on mobile to see more" tabIndex={0}>
            <button type="button" className={styles.chip} data-selected={filterPanelOpen || (hasDates && !searching)}
              aria-expanded={filterPanelOpen} aria-controls="legal-filter-panel" onClick={() => setFilterPanelOpen(open => !open)}>
              <SlidersHorizontal aria-hidden={true} size={15} /> Filters
            </button>
            <FilterChip label="Court" placeholder="All courts" value={draft.court === internationalNews?.code ? '' : draft.court}
              options={standardCourts?.map(court => ({ value: court.code, label: court.name }))}
              onChange={event => selectFilter('court', event.target.value)} />
            <FilterChip label="Category" placeholder="All categories" value={draft.category}
              options={options?.categories.map(category => ({ value: category.name, label: category.name }))}
              onChange={event => selectFilter('category', event.target.value)} />
            {internationalNews && <button type="button" aria-label="International News"
              aria-pressed={draft.court === internationalNews.code}
              data-selected={draft.court === internationalNews.code}
              className={`${styles.chip} ${styles.newsChip}`}
              onClick={() => selectFilter('court', draft.court === internationalNews.code ? '' : internationalNews.code)}>
              International News
            </button>}
            {activeFilters && <button type="button" onClick={clearFilters} className={styles.clearFilters}>Clear filters</button>}
          </div>

          <div id="legal-filter-panel" className={styles.filterPanel} hidden={!filterPanelOpen}>
            {filterPanelOpen && (
              <fieldset className="min-w-0">
                <legend className="mb-2 text-sm font-semibold text-slate-950">Date range</legend>
                {searching ? <p className="text-sm text-slate-700">Date filters apply when browsing without a search term.</p> : (
                  <div className={styles.dateFields}>
                    <label className="min-w-0 space-y-1 text-sm font-medium">
                      <span>From date</span>
                      <input type="date" className={inputStyle} value={draft.date_from} onChange={event => edit('date_from', event.target.value)} />
                    </label>
                    <label className="min-w-0 space-y-1 text-sm font-medium">
                      <span>To date</span>
                      <input type="date" className={inputStyle} value={draft.date_to} onChange={event => edit('date_to', event.target.value)}
                        aria-invalid={Boolean(formError)} aria-describedby={formError ? 'legal-date-error' : undefined} />
                    </label>
                    <button type="button" className={secondary} onClick={() => apply(draft)}>Apply dates</button>
                  </div>
                )}
                {formError && <p id="legal-date-error" role="alert" className="mt-2 text-sm text-rose-700">{formError}</p>}
              </fieldset>
            )}
          </div>
          {filters.state.status === 'error' && (
            <RequestError message="Court and category filters are temporarily unavailable." retry={filters.retry} />
          )}
        </form>
      </div>

      {loading && <p role="status" className="text-sm text-slate-600">{showingInternationalNews ? 'Loading news…' : 'Loading legal updates…'}</p>}
      <section aria-labelledby="updates-title" aria-busy={loading} className="min-w-0 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h2 id="updates-title" ref={resultsHeading} tabIndex={-1}
            className={showingInternationalNews ? 'sr-only' : 'scroll-mt-4 text-lg font-semibold tracking-tight text-slate-950'}>
            {showingInternationalNews ? 'International news results' : 'Legal Updates'}
          </h2>
          {searchResults && page && <select aria-label="Sort loaded search results" className={styles.sort}
            value={sort} disabled={loading} onChange={event => { setSort(event.target.value); setSelection(current => ({ ...current, offset: 0 })); }}>
            <option value="relevance">Relevance</option>
            <option value="newest">Newest in loaded results</option>
          </select>}
        </div>
        {loading && !page && (
          <div aria-hidden="true" className="space-y-2.5">
            {[0, 1, 2].map(index => (
              <div key={index} className={`${styles.card} motion-safe:animate-pulse`}>
                <div className="h-5 w-3/4 rounded bg-slate-200" />
                <div className="h-3 w-1/2 rounded bg-slate-100" />
                <div className="h-3 w-full rounded bg-slate-100" />
              </div>
            ))}
          </div>
        )}
        {results.state.status === 'error' && (
          <RequestError message={showingInternationalNews
            ? "News couldn’t load. The source may be warming up. Try again shortly."
            : "Legal updates couldn’t load. The source may be warming up. Try again shortly."} retry={results.retry} />
        )}
        {visibleItems && (
          <>
            {visibleItems.length === 0 && !loading ? (
              <p role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-slate-700">
                {showingInternationalNews
                  ? 'No news found. Try a different search term or clear the filters.'
                  : 'No legal updates found. Try a different search term or clear the filters.'}
              </p>
            ) : (
              <ul role="list" className="space-y-2.5">
                {visibleItems.map(item => (
                  <li key={item.id}>
                    <ResultCard item={item} open={setReader} />
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
      {reader && <ResultReader entry={reader} onClose={() => setReader(null)} />}
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
