'use client';

import { useEffect, useState } from 'react';
import { getDashboardStats, getCases, createCase, deleteCase, updateCase, getCurrentUser } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Case, DashboardStats, User } from '@/types';
import Link from 'next/link';
import { LogOut } from 'lucide-react';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCaseTitle, setNewCaseTitle] = useState('');
  const [error, setError] = useState('');

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
    if (!newCaseTitle.trim()) return;
    
    try {
      const newCase = await createCase({ case_title: newCaseTitle, next_hearing_date: '' });
      setCases([newCase, ...cases]);
      setShowCreateModal(false);
      setNewCaseTitle('');
      fetchData();
    } catch (err: any) {
      setError(err.message);
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
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center space-x-4">
          <span className="text-gray-600">Welcome, {user?.full_name || user?.email}</span>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-red-600"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mb-4">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <StatCard title="Total Cases" value={stats?.total_cases || 0} color="blue" />
        <StatCard title="Pending" value={stats?.pending_cases || 0} color="yellow" />
        <StatCard title="Ongoing" value={stats?.ongoing_cases || 0} color="blue" />
        <StatCard title="Completed" value={stats?.completed_cases || 0} color="green" />
        <StatCard title="Upcoming Hearings" value={stats?.upcoming_hearings || 0} color="purple" />
      </div>

      {/* Cases List */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Your Cases</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            + New Case
          </button>
        </div>

        {cases.length === 0 ? (
          <p className="text-gray-500 py-8 text-center">No cases yet. Create your first case!</p>
        ) : (
          <div className="space-y-3">
            {cases.map(caseItem => (
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create New Case</h3>
            <form onSubmit={handleCreateCase}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Case Title</label>
                <input
                  type="text"
                  value={newCaseTitle}
                  onChange={(e) => setNewCaseTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter case title"
                  required
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Create
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
    <div className={`p-4 rounded-lg ${colors[color as keyof typeof colors]}`}>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
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
    <div className="border rounded-lg p-4 hover:shadow-sm">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold">{caseItem.case_title}</h3>
          {caseItem.court_name && (
            <p className="text-sm text-gray-600">{caseItem.court_name}</p>
          )}
          {caseItem.next_hearing_date && (
            <p className="text-xs text-gray-500">
              Next Hearing: {new Date(caseItem.next_hearing_date).toLocaleDateString()}
            </p>
          )}
        </div>
        <span className={`px-2 py-1 text-xs rounded-full ${statusColors[caseItem.status as keyof typeof statusColors]}`}>
          {caseItem.status}
        </span>
      </div>
      <div className="mt-3 flex gap-2">
        <select
          value={caseItem.status}
          onChange={(e) => onUpdate(caseItem.id, e.target.value as 'pending' | 'ongoing' | 'completed' | 'dismissed')}
          className="text-sm border rounded px-2 py-1"
        >
          <option value="pending">Pending</option>
          <option value="ongoing">Ongoing</option>
          <option value="completed">Completed</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <button
          onClick={() => onDelete(caseItem.id)}
          className="text-sm text-red-600 hover:text-red-800"
        >
          Delete
        </button>
      </div>
    </div>
  );
}