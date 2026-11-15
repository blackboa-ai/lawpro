/** API client for LawPro backend */

import type { CaseUpdate, HearingHistoryEntry } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
}

export interface Case {
  id: number;
  user_id: number;
  case_title: string;
  case_number: string | null;
  court_name: string | null;
  client_name: string | null;
  case_type: string | null;
  description: string | null;
  filing_date: string | null;
  next_hearing_date: string | null;
  status: 'pending' | 'ongoing' | 'completed' | 'dismissed';
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total_cases: number;
  pending_cases: number;
  ongoing_cases: number;
  completed_cases: number;
  upcoming_hearings: number;
}

// Helper to get token from localStorage
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

// Helper to set token in localStorage
export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('token', token);
}

// Helper to remove token from localStorage
export function removeToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
}

// Helper to check if user is authenticated
export function isAuthenticated(): boolean {
  const token = getToken();
  return !!token;
}

// Helper to decode JWT and get user info
export function getDecodedToken(): User | null {
  if (typeof window === 'undefined') return null;
  const token = getToken();
  if (!token) return null;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      id: parseInt(payload.sub, 10),
      email: payload.email,
      full_name: payload.full_name || null,
      role: payload.role,
      is_active: payload.is_active !== false
    };
  } catch {
    return null;
  }
}

// API request with auth
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'An error occurred' }));
    throw new Error(error.detail || 'An error occurred');
  }
  
  return response.status === 204 ? undefined as T : response.json();
}

// Auth endpoints
export async function register(data: { email: string; password: string; full_name?: string }): Promise<User> {
  return apiRequest<User>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function login(data: { email: string; password: string }): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: data.email, password: data.password }).toString(),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'An error occurred' }));
    throw new Error(error.detail || 'An error occurred');
  }
  
  return response.json();
}

export async function getCurrentUser(): Promise<User> {
  return apiRequest<User>('/api/v1/auth/me');
}

// Case endpoints
export async function createCase(
  data: { case_title: string } & Partial<Omit<Case, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'case_title' | 'next_hearing_date' | 'status'>> & { next_hearing_date?: string }
): Promise<Case> {
  const apiData = {
    ...data,
    ...(data.next_hearing_date && { next_hearing_date: data.next_hearing_date }),
  };
  return apiRequest<Case>('/api/v1/cases/', {
    method: 'POST',
    body: JSON.stringify(apiData),
  });
}

export async function getCases(): Promise<Case[]> {
  return apiRequest<Case[]>('/api/v1/cases/');
}

export async function getCase(id: number): Promise<Case> {
  return apiRequest<Case>(`/api/v1/cases/${id}`);
}

export async function updateCase(
  id: number,
  data: CaseUpdate
): Promise<Case> {
  return apiRequest<Case>(`/api/v1/cases/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getHearingHistory(id: number): Promise<HearingHistoryEntry[]> {
  return apiRequest<HearingHistoryEntry[]>(`/api/v1/cases/${id}/hearing-history`);
}

export async function deleteCase(id: number): Promise<void> {
  await apiRequest<void>(`/api/v1/cases/${id}`, {
    method: 'DELETE',
  });
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return apiRequest<DashboardStats>('/api/v1/cases/dashboard');
}
