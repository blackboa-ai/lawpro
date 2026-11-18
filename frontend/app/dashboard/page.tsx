'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  Calendar, CalendarDays, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, Clock, Download,
  Edit, FileText, Gavel, LogOut, Plus, Search, Trash2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getDashboardStats, getCasesPage, createCase, deleteCase, updateCase } from '@/lib/api';
import { casesCsv, downloadFile, hearingCalendar } from '@/lib/caseExports';
import type { Case, CaseStatus, DashboardStats } from '@/types';
import { FloatingDialog } from '../FloatingDialog';
import { CaseEditor, formatHearingDate } from './CaseEditor';
import { CaseNotes } from './CaseNotes';
import { ConfirmationDialog } from './ConfirmationDialog';
import styles from './dashboard.module.css';

const hearingRanges = [
  { label: 'Today', days: 1 },
  { label: 'Next 7 days', days: 7 },
  { label: 'All upcoming', days: 0 },
] as const;

const statuses = [
  { value: 'pending', label: 'Pending' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'dismissed', label: 'Dismissed' },
] as const;

const metrics = [
  { label: 'Total cases', key: 'total_cases', icon: FileText, tone: 'total' },
  { label: 'Pending', key: 'pending_cases', icon: Clock, tone: 'pending' },
  { label: 'Ongoing', key: 'ongoing_cases', icon: Gavel, tone: 'ongoing' },
  { label: 'Completed', key: 'completed_cases', icon: CheckCircle, tone: 'completed' },
] as const;

type CaseDialog =
  | { kind: 'create'; trigger: HTMLButtonElement }
  | { kind: 'edit' | 'calendar' | 'delete'; trigger: HTMLButtonElement; item: Case };

const pageSize = 25;

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const requestId = useRef(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [hearingRange, setHearingRange] = useState(0);
  const [modal, setModal] = useState<CaseDialog | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const casesHeading = useRef<HTMLHeadingElement>(null);

  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const rangeEnd = new Date(today + 'T00:00:00Z');
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + hearingRange);
  const endDate = rangeEnd.toISOString().slice(0, 10);
  const hasFilters = upcomingOnly || Boolean(search.trim()) || statusFilter !== 'all';
  const pageCount = Math.ceil(total / pageSize);

  const caseParams = (offset = 0, query = debouncedSearch) => {
    const params = new URLSearchParams({ offset: String(offset), limit: String(pageSize) });
    if (query.trim()) params.set('search', query.trim());
    if (statusFilter !== 'all') params.set('case_status', statusFilter);
    if (upcomingOnly) {
      params.set('upcoming_from', today);
      if (hearingRange) params.set('upcoming_before', endDate);
    }
    return params;
  };

  const exportCases = async () => {
    try {
      const all: Case[] = [];
      let count = 0;
      do {
        const result = await getCasesPage(caseParams(all.length, search));
        count = result.total;
        all.push(...result.cases);
        if (!result.cases.length) break;
      } while (all.length < count);
      downloadFile(casesCsv(all), `lawpro-cases-${today}.csv`, 'text/csv;charset=utf-8');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export cases.');
    }
  };

  const clearFilters = () => {
    setPage(0);
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setUpcomingOnly(false);
    setHearingRange(0);
  };

  useEffect(() => {
    if (search === debouncedSearch) return;
    const timer = setTimeout(() => { setPage(0); setDebouncedSearch(search); }, 250);
    return () => clearTimeout(timer);
  }, [search, debouncedSearch]);

  useEffect(() => {
    fetchData(!stats);
    return () => { requestId.current++; };
  }, [page, debouncedSearch, statusFilter, upcomingOnly, hearingRange]);

  const fetchData = async (refreshStats = false) => {
    const request = ++requestId.current;
    setLoading(true);
    try {
      const [statsData, casesData] = await Promise.all([
        refreshStats ? getDashboardStats(today) : Promise.resolve(null), getCasesPage(caseParams(page * pageSize)),
      ]);
      if (request !== requestId.current) return;
      if (statsData) setStats(statsData);
      if (page > 0 && casesData.cases.length === 0) {
        setPage(Math.max(0, Math.ceil(casesData.total / pageSize) - 1));
        return;
      }
      setError('');
      setCases(casesData.cases);
      setTotal(casesData.total);
    } catch (err) {
      if (request === requestId.current) setError(err instanceof Error ? err.message : 'Could not load cases.');
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  };

  const adjustStats = (before: Case | null, after: Case | null) => {
    setStats(current => {
      if (!current) return current;
      const next = { ...current };
      const apply = (item: Case, delta: number) => {
        next.total_cases += delta;
        if (item.status === 'pending') next.pending_cases += delta;
        if (item.status === 'ongoing') next.ongoing_cases += delta;
        if (item.status === 'completed') next.completed_cases += delta;
        if (item.next_hearing_date && item.next_hearing_date >= today) next.upcoming_hearings += delta;
      };
      if (before) apply(before, -1);
      if (after) apply(after, 1);
      return next;
    });
  };

  const handleCreated = (newCase: Case) => {
    adjustStats(null, newCase);
    setModal(null);
    const filtersChanged = upcomingOnly || statusFilter !== 'all' || page !== 0 || debouncedSearch !== '' || hearingRange !== 0;
    clearFilters();
    if (!filtersChanged) fetchData(true);
  };

  const handleDeleteCase = async (item: Case) => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteCase(item.id);
      adjustStats(item, null);
      setCases(current => current.filter(caseItem => caseItem.id !== item.id));
      setModal(null);
      fetchData(true);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete the case. Try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusChange = async (item: Case, status: CaseStatus) => {
    try {
      const updated = await updateCase(item.id, { status });
      adjustStats(item, updated);
      setCases(current => current.map(caseItem => caseItem.id === item.id ? updated : caseItem));
      fetchData(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the case status.');
    }
  };

  const handleNotesSaved = (id: number, description: Case['description']) => {
    setCases(current => current.map(item => item.id === id ? { ...item, description } : item));
    fetchData();
  };

  const changePage = (nextPage: number) => {
    setPage(nextPage);
    casesHeading.current?.focus({ preventScroll: true });
    casesHeading.current?.scrollIntoView({ block: 'start' });
  };

  const closeDialog = () => setModal(null);
  const calendarDate = modal?.kind === 'calendar' ? modal.item.next_hearing_date : null;

  return (
    <div className={`${styles.dashboard} workspace-focus`}>
      <section aria-labelledby="dashboard-heading" className={styles.overview}>
        <div className={styles.overviewHeading}>
          <h1 id="dashboard-heading">Dashboard</h1>
          <button type="button" onClick={logout} className="workspace-control workspace-secondary shrink-0">
            <LogOut size={16} aria-hidden={true} /> Logout
          </button>
          {(user?.full_name || user?.email) && <p title={user.full_name || user.email}>Welcome, {user.full_name || user.email}</p>}
        </div>
        <div className={styles.statistics}>
          {metrics.map(({ label, key, icon: Icon, tone }) => (
            <div className={styles.stat} data-tone={tone} key={key}>
              <div className={styles.statIcon} aria-hidden="true"><Icon size={16} /></div>
              <div className="min-w-0">
                <p className={styles.statLabel}>{label}</p>
                <p className={styles.statValue}>{stats?.[key] ?? '–'}</p>
              </div>
            </div>
          ))}
          <button
            type="button"
            aria-pressed={upcomingOnly}
            aria-controls="case-list"
            onClick={() => { setPage(0); setUpcomingOnly(current => !current); }}
            className={`${styles.stat} ${styles.hearings}`}
          >
            <span className={styles.statIcon}><CalendarDays size={16} aria-hidden={true} /></span>
            <span className={styles.hearingCount}>
              <span className={styles.statLabel}>Upcoming hearings</span>
              <span className={styles.statValue}>{stats?.upcoming_hearings ?? '–'}</span>
            </span>
            <ChevronRight size={15} aria-hidden={true} className="hidden sm:block" />
          </button>
        </div>
      </section>

      {error && <p role="alert" className="workspace-error mt-3">{error}</p>}

      <section id="case-list" className={styles.cases} aria-labelledby="cases-heading">
        <div className={styles.caseHeading}>
          <h2 id="cases-heading" tabIndex={-1} ref={casesHeading}>Your cases</h2>
          <div className={styles.caseTools}>
            {cases.length > 0 && (
              <button type="button" onClick={exportCases} className="workspace-control workspace-secondary"
                aria-label={hasFilters ? 'Export filtered CSV' : 'Export CSV'}>
                <Download size={16} aria-hidden={true} />
                <span className="hidden sm:inline">{hasFilters ? 'Export filtered CSV' : 'Export CSV'}</span>
                <span className="sm:hidden">CSV</span>
              </button>
            )}
            <button type="button" aria-haspopup="dialog" className="workspace-control workspace-primary"
              onClick={event => setModal({ kind: 'create', trigger: event.currentTarget })}>
              <Plus size={17} aria-hidden={true} /> New case
            </button>
          </div>
        </div>

        {(stats?.total_cases ?? 0) > 0 && (
          <div className={styles.toolbar}>
            <label className="workspace-label">
              Search cases
              <span className={styles.search}>
                <Search size={17} aria-hidden={true} />
                <input className="workspace-field" type="search" value={search}
                  onChange={event => setSearch(event.target.value)} placeholder="Title, no., court" />
              </span>
            </label>
            <label className="workspace-label">
              Filter by status
              <select className="workspace-field" value={statusFilter}
                onChange={event => { setPage(0); setStatusFilter(event.target.value); }}>
                <option value="all">All statuses</option>
                <StatusOptions />
              </select>
            </label>
          </div>
        )}

        {upcomingOnly && (
          <div role="group" aria-label="Hearing date range" className="mt-2 flex flex-wrap gap-1.5">
            {hearingRanges.map(range => (
              <button type="button" key={range.days} aria-pressed={hearingRange === range.days}
                className={styles.range} onClick={() => { setPage(0); setHearingRange(range.days); }}>
                {range.label}
              </button>
            ))}
          </div>
        )}

        {hasFilters && (
          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3">
            <p role="status" className="text-sm text-[var(--workspace-muted)]">{loading ? 'Updating cases…' : `${total} of ${stats?.total_cases ?? 0} cases`}</p>
            <button type="button" onClick={clearFilters} className="workspace-control underline underline-offset-4">
              Clear filters
            </button>
          </div>
        )}

        <div aria-busy={loading}>
          {cases.length > 0 ? (
            <div className={styles.caseGrid}>
              {cases.map(item => (
                <CaseCard key={item.id} item={item} onOpen={setModal}
                  onNotesSaved={handleNotesSaved} onStatusChange={handleStatusChange}
                  onDeleteRequest={trigger => {
                    setDeleteError('');
                    setModal({ kind: 'delete', item, trigger });
                  }}
                />
              ))}
            </div>
          ) : (
            <div className={styles.empty} role="status">
              {loading ? 'Loading cases…' : hasFilters ? 'No cases match your search and filters.' : error ? (
                <button type="button" onClick={() => fetchData(true)} className="workspace-control workspace-secondary">Retry</button>
              ) : (
                <>
                  <p className="font-semibold">No cases yet</p>
                  <p className="mt-1 text-sm text-[var(--workspace-muted)]">Select New case to add your first case.</p>
                </>
              )}
            </div>
          )}
        </div>

        {pageCount > 1 && (
          <nav aria-label="Case pages" className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <button type="button" disabled={loading || page === 0} onClick={() => changePage(page - 1)}
              className="workspace-control workspace-secondary"><ChevronLeft size={16} aria-hidden={true} /> Previous</button>
            <span role="status" className="text-sm tabular-nums text-[var(--workspace-muted)]">Page {page + 1} of {pageCount}</span>
            <button type="button" disabled={loading || page + 1 >= pageCount} onClick={() => changePage(page + 1)}
              className="workspace-control workspace-secondary">Next <ChevronRight size={16} aria-hidden={true} /></button>
          </nav>
        )}
      </section>

      {modal?.kind === 'create' && <CreateCaseDialog trigger={modal.trigger} onDismiss={closeDialog} onCreated={handleCreated} />}
      {modal?.kind === 'edit' && (
        <CaseEditor caseItem={modal.item} trigger={modal.trigger} onClose={closeDialog} onSaved={updated => {
          adjustStats(modal.item, updated);
          setCases(current => current.map(item => item.id === updated.id ? updated : item));
          closeDialog();
          fetchData(true);
        }} />
      )}
      {modal?.kind === 'delete' && (
        <ConfirmationDialog title="Delete case?" confirmLabel={deleting ? 'Deleting…' : 'Delete case'}
          onConfirm={() => handleDeleteCase(modal.item)} onDismiss={closeDialog} destructive busy={deleting}
          error={deleteError} returnFocus={modal.trigger} fallbackFocusId="cases-heading">
          <p><strong className="text-[var(--workspace-navy)]">{modal.item.case_title}</strong> will be permanently deleted, including its notes and hearing history.</p>
        </ConfirmationDialog>
      )}
      {modal?.kind === 'calendar' && calendarDate && (
        <ConfirmationDialog title="Add hearing to calendar?" confirmLabel="Add to calendar"
          onDismiss={closeDialog} returnFocus={modal.trigger}
          onConfirm={() => {
            downloadFile(
              hearingCalendar({ ...modal.item, next_hearing_date: calendarDate }),
              `lawpro-hearing-${modal.item.id}-${calendarDate}.ics`,
              'text/calendar;charset=utf-8',
            );
            closeDialog();
          }}>
          <p><strong className="text-[var(--workspace-navy)]">{modal.item.case_title}</strong></p>
          <p><time dateTime={calendarDate}>{formatHearingDate(calendarDate)}</time> · All day</p>
          <p>Download the event file to open or import in your calendar app.</p>
        </ConfirmationDialog>
      )}
    </div>
  );
}

function StatusOptions() {
  return statuses.map(({ value, label }) => <option key={value} value={value}>{label}</option>);
}

function CaseCard({ item, onOpen, onNotesSaved, onStatusChange, onDeleteRequest }: {
  item: Case;
  onOpen: (dialog: CaseDialog) => void;
  onNotesSaved: (id: number, description: Case['description']) => void;
  onStatusChange: (item: Case, status: CaseStatus) => Promise<void>;
  onDeleteRequest: (trigger: HTMLButtonElement) => void;
}) {
  const [changingStatus, setChangingStatus] = useState(false);
  const hearing = item.next_hearing_date;

  return (
    <article className={styles.card}>
      <h3>{item.case_title}</h3>
      {(item.court_name || item.case_number) && (
        <div className={styles.meta}>
          {item.court_name && <span>{item.court_name}</span>}
          {item.case_number && <span className={styles.caseNumber}>Case no. {item.case_number}</span>}
        </div>
      )}
      <p className={styles.hearing}>
        <Calendar size={16} aria-hidden={true} className="shrink-0" />
        {hearing ? <>Next hearing <time dateTime={hearing}>{formatHearingDate(hearing)}</time></> : 'No hearing scheduled'}
      </p>
      <CaseNotes caseItem={item} onSaved={onNotesSaved} />
      <div className={styles.actions}>
        <span className={styles.status} data-status={item.status}>
          <select aria-label={`Status for ${item.case_title}`} value={item.status} disabled={changingStatus}
            onChange={async event => {
              const status = event.target.value as CaseStatus;
              setChangingStatus(true);
              try {
                await onStatusChange(item, status);
              } finally {
                setChangingStatus(false);
              }
            }}>
            <StatusOptions />
          </select>
          <ChevronDown size={14} aria-hidden={true} />
        </span>
        <button type="button" className={`workspace-icon-button ${styles.cardAction}`}
          aria-haspopup="dialog" aria-label="Edit case" title="Edit case"
          onClick={event => onOpen({ kind: 'edit', item, trigger: event.currentTarget })}>
          <Edit size={16} aria-hidden={true} /> <span className="hidden min-[375px]:inline">Edit</span>
        </button>
        {hearing && (
          <button type="button" className={`workspace-icon-button ${styles.cardAction}`}
            aria-haspopup="dialog" aria-label="Add to calendar" title="Add to calendar"
            onClick={event => onOpen({ kind: 'calendar', item, trigger: event.currentTarget })}>
            <Calendar size={16} aria-hidden={true} /> <span className="hidden min-[390px]:inline">Calendar</span>
          </button>
        )}
        <button type="button" className={`workspace-icon-button ${styles.delete}`} aria-haspopup="dialog"
          aria-label="Delete case" title="Delete case" onClick={event => onDeleteRequest(event.currentTarget)}>
          <Trash2 size={16} aria-hidden={true} />
        </button>
      </div>
    </article>
  );
}

function CreateCaseDialog({ trigger, onDismiss, onCreated }: {
  trigger: HTMLButtonElement;
  onDismiss: () => void;
  onCreated: (item: Case) => void;
}) {
  const formId = useId();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? '').trim();
    const title = value('case_title');
    if (!title) {
      setError('Enter a case title.');
      return;
    }
    const hearingDate = value('next_hearing_date');
    setSaving(true);
    setError('');
    try {
      onCreated(await createCase({
        case_title: title,
        case_number: value('case_number') || null,
        court_name: value('court_name') || null,
        description: value('description') || null,
        ...(hearingDate && { next_hearing_date: hearingDate }),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the case. Try again.');
      setSaving(false);
    }
  }

  return (
    <FloatingDialog title="Create new case" returnFocus={trigger} busy={saving} onDismiss={onDismiss} error={error}
      footer={
        <>
          <button type="button" className="workspace-control workspace-secondary" disabled={saving} onClick={onDismiss}>Cancel</button>
          <button type="submit" form={formId} className="workspace-control workspace-primary" disabled={saving}>
            {saving ? 'Creating…' : 'Create case'}
          </button>
        </>
      }>
      <form id={formId} onSubmit={save}>
        <fieldset disabled={saving} className={styles.formGrid}>
          <label className={`workspace-label ${styles.full}`}>Case title
            <input name="case_title" maxLength={255} className="workspace-field" required />
          </label>
          <label className="workspace-label"><span>Case number <span className="font-normal text-slate-600">(optional)</span></span>
            <input name="case_number" maxLength={100} className="workspace-field" />
          </label>
          <label className="workspace-label"><span>Court <span className="font-normal text-slate-600">(optional)</span></span>
            <input name="court_name" maxLength={150} className="workspace-field" />
          </label>
          <label className={`workspace-label ${styles.full}`}><span>Next hearing date <span className="font-normal text-slate-600">(optional)</span></span>
            <input type="date" name="next_hearing_date" className="workspace-field" />
          </label>
          <label className={`workspace-label ${styles.full}`}><span>Case notes <span className="font-normal text-slate-600">(optional)</span></span>
            <textarea name="description" rows={3} maxLength={10000} className="workspace-field" />
          </label>
        </fieldset>
      </form>
    </FloatingDialog>
  );
}
