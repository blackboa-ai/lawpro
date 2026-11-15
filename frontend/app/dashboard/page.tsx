'use client';

import { useEffect, useRef, useState } from 'react';
import { getDashboardStats, getCases, createCase, deleteCase, updateCase } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Case, DashboardStats } from '@/types';
import { Calendar, ChevronDown, Edit, LogOut, Plus, Trash2 } from 'lucide-react';
import { CaseEditor } from './CaseEditor';
import { casesCsv, downloadFile, hearingCalendar } from '@/lib/caseExports';

const hearingRanges = [
  { label: 'Today', days: 1 },
  { label: 'Next 7 days', days: 7 },
  { label: 'All upcoming', days: 0 },
] as const;

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [editingCase, setEditingCase] = useState<Case | null>(null);

  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [hearingRange, setHearingRange] = useState<number>(0);

  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const rangeEnd = new Date(today + 'T00:00:00Z');
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + hearingRange);
  const endDate = rangeEnd.toISOString().slice(0, 10);
  const hasUpcomingHearing = (caseItem: Case) =>
    Boolean(caseItem.next_hearing_date && caseItem.next_hearing_date >= today);
  const upcomingCount = cases.filter(hasUpcomingHearing).length;
  const query = search.trim().toLowerCase();
  const visibleCases = cases.filter(caseItem =>
    (!upcomingOnly || (hasUpcomingHearing(caseItem) &&
      (hearingRange === 0 || caseItem.next_hearing_date! < endDate))) &&
    (statusFilter === 'all' || caseItem.status === statusFilter) &&
    [caseItem.case_title, caseItem.case_number, caseItem.court_name].some(
      field => field?.toLowerCase().includes(query)
    )
  );
  const hasFilters = upcomingOnly || query !== '' || statusFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setUpcomingOnly(false);
    setHearingRange(0);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsData, casesData] = await Promise.all([
        getDashboardStats(),
        getCases()
      ]);
      setStats(statsData);
      setCases(casesData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    const form = new FormData(e.currentTarget as HTMLFormElement);
    const value = (name: string) => String(form.get(name) ?? '').trim();
    const title = value('case_title');
    if (!title) {
      setCreateError('Enter a case title.');
      return;
    }
    const hearingDate = value('next_hearing_date');
    setCreating(true);
    setCreateError('');
    
    try {
      const newCase = await createCase({
        case_title: title,
        case_number: value('case_number') || null,
        court_name: value('court_name') || null,
        description: value('description') || null,
        ...(hearingDate && { next_hearing_date: hearingDate }),
      });
      setCases(current => [newCase, ...current]);
      setShowCreateModal(false);
      clearFilters();
      fetchData();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create the case. Try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCase = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this case?')) {
      try {
        await deleteCase(id);
        setCases(cases.filter(c => c.id !== id));
        fetchData();
      } catch (err: any) {
        setError(err.message);
      }
    }
  };

  const handleStatusChange = async (caseId: number, newStatus: 'pending' | 'ongoing' | 'completed' | 'dismissed') => {
    try {
      const updated = await updateCase(caseId, { status: newStatus });
      setCases(cases.map(c => c.id === caseId ? updated : c));
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3 sm:mb-8">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">Dashboard</h1>
          <p className="mt-1 wrap-anywhere text-sm text-slate-600">Welcome, {user?.full_name || user?.email}</p>
        </div>
        <button
          onClick={logout}
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          <LogOut size={16} aria-hidden={true} />
          Logout
        </button>
      </div>

      {error && (
        <div role="alert" className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mb-4">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:mb-8 sm:grid-cols-5 sm:gap-3">
        <StatCard title="Total Cases" value={stats?.total_cases || 0} color="blue" />
        <StatCard title="Pending" value={stats?.pending_cases || 0} color="yellow" />
        <StatCard title="Ongoing" value={stats?.ongoing_cases || 0} color="blue" />
        <StatCard title="Completed" value={stats?.completed_cases || 0} color="green" />
        <button
          type="button"
          aria-pressed={upcomingOnly}
          aria-controls="case-list"
          onClick={() => setUpcomingOnly(current => !current)}
          className="col-span-2 flex min-h-12 items-center justify-between gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-left text-violet-950 hover:bg-violet-100 aria-pressed:border-violet-600 aria-pressed:bg-violet-100 sm:col-span-1 sm:flex-col sm:items-start sm:justify-center sm:p-4"
        >
          <span className="text-sm font-medium">Upcoming hearings</span>
          <span className="text-xl font-semibold tabular-nums">{upcomingCount}</span>
        </button>
      </div>

      {/* Cases List */}
      <div id="case-list" className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 sm:mb-5 sm:gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Your cases</h2>
          <div className="flex flex-wrap items-center gap-2">
          {visibleCases.length > 0 && (
            <button
              type="button"
              onClick={() => downloadFile(casesCsv(visibleCases), `lawpro-cases-${today}.csv`, 'text/csv;charset=utf-8')}
              className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50"
            >
              {hasFilters ? 'Export filtered CSV' : 'Export CSV'}
            </button>
          )}
          <button
            onClick={() => {
              setCreateError('');
              setShowCreateModal(true);
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
          >
            <Plus aria-hidden={true} size={16} /> New case
          </button>
          </div>
        </div>

        {cases.length > 0 && (
          <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-2 sm:mb-5 sm:grid-cols-[minmax(0,1fr)_11rem] sm:gap-3">
            <label className="text-sm font-medium text-slate-700">
              Search cases
              <input
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Case title, number, or court"
                className="mt-1 block w-full rounded-lg border border-slate-300 min-h-11 px-3 py-2.5 text-base"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Filter by status
              <select
                value={statusFilter}
                onChange={event => setStatusFilter(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white min-h-11 px-3 py-2.5 text-base"
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </label>
          </div>
        )}
        {upcomingOnly && (
          <div role="group" aria-label="Hearing date range" className="mb-4 flex flex-wrap gap-2">
            {hearingRanges.map(range => (
              <button
                key={range.days}
                type="button"
                aria-pressed={hearingRange === range.days}
                onClick={() => setHearingRange(range.days)}
                className="min-h-11 rounded-lg border border-violet-200 px-3 text-sm font-medium text-violet-950 aria-pressed:border-violet-600 aria-pressed:bg-violet-100"
              >
                {range.label}
              </button>
            ))}
          </div>
        )}
        {hasFilters && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3">
            <p role="status" className="text-sm text-slate-600">{visibleCases.length} of {cases.length} cases</p>
            <button type="button" onClick={clearFilters} className="min-h-11 text-sm font-medium text-violet-800 underline underline-offset-4">Clear filters</button>
          </div>
        )}
        {cases.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center">
            <p className="font-semibold">No cases yet</p>
            <p className="mt-1 text-sm text-slate-600">Select New case to add your first case.</p>
          </div>
        ) : visibleCases.length === 0 ? (
          <p role="status" className="py-8 text-center text-sm text-slate-600">No cases match your search and filters.</p>
        ) : (
          <div className="space-y-3">
            {visibleCases.map(caseItem => (
              <CaseCard
                key={caseItem.id}
                case={caseItem}
                onEdit={() => setEditingCase(caseItem)}
                onUpdate={handleStatusChange}
                onDelete={handleDeleteCase}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="new-case-heading" className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 shadow-xl sm:p-6">
            <h3 id="new-case-heading" className="mb-4 text-xl font-semibold">Create new case</h3>
            {createError && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{createError}</p>}
            <form onSubmit={handleCreateCase}>
              <div className="mb-4">
                <label htmlFor="new-case-title" className="block text-sm font-medium mb-1">Case title</label>
                <input
                  id="new-case-title"
                  name="case_title"
                  autoFocus
                  type="text"
                  maxLength={255}
                  className="min-h-11 w-full px-3 py-2 text-base border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter case title"
                  disabled={creating}
                  required
                />
              </div>
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium">Case number <span className="font-normal text-slate-500">(optional)</span>
                  <input name="case_number" maxLength={100} disabled={creating} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-base" />
                </label>
                <label className="block text-sm font-medium">Court <span className="font-normal text-slate-500">(optional)</span>
                  <input name="court_name" maxLength={150} disabled={creating} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-base" />
                </label>
              </div>
              <div className="mb-5">
                <label htmlFor="new-case-hearing" className="mb-1 block text-sm font-medium">Next hearing date <span className="font-normal text-slate-500">(optional)</span></label>
                <input
                  id="new-case-hearing"
                  name="next_hearing_date"
                  type="date"
                  disabled={creating}
                  className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
                />
              </div>
              <label className="mb-5 block text-sm font-medium">Case notes <span className="font-normal text-slate-500">(optional)</span>
                <textarea name="description" rows={3} maxLength={10000} disabled={creating} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-base" />
              </label>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="min-h-11 px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="min-h-11 rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {editingCase && (
        <CaseEditor
          caseItem={editingCase}
          onClose={() => setEditingCase(null)}
          onSaved={updated => {
            setCases(current => current.map(item => item.id === updated.id ? updated : item));
            setEditingCase(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function StatCard({ title, value, color }: { title: string; value: number; color: string }) {
  const colors = {
    blue: 'bg-blue-100 text-blue-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    green: 'bg-green-100 text-green-800',
    purple: 'bg-purple-100 text-purple-800',
  };

  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm sm:p-4">
      <span aria-hidden="true" className={`mb-2 block h-1.5 w-5 rounded-full sm:mb-3 sm:h-2 sm:w-6 ${colors[color as keyof typeof colors]}`} />
      <p className="text-xs font-medium text-slate-600 sm:text-sm">{title}</p>
      <p className="mt-1 text-[clamp(1.25rem,4vw,1.875rem)] font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}

function CaseCard({ case: caseItem, onEdit, onUpdate, onDelete }: {
  case: Case;
  onEdit: () => void;
  onUpdate: (id: number, status: 'pending' | 'ongoing' | 'completed' | 'dismissed') => void;
  onDelete: (id: number) => void;
}) {
  const statusColors = {
    pending: 'bg-amber-50 text-amber-900 ring-amber-200',
    ongoing: 'bg-blue-50 text-blue-900 ring-blue-200',
    completed: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
    dismissed: 'bg-slate-100 text-slate-700 ring-slate-200',
  };
  const hearingDate = caseItem.next_hearing_date;
  const calendarDialog = useRef<HTMLDialogElement>(null);
  const formattedHearingDate = hearingDate && new Date(hearingDate).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
  const actionClass = 'inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div>
        <div className="min-w-0 wrap-break-word">
          <h3 className="font-semibold">{caseItem.case_title}</h3>
          {caseItem.case_number && <p className="text-sm text-slate-600">Case no. {caseItem.case_number}</p>}
          {caseItem.court_name && (
            <p className="text-sm text-gray-600">{caseItem.court_name}</p>
          )}
          {hearingDate && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
              <Calendar size={14} aria-hidden={true} className="shrink-0" />
              Next hearing: {formattedHearingDate}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5">
        <div className="relative inline-flex items-center">
          <select
            aria-label={`Status for ${caseItem.case_title}`}
            value={caseItem.status}
            onChange={e => onUpdate(caseItem.id, e.target.value as Case['status'])}
            className={`min-h-11 appearance-none rounded-xl py-2 pl-3 pr-8 text-base font-medium ring-1 ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 sm:text-sm ${statusColors[caseItem.status]}`}
          >
            <option value="pending">Pending</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="dismissed">Dismissed</option>
          </select>
          <ChevronDown size={14} aria-hidden={true} className="pointer-events-none absolute right-2.5 text-slate-600" />
        </div>
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit case"
          className={`${actionClass} text-slate-700 hover:bg-slate-100`}
        >
          <Edit size={16} aria-hidden={true} />
          Edit
        </button>
        {hearingDate && (
          <button
            type="button"
            onClick={() => calendarDialog.current?.showModal()}
            aria-label="Add to calendar"
            className={`${actionClass} bg-violet-50 text-violet-900 hover:bg-violet-100`}
          >
            <Calendar size={16} aria-hidden={true} />
            Calendar
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(caseItem.id)}
          aria-label="Delete case"
          title="Delete case"
          className={`${actionClass} ml-auto min-w-11 justify-center text-slate-500 hover:bg-red-50 hover:text-red-700`}
        >
          <Trash2 size={16} aria-hidden={true} />
        </button>
      </div>
      {hearingDate && (
        <dialog
          ref={calendarDialog}
          aria-labelledby={`calendar-title-${caseItem.id}`}
          aria-describedby={`calendar-details-${caseItem.id}`}
          className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-2xl bg-white p-5 text-slate-900 shadow-xl backdrop:bg-slate-950/45 backdrop:backdrop-blur-sm"
        >
          <div className="mb-3 inline-flex rounded-xl bg-violet-50 p-2.5 text-violet-800">
            <Calendar size={20} aria-hidden={true} />
          </div>
          <h4 id={`calendar-title-${caseItem.id}`} className="text-lg font-semibold">Add hearing to calendar?</h4>
          <p id={`calendar-details-${caseItem.id}`} className="mt-2 text-sm leading-relaxed text-slate-600">
            <strong className="wrap-anywhere text-slate-900">{caseItem.case_title}</strong>
            <br />
            {formattedHearingDate} · All day
          </p>
          <p className="mt-3 text-sm text-slate-600">Download the event file to open or import in your calendar app.</p>
          <form method="dialog" className="mt-5 grid grid-cols-2 gap-2">
            <button autoFocus className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-medium hover:bg-slate-50">Cancel</button>
            <button
              type="button"
              onClick={() => {
                downloadFile(
                  hearingCalendar({ ...caseItem, next_hearing_date: hearingDate }),
                  `lawpro-hearing-${caseItem.id}-${hearingDate}.ics`,
                  'text/calendar;charset=utf-8',
                );
                calendarDialog.current?.close();
              }}
              className="min-h-11 rounded-xl bg-violet-700 px-3 text-sm font-semibold text-white hover:bg-violet-800"
            >
              Add to calendar
            </button>
          </form>
        </dialog>
      )}
    </div>
  );
}
