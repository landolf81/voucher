/**
 * Supabase auth.users.user_metadata 스키마 정의
 * user_profiles 테이블 대체용
 */

export type UserRole = 'admin' | 'staff' | 'viewer' | 'part_time' | 'inquiry';

/**
 * auth.users.user_metadata에 저장되는 사용자 정보
 */
export interface UserMetadata {
  /** 사원번호 (로그인 ID) */
  display_name: string;

  /** 실제 이름 */
  name: string;

  /** 권한 */
  role: UserRole;

  /** 사업장 ID (sites 테이블 UUID) */
  site_id: string;

  /** 활성화 상태 */
  is_active: boolean;

  /** OAuth 제공자 */
  oauth_provider?: 'kakao' | 'google' | 'apple';

  /** OAuth 제공자의 사용자 ID */
  oauth_provider_id?: string;

  /** OAuth 연동 시간 */
  oauth_linked_at?: string;

  /** 마이그레이션 완료 여부 (임시 필드) */
  migrated_from_user_profiles?: boolean;

  /** 마이그레이션 시간 (임시 필드) */
  migrated_at?: string;
}

/**
 * 클라이언트에서 사용하는 User 인터페이스
 */
export interface User {
  /** auth.users.id */
  id: string;

  /** 이메일 */
  email?: string;

  /** 전화번호 (E.164 형식) */
  phone?: string;

  /** 사원번호 (display_name) */
  display_name: string;

  /** 실제 이름 */
  name: string;

  /** 권한 */
  role: UserRole;

  /** 사업장 ID */
  site_id: string;

  /** 사업장 이름 (sites 테이블에서 조인) */
  site_name?: string;

  /** 활성화 상태 */
  is_active: boolean;

  /** OAuth 제공자 */
  oauth_provider?: string;

  /** OAuth 제공자의 사용자 ID */
  oauth_provider_id?: string;

  /** OAuth 연동 시간 */
  oauth_linked_at?: string;
}

/**
 * user_metadata에서 User 객체 생성 (폴백 없이)
 */
export function createUserFromMetadata(
  authUser: { id: string; email?: string; phone?: string },
  metadata: UserMetadata,
  siteName?: string
): User {
  return {
    id: authUser.id,
    email: authUser.email,
    phone: authUser.phone,
    display_name: metadata.display_name,
    name: metadata.name,
    role: metadata.role,
    site_id: metadata.site_id,
    site_name: siteName,
    is_active: metadata.is_active ?? true,
    oauth_provider: metadata.oauth_provider,
    oauth_provider_id: metadata.oauth_provider_id,
    oauth_linked_at: metadata.oauth_linked_at,
  };
}

/**
 * user_metadata가 유효한지 확인
 */
export function isValidUserMetadata(metadata: unknown): metadata is UserMetadata {
  if (!metadata || typeof metadata !== 'object') return false;
  const m = metadata as Record<string, unknown>;
  return (
    typeof m.display_name === 'string' &&
    typeof m.name === 'string' &&
    typeof m.role === 'string' &&
    typeof m.site_id === 'string'
  );
}
