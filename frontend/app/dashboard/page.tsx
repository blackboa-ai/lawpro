'use client';

import { useEffect, useState } from 'react';
import { getDashboardStats, getCases, createCase, deleteCase, updateCase } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Case, DashboardStats } from '@/types';
import { LogOut, Plus } from 'lucide-react';

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
  const [newCaseTitle, setNewCaseTitle] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [hearingDate, setHearingDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

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
    if (!newCaseTitle.trim() || creating) return;
    setCreating(true);
    setCreateError('');
    
    try {
      const newCase = await createCase({
        case_title: newCaseTitle.trim(),
        ...(hearingDate && { next_hearing_date: hearingDate }),
      });
      setCases(current => [newCase, ...current]);
      setShowCreateModal(false);
      setNewCaseTitle('');
      setHearingDate('');
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
                  autoFocus
                  type="text"
                  value={newCaseTitle}
                  onChange={(e) => setNewCaseTitle(e.target.value)}
                  className="min-h-11 w-full px-3 py-2 text-base border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter case title"
                  disabled={creating}
                  required
                />
              </div>
              <div className="mb-5">
                <label htmlFor="new-case-hearing" className="mb-1 block text-sm font-medium">Next hearing date <span className="font-normal text-slate-500">(optional)</span></label>
                <input
                  id="new-case-hearing"
                  type="date"
                  value={hearingDate}
                  onChange={event => setHearingDate(event.target.value)}
                  disabled={creating}
                  className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
                />
              </div>
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

function CaseCard({ case: caseItem, onUpdate, onDelete }: {
  case: Case;
  onUpdate: (id: number, status: 'pending' | 'ongoing' | 'completed' | 'dismissed') => void;
  onDelete: (id: number) => void;
}) {
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    ongoing: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    dismissed: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="rounded-xl border border-slate-200 p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 wrap-break-word">
          <h3 className="font-semibold">{caseItem.case_title}</h3>
          {caseItem.case_number && <p className="text-sm text-slate-600">Case no. {caseItem.case_number}</p>}
          {caseItem.court_name && (
            <p className="text-sm text-gray-600">{caseItem.court_name}</p>
          )}
          {caseItem.next_hearing_date && (
            <p className="text-xs text-gray-500">
              Next hearing: {new Date(caseItem.next_hearing_date).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
              })}
            </p>
          )}
        </div>
        <span className={`px-2 py-1 text-xs rounded-full ${statusColors[caseItem.status as keyof typeof statusColors]}`}>
          {caseItem.status}
        </span>
      </div>
      <div className="mt-3 flex gap-2">
        <select
          aria-label={`Status for ${caseItem.case_title}`}
          value={caseItem.status}
          onChange={(e) => onUpdate(caseItem.id, e.target.value as 'pending' | 'ongoing' | 'completed' | 'dismissed')}
          className="min-h-11 rounded border px-2 py-1 text-base sm:text-sm"
        >
          <option value="pending">Pending</option>
          <option value="ongoing">Ongoing</option>
          <option value="completed">Completed</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <button
          onClick={() => onDelete(caseItem.id)}
          className="min-h-11 px-2 text-sm text-red-600 hover:text-red-800"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
