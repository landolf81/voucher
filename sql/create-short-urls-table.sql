-- Short URLs 테이블 생성 (URL 단축 시스템)
-- 모바일 교환권 URL을 단축하여 사용자 편의성 개선

CREATE TABLE IF NOT EXISTS short_urls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 6자리 Base62 단축 코드 (568억 개 조합 가능)
    short_code VARCHAR(10) UNIQUE NOT NULL,
    
    -- 원본 URL (모바일 교환권 링크)
    original_url TEXT NOT NULL,
    
    -- 생성자 정보 (추적용, 선택사항)
    created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- 만료일 (원본 교환권과 동일한 만료일 설정)
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- 클릭 통계
    click_count INTEGER DEFAULT 0 NOT NULL,
    last_clicked_at TIMESTAMP WITH TIME ZONE,
    
    -- 메타데이터
    metadata JSONB DEFAULT '{}' NOT NULL,
    
    -- 타임스탬프
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_short_urls_short_code ON short_urls(short_code);
CREATE INDEX IF NOT EXISTS idx_short_urls_expires_at ON short_urls(expires_at);
CREATE INDEX IF NOT EXISTS idx_short_urls_created_by ON short_urls(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_short_urls_created_at ON short_urls(created_at DESC);

-- updated_at 자동 업데이트를 위한 트리거
CREATE OR REPLACE FUNCTION update_short_urls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER short_urls_updated_at_trigger
    BEFORE UPDATE ON short_urls
    FOR EACH ROW
    EXECUTE FUNCTION update_short_urls_updated_at();

-- RLS (Row Level Security) 설정
ALTER TABLE short_urls ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자가 자신이 생성한 단축 URL 조회 가능
CREATE POLICY "Users can view their own short URLs" ON short_urls
    FOR SELECT USING (created_by_user_id = auth.uid());

-- 관리자는 모든 단축 URL 조회 가능
CREATE POLICY "Admins can view all short URLs" ON short_urls
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

-- 인증된 사용자는 단축 URL 생성 가능
CREATE POLICY "Authenticated users can create short URLs" ON short_urls
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 사용자는 자신이 생성한 단축 URL 업데이트 가능 (클릭 수 등)
CREATE POLICY "Users can update their own short URLs" ON short_urls
    FOR UPDATE USING (created_by_user_id = auth.uid() OR auth.uid() IS NULL);

-- 만료된 단축 URL 정리를 위한 함수
CREATE OR REPLACE FUNCTION cleanup_expired_short_urls(days_before INTEGER DEFAULT 7)
RETURNS TABLE(deleted_count INTEGER) AS $$
DECLARE
    cleanup_date TIMESTAMP WITH TIME ZONE;
    result_count INTEGER;
BEGIN
    -- 기준일 계산 (만료일 + days_before일 후)
    cleanup_date := NOW() - INTERVAL '1 day' * days_before;
    
    -- 만료된 단축 URL 삭제
    DELETE FROM short_urls 
    WHERE expires_at < cleanup_date;
    
    GET DIAGNOSTICS result_count = ROW_COUNT;
    
    -- 감사 로그 생성
    INSERT INTO audit_logs (action, details) 
    VALUES (
        'short_urls_cleanup',
        jsonb_build_object(
            'cleanup_date', cleanup_date,
            'days_before', days_before,
            'deleted_count', result_count
        )
    );
    
    RETURN QUERY SELECT result_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 단축 URL 클릭 추적을 위한 함수
CREATE OR REPLACE FUNCTION track_short_url_click(p_short_code VARCHAR)
RETURNS TABLE(original_url TEXT, is_expired BOOLEAN) AS $$
DECLARE
    url_record RECORD;
    is_expired_flag BOOLEAN := FALSE;
BEGIN
    -- 단축 URL 조회 및 클릭 수 증가
    UPDATE short_urls 
    SET 
        click_count = click_count + 1,
        last_clicked_at = NOW(),
        updated_at = NOW()
    WHERE short_code = p_short_code
    RETURNING * INTO url_record;
    
    -- 레코드가 없으면 NULL 반환
    IF NOT FOUND THEN
        RETURN QUERY SELECT NULL::TEXT, TRUE;
        RETURN;
    END IF;
    
    -- 만료 여부 확인
    IF url_record.expires_at < NOW() THEN
        is_expired_flag := TRUE;
    END IF;
    
    RETURN QUERY SELECT url_record.original_url, is_expired_flag;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 테이블 및 함수에 대한 권한 설정
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON TABLE short_urls TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_short_urls TO authenticated;
GRANT EXECUTE ON FUNCTION track_short_url_click TO authenticated;

-- 코멘트 추가
COMMENT ON TABLE short_urls IS '모바일 교환권 URL 단축 시스템';
COMMENT ON COLUMN short_urls.short_code IS '6자리 Base62 단축 코드';
COMMENT ON COLUMN short_urls.original_url IS '원본 모바일 교환권 URL';
COMMENT ON COLUMN short_urls.expires_at IS '만료일 (원본 교환권과 동일)';
COMMENT ON COLUMN short_urls.click_count IS '클릭 횟수';
COMMENT ON COLUMN short_urls.metadata IS 'JSON 메타데이터 (배치 정보 등)';
COMMENT ON FUNCTION cleanup_expired_short_urls IS '만료된 단축 URL 정리';
COMMENT ON FUNCTION track_short_url_click IS '단축 URL 클릭 추적 및 원본 URL 반환';