'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    // /admin 접근 시 자동으로 /admin/dashboard로 리다이렉트
    router.replace('/admin/dashboard');
  }, [router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f9fafb'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '24px'
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '16px'
        }}>
          🔄
        </div>
        <h1 style={{
          fontSize: '24px',
          fontWeight: '600',
          color: '#1f2937',
          marginBottom: '8px'
        }}>
          관리자 페이지로 이동 중...
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#6b7280'
        }}>
          잠시만 기다려주세요.
        </p>
      </div>
    </div>
  );
}