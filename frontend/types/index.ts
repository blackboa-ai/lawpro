/** TypeScript type definitions for LawPro */

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
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

export interface CaseCreate {
  case_title: string;
  case_number?: string | null;
  court_name?: string | null;
  client_name?: string | null;
  case_type?: string | null;
  description?: string | null;
  filing_date?: string | null;
  next_hearing_date?: string | null;
  status?: string;
}

export interface CaseUpdate {
  case_title?: string;
  case_number?: string | null;
  court_name?: string | null;
  client_name?: string | null;
  case_type?: string | null;
  description?: string | null;
  filing_date?: string | null;
  next_hearing_date?: string | null;
  status?: CaseStatus;
  hearing_notes?: string;
  expected_hearing_date?: string | null;
  expected_updated_at?: string;
}

export interface HearingHistoryEntry {
  id: number;
  hearing_date: string;
  next_hearing_date: string | null;
  notes: string | null;
  recorded_at: string;
}

export interface DashboardStats {
  total_cases: number;
  pending_cases: number;
  ongoing_cases: number;
  completed_cases: number;
  upcoming_hearings: number;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export type CaseStatus = 'pending' | 'ongoing' | 'completed' | 'dismissed';
