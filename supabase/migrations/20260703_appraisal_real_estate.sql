-- Migration: 감정평가 게시판 부동산 중심 구조로 개편
-- Date: 2026-07-03
-- Purpose:
--   실제 감정 대상 대부분이 부동산(토지·건물)이고 공장물건(공장재단: 토지·건물·기계기구)이 일부.
--   기존 동산(물품) 중심 구조(item_info)에 부동산 필드를 추가하고 구분(category)을 도입.
--   - category: real_estate(부동산, 기본) / factory(공장물건) / other(기타 물품)
--   - location: 소재지(주소·지번)
--   - property_type: 물건 종류(토지, 토지·건물, 아파트, 임야, 공장 등)
--   - land_area / building_area: 토지·건물 면적(단위 포함 자유 기재, 예: "1,234.5㎡ (373평)")
--   - item_info 는 유지: 공장물건의 기계·기구 목록 / 기타 물품 정보 용도로 재사용.
--   기존 행은 대부분 부동산이므로 default 로 real_estate 처리.

alter table appraisals
  add column if not exists category text not null default 'real_estate'
    check (category in ('real_estate', 'factory', 'other')),
  add column if not exists location text,
  add column if not exists property_type text,
  add column if not exists land_area text,
  add column if not exists building_area text;

comment on column appraisals.category is '감정 구분: real_estate(부동산)/factory(공장물건)/other(기타 물품)';
comment on column appraisals.location is '소재지(주소·지번)';
comment on column appraisals.property_type is '물건 종류(토지, 토지·건물, 아파트, 임야, 공장 등)';
comment on column appraisals.land_area is '토지 면적(단위 포함 자유 기재)';
comment on column appraisals.building_area is '건물 면적(단위 포함 자유 기재)';
comment on column appraisals.item_info is '기계·기구(공장물건) 또는 대상 물품 정보(기타)';
