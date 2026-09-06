-- MFA and Device/Session Management
-- Migration for multi-factor authentication and device tracking

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- MFA Secrets Table
CREATE TABLE IF NOT EXISTS public.user_mfa_secrets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  totp_secret TEXT NOT NULL,
  backup_codes TEXT[] NOT NULL,
  enabled BOOLEAN DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Device Management Table
CREATE TABLE IF NOT EXISTS public.user_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL, -- 'mobile', 'desktop', 'tablet'
  device_identifier TEXT NOT NULL, -- User agent hash or device fingerprint
  user_agent TEXT,
  ip_address INET,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_trusted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Session Management Table
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.user_devices(id) ON DELETE SET NULL,
  session_token TEXT NOT NULL UNIQUE,
  mfa_verified BOOLEAN DEFAULT false,
  ip_address INET,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_mfa_secrets_user_id ON public.user_mfa_secrets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON public.user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_device_identifier ON public.user_devices(device_identifier);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON public.user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON public.user_sessions(expires_at);

-- Row Level Security Policies

-- MFA Secrets RLS
ALTER TABLE public.user_mfa_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own MFA secrets"
  ON public.user_mfa_secrets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own MFA secrets"
  ON public.user_mfa_secrets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own MFA secrets"
  ON public.user_mfa_secrets FOR UPDATE
  USING (auth.uid() = user_id);

-- Device Management RLS
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own devices"
  ON public.user_devices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own devices"
  ON public.user_devices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own devices"
  ON public.user_devices FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own devices"
  ON public.user_devices FOR DELETE
  USING (auth.uid() = user_id);

-- Session Management RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
  ON public.user_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions"
  ON public.user_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON public.user_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions"
  ON public.user_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at for MFA secrets
CREATE TRIGGER update_user_mfa_secrets_updated_at
  BEFORE UPDATE ON public.user_mfa_secrets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM public.user_sessions
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to update session last accessed timestamp
CREATE OR REPLACE FUNCTION public.update_session_last_accessed()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_accessed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update session last accessed on read (optional)
-- CREATE TRIGGER update_session_last_accessed_trigger
--   AFTER SELECT ON public.user_sessions
--   FOR EACH ROW
--   EXECUTE FUNCTION public.update_session_last_accessed();

-- Create a function to check if MFA is required for a user
CREATE OR REPLACE FUNCTION public.is_mfa_required(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_mfa_secrets
    WHERE user_mfa_secrets.user_id = is_mfa_required.user_id
    AND enabled = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get user's trusted devices
CREATE OR REPLACE FUNCTION public.get_trusted_devices(user_id UUID)
RETURNS TABLE (
  id UUID,
  device_name TEXT,
  device_type TEXT,
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_trusted BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ud.id,
    ud.device_name,
    ud.device_type,
    ud.last_used_at,
    ud.is_trusted
  FROM public.user_devices ud
  WHERE ud.user_id = get_trusted_devices.user_id
  ORDER BY ud.last_used_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON TABLE public.user_mfa_secrets TO authenticated;
GRANT ALL ON TABLE public.user_devices TO authenticated;
GRANT ALL ON TABLE public.user_sessions TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_mfa_required TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trusted_devices TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_sessions TO authenticated;
