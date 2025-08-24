import { createClient } from "@supabase/supabase-js";

// 싱글턴 패턴으로 Supabase 클라이언트 인스턴스 관리
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export const getSupabaseClient = () => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          storageKey: 'voucher-auth',
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
          detectSessionInUrl: true,
          flowType: 'pkce', // Safari를 위한 PKCE flow 사용
          autoRefreshToken: true,
        },
        global: {
          headers: {
            'X-Client-Info': 'voucher-app',
          },
        },
      }
    );
  }
  return supabaseInstance;
};

// 클라이언트 인스턴스 초기화 (로그아웃 시 사용)
export const resetSupabaseClient = () => {
  supabaseInstance = null;
};

// 서버 전용 클라이언트 (기존 함수 유지)
export const supabaseServer = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
};

// 기존 createClient export 유지 (호환성)
export { createClient };
