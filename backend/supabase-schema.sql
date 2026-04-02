-- ClipForge Supabase Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- This is a MINIMAL schema - no video storage, just auth + usage tracking

-- ============================================
-- SUBSCRIPTIONS TABLE
-- Tracks user subscription tier
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'starter', 'creator', 'pro')),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own subscription
CREATE POLICY "Users can view own subscription" ON subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- Only service role (backend) can insert/update subscriptions
CREATE POLICY "Service role can manage subscriptions" ON subscriptions
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- MONTHLY USAGE TABLE
-- Tracks generations per user per month
-- ============================================
CREATE TABLE IF NOT EXISTS monthly_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    month TEXT NOT NULL, -- Format: '2026-01'
    generations INTEGER NOT NULL DEFAULT 0,
    last_generation_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, month)
);

-- Enable Row Level Security
ALTER TABLE monthly_usage ENABLE ROW LEVEL SECURITY;

-- Users can only read their own usage
CREATE POLICY "Users can view own usage" ON monthly_usage
    FOR SELECT USING (auth.uid() = user_id);

-- Only service role (backend) can insert/update usage
CREATE POLICY "Service role can manage usage" ON monthly_usage
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- FUNCTION: Auto-create subscription on user signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.subscriptions (user_id, tier)
    VALUES (NEW.id, 'free');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create subscription when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_usage_user_month ON monthly_usage(user_id, month);

-- ============================================
-- That's it! Super minimal:
-- - subscriptions: which tier the user is on
-- - monthly_usage: how many videos generated this month
-- - No video storage, no history
-- ============================================


