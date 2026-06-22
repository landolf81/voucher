-- Migration: 미사용 pg_graphql 확장 제거 (2026-06-26)
-- Supabase advisor: pg_graphql_anon_table_exposed / pg_graphql_authenticated_table_exposed (WARN, 각 24건).
--
-- 앱은 PostgREST(.from()) 만 사용하고 GraphQL(/graphql/v1) 은 쓰지 않는다(코드 전수 확인).
-- pg_graphql introspection 은 RLS 와 무관하게 anon/authenticated 에 테이블 스키마(이름·컬럼·관계·뮤테이션)를
-- 노출하므로, 문서 권장대로 확장을 제거해 두 lint 를 근본 해소한다.
--
-- 가역적: 필요 시 `create extension pg_graphql;` 로 복구 가능.
-- 영향: /graphql/v1 엔드포인트 및 Supabase Studio GraphiQL 비활성화 (앱 미사용).
drop extension if exists pg_graphql;
