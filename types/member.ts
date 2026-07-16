// Types for Member Management System

export interface Crop {
  id: string;
  crop_name: string;
  requires_grafting: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;

  // Basic Information
  site_id: string;
  association_id?: string;
  association_name?: string;
  name: string;
  member_id: string;
  security_number?: string;
  date_of_birth: string; // ISO date string
  gender?: string; // 남자/여자
  phone: string;
  address: string;

  // Farming Information
  main_crop_id?: string;
  main_crop_name?: string;
  sub_crop_id?: string;
  sub_crop_name?: string;

  // Grafting Workplace
  grafting_workplace_address?: string;
  grafting_workplace_lat?: number;
  grafting_workplace_lng?: number;

  // Membership dates
  join_date?: string; // ISO date string
  leave_date?: string; // ISO date string

  // Metadata
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface GraftingSchedule {
  id: string;
  member_id: string;
  year: number;
  grafting_date: string; // ISO date string
  time_period: '오전' | '오후';
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface MemberAuditLog {
  id: string;
  member_id: string;
  action: 'create' | 'update' | 'delete';
  changed_fields: any;
  changed_by?: string;
  changed_at: string;
  ip_address?: string;
  user_agent?: string;
}

// For member overview with statistics
export interface MemberOverview extends Member {
  current_year_grafting_date?: string;
  current_year_grafting_time?: '오전' | '오후';
  issued_voucher_count: number;
  used_voucher_count: number;
  total_issued_amount: number;
  total_used_amount: number;
  remaining_amount: number;
  site_name: string;
}

// Form data types for creating/updating
export interface MemberFormData {
  site_id: string;
  association_id?: string;
  name: string;
  member_id: string;
  security_number?: string;
  date_of_birth: string;
  phone: string;
  address: string;
  join_date?: string;
  leave_date?: string;
  main_crop_id?: string;
  sub_crop_id?: string;
  grafting_workplace_address?: string;
  grafting_workplace_lat?: number;
  grafting_workplace_lng?: number;
}

export interface GraftingScheduleFormData {
  member_id: string;
  year: number;
  grafting_date: string;
  time_period: '오전' | '오후';
  notes?: string;
}

// API request/response types
export interface CreateMemberRequest {
  member: MemberFormData;
  grafting_schedule?: Omit<GraftingScheduleFormData, 'member_id'>;
}

export interface UpdateMemberRequest {
  member: Partial<MemberFormData>;
  grafting_schedule?: Omit<GraftingScheduleFormData, 'member_id'>;
}

export interface MemberListResponse {
  members: MemberOverview[];
  total: number;
  page: number;
  page_size: number;
  error?: string;
}

export interface MemberSearchParams {
  q?: string; // Search query (name, member_id, phone)
  site_id?: string;
  association_id?: string;
  crop_id?: string;
  is_active?: boolean;
  has_grafting?: boolean;
  position?: string; // 직책 필터 (재임 중 기준)
  page?: number;
  page_size?: number;
  sort_by?: 'name' | 'member_id' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

export interface MemberStatistics {
  total_members: number;
  active_members: number;
  inactive_members: number;
  members_by_site: { site_name: string; count: number }[];
  members_by_crop: { crop_name: string; count: number }[];
  recent_joins: number; // Last 30 days
  recent_leaves: number; // Last 30 days
}
