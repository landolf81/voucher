/**
 * 권한 관리 시스템
 */

export type UserRole = 'admin' | 'staff' | 'viewer' | 'part_time' | 'inquiry';

export type Permission =
  // 사용자 관리
  | 'user:read'
  | 'user:write'
  | 'user:delete'
  
  // 교환권 관리
  | 'voucher:read'
  | 'voucher:write'
  | 'voucher:delete'
  | 'voucher:use'
  | 'voucher:cancel'
  | 'voucher:recall'
  
  // 사업장 관리
  | 'site:read'
  | 'site:write'
  | 'site:delete'
  
  // 스캔 기능
  | 'scan:read'
  | 'scan:write'
  
  // 감사 로그
  | 'audit:read'
  | 'audit:write'
  
  // PDF 생성
  | 'pdf:generate'
  
  // 관리자 기능
  | 'admin:dashboard'
  | 'admin:settings'
  | 'admin:reports';

/**
 * 역할별 권한 정의
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    // 모든 권한
    'user:read', 'user:write', 'user:delete',
    'voucher:read', 'voucher:write', 'voucher:delete', 'voucher:use', 'voucher:cancel', 'voucher:recall',
    'site:read', 'site:write', 'site:delete',
    'scan:read', 'scan:write',
    'audit:read', 'audit:write',
    'pdf:generate',
    'admin:dashboard', 'admin:settings', 'admin:reports'
  ],
  
  staff: [
    // 사업장 관리 권한
    'voucher:read', 'voucher:write', 'voucher:use', 'voucher:recall',
    'scan:read', 'scan:write',
    'pdf:generate',
    'site:read'
  ],
  
  viewer: [
    // 조회 권한만
    'voucher:read',
    'scan:read',
    'site:read',
    'audit:read'
  ],
  
  part_time: [
    // 아르바이트: 기본적인 교환권 처리 권한
    'voucher:read',
    'voucher:use',
    'scan:read',
    'scan:write',
    'site:read'
  ],

  inquiry: [
    // 조회 전용: 읽기 권한만
    'voucher:read',
    'site:read'
  ]
};

/**
 * 사용자가 특정 권한을 가지고 있는지 확인
 */
export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[userRole].includes(permission);
}

/**
 * 사용자가 여러 권한 중 하나라도 가지고 있는지 확인
 */
export function hasAnyPermission(userRole: UserRole, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(userRole, permission));
}

/**
 * 사용자가 모든 권한을 가지고 있는지 확인
 */
export function hasAllPermissions(userRole: UserRole, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(userRole, permission));
}

/**
 * 권한 부족 시 에러 메시지 생성
 */
export function getPermissionErrorMessage(permission: Permission): string {
  const messages: Record<Permission, string> = {
    'user:read': '사용자 정보를 조회할 권한이 없습니다.',
    'user:write': '사용자 정보를 수정할 권한이 없습니다.',
    'user:delete': '사용자를 삭제할 권한이 없습니다.',
    
    'voucher:read': '교환권 정보를 조회할 권한이 없습니다.',
    'voucher:write': '교환권을 생성/수정할 권한이 없습니다.',
    'voucher:delete': '교환권을 삭제할 권한이 없습니다.',
    'voucher:use': '교환권을 사용처리할 권한이 없습니다.',
    'voucher:cancel': '교환권을 취소할 권한이 없습니다.',
    'voucher:recall': '교환권을 회수할 권한이 없습니다.',
    
    'site:read': '사업장 정보를 조회할 권한이 없습니다.',
    'site:write': '사업장 정보를 수정할 권한이 없습니다.',
    'site:delete': '사업장을 삭제할 권한이 없습니다.',
    
    'scan:read': '스캔 기능을 사용할 권한이 없습니다.',
    'scan:write': '스캔 결과를 저장할 권한이 없습니다.',
    
    'audit:read': '감사 로그를 조회할 권한이 없습니다.',
    'audit:write': '감사 로그를 생성할 권한이 없습니다.',
    
    'pdf:generate': 'PDF를 생성할 권한이 없습니다.',
    
    'admin:dashboard': '관리자 대시보드에 접근할 권한이 없습니다.',
    'admin:settings': '관리자 설정에 접근할 권한이 없습니다.',
    'admin:reports': '리포트를 조회할 권한이 없습니다.',
  };

  return messages[permission] || '해당 기능에 접근할 권한이 없습니다.';
}

/**
 * 권한 기반 리다이렉트 URL 결정
 */
export function getDefaultRedirectUrl(userRole: UserRole): string {
  switch (userRole) {
    case 'admin':
      return '/admin/dashboard';
    case 'staff':
      return '/admin/dashboard';  // staff도 대시보드 접근 가능
    case 'viewer':
      return '/admin/dashboard';  // viewer도 대시보드에서 조회만 가능
    case 'part_time':
      return '/admin/dashboard';  // part_time도 대시보드에서 제한적 접근
    case 'inquiry':
      return '/admin/dashboard';  // inquiry는 조회만 가능
    default:
      return '/login';
  }
}

/**
 * 페이지별 필요 권한 정의
 */
export const PAGE_PERMISSIONS: Record<string, Permission[]> = {
  // 관리자 페이지
  '/admin/dashboard': ['admin:dashboard'],
  '/admin/users': ['user:read'],
  '/admin/users/new': ['user:write'],
  '/admin/vouchers': ['voucher:read'],
  '/admin/sites': ['site:read'],
  '/admin/audit': ['audit:read'],
  '/admin/settings': ['admin:settings'],
  '/admin/reports': ['admin:reports'],
  
  // 사용자 페이지
  '/scan': ['scan:read'],
  '/vouchers': ['voucher:read'],
  '/vouchers/[id]': ['voucher:read'],
  '/pdf/voucher/[serial]': ['pdf:generate'],
  '/pdf/statement': ['pdf:generate'],
};

/**
 * 페이지 접근 권한 확인
 */
export function canAccessPage(userRole: UserRole, pathname: string): boolean {
  // 동적 라우트 매칭을 위한 패턴 검사
  for (const [pattern, permissions] of Object.entries(PAGE_PERMISSIONS)) {
    const regex = new RegExp('^' + pattern.replace(/\[.*?\]/g, '[^/]+') + '$');
    if (regex.test(pathname)) {
      return hasAnyPermission(userRole, permissions);
    }
  }
  
  // 정확한 매치가 없으면 기본적으로 허용
  return true;
}

/**
 * 권한별 메뉴 아이템 필터링
 */
export interface MenuItem {
  label: string;
  href: string;
  icon?: string;
  permissions: Permission[];
  children?: MenuItem[];
}

export function filterMenuItemsByPermissions(
  menuItems: MenuItem[],
  userRole: UserRole
): MenuItem[] {
  return menuItems.filter(item => {
    // 권한 확인
    if (!hasAnyPermission(userRole, item.permissions)) {
      return false;
    }
    
    // 자식 메뉴 필터링
    if (item.children) {
      item.children = filterMenuItemsByPermissions(item.children, userRole);
    }
    
    return true;
  });
}

/**
 * 관리자 메뉴 정의
 */
export const ADMIN_MENU_ITEMS: MenuItem[] = [
  {
    label: '대시보드',
    href: '/admin/dashboard',
    icon: '📊',
    permissions: ['admin:dashboard']
  },
  {
    label: '사용자 관리',
    href: '/admin/users',
    icon: '👥',
    permissions: ['user:read']
  },
  {
    label: '교환권 관리',
    href: '/admin/vouchers',
    icon: '🎫',
    permissions: ['voucher:read']
  },
  {
    label: '사업장 관리',
    href: '/admin/sites',
    icon: '🏢',
    permissions: ['site:read']
  },
  {
    label: '감사 로그',
    href: '/admin/audit',
    icon: '📝',
    permissions: ['audit:read']
  },
  {
    label: '리포트',
    href: '/admin/reports',
    icon: '📈',
    permissions: ['admin:reports']
  },
  {
    label: '설정',
    href: '/admin/settings',
    icon: '⚙️',
    permissions: ['admin:settings']
  }
];

/**
 * 일반 사용자 메뉴 정의
 */
export const USER_MENU_ITEMS: MenuItem[] = [
  {
    label: '스캔',
    href: '/scan',
    icon: '📱',
    permissions: ['scan:read']
  },
  {
    label: '내 교환권',
    href: '/vouchers',
    icon: '🎫',
    permissions: ['voucher:read']
  }
];

/**
 * 역할별 메뉴 가져오기
 */
export function getMenuItems(userRole: UserRole): MenuItem[] {
  const baseMenuItems = userRole === 'admin' ? ADMIN_MENU_ITEMS : USER_MENU_ITEMS;
  return filterMenuItemsByPermissions(baseMenuItems, userRole);
}