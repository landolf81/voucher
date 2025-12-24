'use client';

import { useState } from 'react';

export default function DebugTokenPage() {
  const [token, setToken] = useState('G93TsXgAJHBHjPZuuJV6ETDoAOpFk_mh02tg63');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const checkToken = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/vouchers/check-mobile-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token })
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: '요청 실패: ' + error });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '20px' }}>
        모바일 토큰 디버그
      </h1>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
          토큰 입력:
        </label>
        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '14px',
            fontFamily: 'monospace',
            color: '#1a202c',
            backgroundColor: 'white'
          }}
          placeholder="토큰을 입력하세요"
        />
      </div>

      <button
        onClick={checkToken}
        disabled={loading || !token}
        style={{
          padding: '12px 24px',
          backgroundColor: loading ? '#9ca3af' : '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '16px',
          fontWeight: '500',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? '검색 중...' : '토큰 검색'}
      </button>

      {result && (
        <div style={{
          marginTop: '30px',
          padding: '20px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>
            검색 결과:
          </h2>
          <pre style={{
            backgroundColor: 'white',
            padding: '16px',
            borderRadius: '6px',
            overflow: 'auto',
            fontSize: '13px',
            color: '#1a202c'
          }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
