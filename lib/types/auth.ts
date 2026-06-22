/**
 * Supabase auth.users 메타데이터 스키마 정의
 *
 * 권한(authorization) 정보의 신뢰 출처는 app_metadata(raw_app_meta_data)다.
 *  - app_metadata: service_role(admin API)로만 변경 가능. 클라이언트 updateUser 로 수정 불가.
 *    → role / site_id / is_active 등 권한 판별에 쓰이는 값은 반드시 여기에 둔다.
 *  - user_metadata: 사용자가 updateUser({ data }) 로 직접 수정 가능.
 *    → display_name / name / oauth_* 등 위조돼도 권한에 영향 없는 프로필 정보만 둔다.
 */

export type UserRole = 'admin' | 'staff' | 'viewer' | 'part_time' | 'inquiry';

/**
 * auth.users.app_metadata 에 저장되는 권한 정보 (사용자 수정 불가)
 */
export interface AppMetadata {
  /** 권한 */
  role: UserRole;

  /** 사업장 ID (sites 테이블 UUID) */
  site_id: string;

  /** 활성화 상태 */
  is_active: boolean;
}

/**
 * auth.users.user_metadata 에 저장되는 프로필 정보 (사용자 수정 가능)
 * 권한 관련 필드(role/site_id/is_active)는 여기 두지 않는다 → AppMetadata 참고.
 */
export interface UserMetadata {
  /** 사원번호 (로그인 ID) */
  display_name: string;

  /** 실제 이름 */
  name: string;

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
 * 클라이언트에서 사용하는 User 인터페이스 (user_metadata + app_metadata 조합)
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

  /** 권한 (app_metadata) */
  role: UserRole;

  /** 사업장 ID (app_metadata) */
  site_id: string;

  /** 사업장 이름 (sites 테이블에서 조인) */
  site_name?: string;

  /** 활성화 상태 (app_metadata) */
  is_active: boolean;

  /** OAuth 제공자 */
  oauth_provider?: string;

  /** OAuth 제공자의 사용자 ID */
  oauth_provider_id?: string;

  /** OAuth 연동 시간 */
  oauth_linked_at?: string;
}

/** getAuthz / isAdminUser 에 넘기는 최소 형태 (supabase User 호환) */
type AuthUserLike = {
  app_metadata?: Record<string, unknown> | null;
};

/**
 * app_metadata 에서 권한 정보를 읽는다. role/site_id 가 없으면 null.
 * 권한 판별은 반드시 이 함수(또는 app_metadata)를 통해서만 한다 — user_metadata 금지.
 */
export function getAuthz(authUser: AuthUserLike): AppMetadata | null {
  const app = authUser.app_metadata ?? {};
  const role = app.role;
  const site_id = app.site_id;
  if (typeof role !== 'string' || typeof site_id !== 'string') return null;
  return {
    role: role as UserRole,
    site_id,
    is_active: (app.is_active as boolean | undefined) ?? true,
  };
}

/**
 * 관리자 여부 (app_metadata 기준)
 */
export function isAdminUser(authUser: AuthUserLike): boolean {
  return authUser.app_metadata?.role === 'admin' || authUser.app_metadata?.role === 'super_admin';
}

/**
 * user_metadata(프로필) 가 유효한지 확인 (display_name/name).
 * 권한(role/site_id)은 검사하지 않는다 → getAuthz 사용.
 */
export function isValidUserMetadata(metadata: unknown): metadata is UserMetadata {
  if (!metadata || typeof metadata !== 'object') return false;
  const m = metadata as Record<string, unknown>;
  return typeof m.display_name === 'string' && typeof m.name === 'string';
}

/**
 * 프로필이 완전한지 확인 (user_metadata 의 display_name/name + app_metadata 의 role/site_id).
 */
export function hasCompleteProfile(authUser: AuthUserLike & { user_metadata?: unknown }): boolean {
  return isValidUserMetadata(authUser.user_metadata) && getAuthz(authUser) !== null;
}
