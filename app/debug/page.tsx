'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';

export default function DebugPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [sitesData, setSitesData] = useState<any>(null);
  const [sitesError, setSitesError] = useState<string | null>(null);

  useEffect(() => {
    // Sites API 테스트
    fetch('/api/sites')
      .then(res => res.json())
      .then(data => setSitesData(data))
      .catch(err => setSitesError(err.message));
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Debug 페이지</h1>
      
      <h2>인증 상태:</h2>
      <pre>{JSON.stringify({
        isLoading,
        isAuthenticated,
        user
      }, null, 2)}</pre>

      <h2>Sites API 결과:</h2>
      {sitesError ? (
        <div style={{ color: 'red' }}>에러: {sitesError}</div>
      ) : (
        <pre>{JSON.stringify(sitesData, null, 2)}</pre>
      )}

      <h2>환경변수 확인:</h2>
      <pre>{JSON.stringify({
        SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 20) + '...',
        HAS_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      }, null, 2)}</pre>
    </div>
  );
}