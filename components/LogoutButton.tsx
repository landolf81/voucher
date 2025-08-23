'use client';

import { useAuth } from '@/lib/contexts/AuthContext';

export default function LogoutButton() {
  const { logout } = useAuth();

  const handleLogout = async () => {
    if (confirm('정말 로그아웃 하시겠습니까?')) {
      await logout();
    }
  };

  return (
    <button
      onClick={handleLogout}
      style={{
        backgroundColor: '#ef4444',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '6px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500'
      }}
    >
      로그아웃
    </button>
  );
}