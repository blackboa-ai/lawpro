import { apiRequest } from '@/lib/api';

const root = '/api/v1/legal-intelligence';

export interface LegalItem {
  id: string;
  title: string;
  court_name: string | null;
  judgment_date: string | null;
  subject_category: string | null;
  source: string | null;
  excerpt: string | null;
  url: string | null;
}

export interface LegalDetail extends LegalItem {
  full_text: string | null;
}

export interface LegalPage {
  items: LegalItem[];
  offset: number;
  limit: number;
  has_more: boolean;
}

export interface LegalFilters {
  courts: { code: string; name: string }[];
  categories: { name: string }[];
}

export function getLegalUpdates(query: string, signal: AbortSignal) {
  return apiRequest<LegalPage>(`${root}/updates?${query}`, { signal, cache: 'no-store' });
}

export function getLegalFilters(_key: string, signal: AbortSignal) {
  return apiRequest<LegalFilters>(`${root}/filters`, { signal, cache: 'no-store' });
}

export function getLegalDetail(id: string, signal: AbortSignal) {
  return apiRequest<LegalDetail>(`${root}/updates/${encodeURIComponent(id)}`, { signal, cache: 'no-store' });
}

export function originalSourceUrl(value: string | null) {
  if (!value || !/^https?:\/\//i.test(value) || /[\s\\\x00-\x1f\x7f]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (!url.username && !url.password) return url.href;
  } catch {
    // The result can still be read if its source link is invalid.
  }
  return null;
}
