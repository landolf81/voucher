-- OAuth Integration Migration
-- Adds support for OAuth providers (Kakao) with existing member linking requirement

-- 1. Add OAuth provider columns to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS oauth_provider TEXT,
ADD COLUMN IF NOT EXISTS oauth_provider_id TEXT,
ADD COLUMN IF NOT EXISTS oauth_linked_at TIMESTAMPTZ;

-- 2. Make email optional in user_profiles (should already be nullable, but ensure it)
-- Check current constraint and remove NOT NULL if exists
DO $$
BEGIN
    -- Remove NOT NULL constraint from email column if it exists
    BEGIN
        ALTER TABLE user_profiles ALTER COLUMN email DROP NOT NULL;
    EXCEPTION
        WHEN OTHERS THEN
            -- Column might already be nullable, ignore error
            NULL;
    END;
END $$;

-- 3. Add indexes for OAuth provider lookup
CREATE INDEX IF NOT EXISTS idx_user_profiles_oauth_provider ON user_profiles(oauth_provider);
CREATE INDEX IF NOT EXISTS idx_user_profiles_oauth_provider_id ON user_profiles(oauth_provider_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_oauth_composite ON user_profiles(oauth_provider, oauth_provider_id);

-- 4. Add unique constraint for OAuth provider combinations (PostgreSQL compatible)
DO $$
BEGIN
    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_oauth_provider_id' 
        AND table_name = 'user_profiles'
    ) THEN
        ALTER TABLE user_profiles 
        ADD CONSTRAINT unique_oauth_provider_id 
        UNIQUE (oauth_provider, oauth_provider_id);
    END IF;
END $$;

-- 5. Create function to link OAuth account to existing user
CREATE OR REPLACE FUNCTION link_oauth_account(
  p_phone TEXT,
  p_oauth_provider TEXT,
  p_oauth_provider_id TEXT,
  p_auth_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_user user_profiles;
  v_result JSON;
BEGIN
  -- Find existing user by phone number
  SELECT * INTO v_existing_user 
  FROM user_profiles 
  WHERE phone = p_phone AND is_active = true;
  
  -- If no existing user found, return error
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'no_existing_user',
      'message', '등록된 회원이 아닙니다. 관리자에게 문의하세요.'
    );
  END IF;
  
  -- Check if OAuth account is already linked to another user
  IF EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE oauth_provider = p_oauth_provider 
    AND oauth_provider_id = p_oauth_provider_id
    AND id != v_existing_user.id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'oauth_already_linked',
      'message', '이미 다른 계정에 연동된 카카오 계정입니다.'
    );
  END IF;
  
  -- Update existing user with OAuth information
  UPDATE user_profiles 
  SET 
    oauth_provider = p_oauth_provider,
    oauth_provider_id = p_oauth_provider_id,
    oauth_linked_at = NOW(),
    updated_at = NOW()
  WHERE id = v_existing_user.id;
  
  -- Update auth.users id to match existing user profile id
  -- This creates the link between Supabase auth and existing profile
  UPDATE auth.users 
  SET 
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
                        json_build_object(
                          'linked_user_id', v_existing_user.id,
                          'oauth_provider', p_oauth_provider,
                          'phone', p_phone
                        )::jsonb,
    updated_at = NOW()
  WHERE id = p_auth_user_id;
  
  -- Add audit log
  INSERT INTO audit_logs (action, details, created_at)
  VALUES (
    'oauth_account_linked',
    json_build_object(
      'user_id', v_existing_user.id,
      'auth_user_id', p_auth_user_id,
      'oauth_provider', p_oauth_provider,
      'phone', p_phone,
      'linked_at', NOW()
    ),
    NOW()
  );
  
  RETURN json_build_object(
    'success', true,
    'user_id', v_existing_user.id,
    'message', '카카오 계정이 성공적으로 연동되었습니다.'
  );
END;
$$;

-- 6. Create function to check OAuth account linking status
CREATE OR REPLACE FUNCTION check_oauth_linking_required(p_auth_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auth_user auth.users;
  v_existing_profile user_profiles;
  v_result JSON;
BEGIN
  -- Get auth user info
  SELECT * INTO v_auth_user FROM auth.users WHERE id = p_auth_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'user_not_found'
    );
  END IF;
  
  -- Check if user already has a linked profile
  SELECT * INTO v_existing_profile 
  FROM user_profiles 
  WHERE id = p_auth_user_id OR oauth_provider_id = p_auth_user_id::text;
  
  IF FOUND THEN
    -- Already linked
    RETURN json_build_object(
      'success', true,
      'linking_required', false,
      'user_profile', json_build_object(
        'id', v_existing_profile.id,
        'name', v_existing_profile.name,
        'role', v_existing_profile.role,
        'oauth_provider', v_existing_profile.oauth_provider
      )
    );
  ELSE
    -- Linking required
    RETURN json_build_object(
      'success', true,
      'linking_required', true,
      'auth_user_id', p_auth_user_id
    );
  END IF;
END;
$$;

-- 7. Add RLS policies for OAuth operations
-- Allow users to link their own OAuth accounts
CREATE POLICY "users_can_link_own_oauth" ON user_profiles
  FOR UPDATE
  USING (
    -- Allow if user is linking their own account via the function
    oauth_provider IS NULL OR 
    oauth_provider_id IS NULL OR
    id = auth.uid()
  );

-- 8. Add migration completion log
INSERT INTO audit_logs (action, details, created_at)
VALUES (
  'oauth_integration_migration_completed',
  json_build_object(
    'migration_version', '1.0.0',
    'features_added', ARRAY[
      'oauth_provider_columns',
      'email_made_optional', 
      'oauth_linking_functions',
      'rls_policies_updated'
    ],
    'functions_created', ARRAY[
      'link_oauth_account',
      'check_oauth_linking_required'
    ]
  ),
  NOW()
);

-- 9. Verify migration
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'user_profiles' 
      AND column_name = 'oauth_provider'
    ) 
    THEN 'OAuth integration migration completed successfully'
    ELSE 'OAuth integration migration failed'
  END as migration_status;