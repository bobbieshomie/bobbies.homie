-- ==============================================================================
-- HOMIE PWA - Production-Ready PostgreSQL Schema & RLS Policies
-- Household Management Web-App for Couples
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. ENUMS & CUSTOM TYPES
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE chore_frequency AS ENUM ('once', 'daily', 'weekly', 'biweekly', 'monthly');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE shopping_category AS ENUM ('grocery', 'household', 'health', 'pets', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE pet_log_type AS ENUM ('vaccine', 'vet', 'grooming', 'medication', 'weight', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE finance_category AS ENUM ('groceries', 'utilities', 'rent', 'dining', 'pets', 'entertainment', 'travel', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ------------------------------------------------------------------------------
-- 2. CORE HOUSEHOLD & USER PROFILES
-- ------------------------------------------------------------------------------

-- Households Table (Shared boundary between couples)
CREATE TABLE IF NOT EXISTS public.households (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL DEFAULT 'Our Home',
    invite_code TEXT UNIQUE NOT NULL DEFAULT UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profiles Table (Extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    household_id UUID REFERENCES public.households(id) ON DELETE SET NULL,
    username TEXT UNIQUE,
    full_name TEXT NOT NULL,
    nickname TEXT,
    avatar_url TEXT,
    bio TEXT,
    cover_url TEXT,
    anniversary_date DATE,
    role TEXT DEFAULT 'partner', -- 'partner_1', 'partner_2'
    theme_color TEXT DEFAULT '#EC4899', -- Hex color code for UI customization
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes on household_id and username for high-performance tenant filtering and auth lookups
CREATE INDEX IF NOT EXISTS idx_profiles_household_id ON public.profiles(household_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(LOWER(username));

-- ------------------------------------------------------------------------------
-- 2.1 HOUSEHOLD PHOTOS & MEMORIES GALLERY
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.household_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    photo_url TEXT NOT NULL,
    caption TEXT,
    category TEXT DEFAULT 'moment', -- 'moment', 'avatar', 'cover', 'pet', 'anniversary'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_household_photos_household_id ON public.household_photos(household_id);
CREATE INDEX IF NOT EXISTS idx_household_photos_category ON public.household_photos(household_id, category);

-- ------------------------------------------------------------------------------
-- 3. CHORES MODULE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    frequency chore_frequency NOT NULL DEFAULT 'weekly',
    points INT DEFAULT 10,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chores_household_id ON public.chores(household_id);
CREATE INDEX IF NOT EXISTS idx_chores_due_date ON public.chores(due_date);
CREATE INDEX IF NOT EXISTS idx_chores_status ON public.chores(household_id, is_completed);

-- ------------------------------------------------------------------------------
-- 4. SHOPPING LIST MODULE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shopping_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category shopping_category NOT NULL DEFAULT 'grocery',
    quantity TEXT DEFAULT '1',
    note TEXT,
    is_purchased BOOLEAN NOT NULL DEFAULT FALSE,
    purchased_at TIMESTAMPTZ,
    added_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shopping_items_household_id ON public.shopping_items(household_id);
CREATE INDEX IF NOT EXISTS idx_shopping_items_purchased ON public.shopping_items(household_id, is_purchased);

-- ------------------------------------------------------------------------------
-- 5. SHARED CALENDAR MODULE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calendar_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_shared BOOLEAN NOT NULL DEFAULT TRUE,
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    color_tag TEXT DEFAULT '#3B82F6',
    location TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_household_id ON public.calendar_events(household_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_times ON public.calendar_events(household_id, start_time, end_time);

-- ------------------------------------------------------------------------------
-- 6. DAILY MOOD & CHECK-IN MODULE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_moods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    mood_level INT NOT NULL CHECK (mood_level BETWEEN 1 AND 5),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_daily_mood UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_moods_household_date ON public.daily_moods(household_id, date);

-- ------------------------------------------------------------------------------
-- 7. PETS & HEALTH LOGS MODULE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    breed TEXT,
    birthdate DATE,
    photo_url TEXT,
    color_tag TEXT DEFAULT '#10B981',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pets_household_id ON public.pets(household_id);

CREATE TABLE IF NOT EXISTS public.pet_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
    log_type pet_log_type NOT NULL DEFAULT 'vet',
    scheduled_date DATE NOT NULL,
    notes TEXT,
    is_done BOOLEAN NOT NULL DEFAULT FALSE,
    cost DECIMAL(10, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pet_logs_pet_id ON public.pet_logs(pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_logs_date ON public.pet_logs(scheduled_date);

-- ------------------------------------------------------------------------------
-- 8. FINANCES & BUDGET MODULE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shared_finances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
    category finance_category NOT NULL DEFAULT 'groceries',
    paid_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_reimbursed BOOLEAN NOT NULL DEFAULT FALSE,
    reimbursed_at TIMESTAMPTZ,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    receipt_url TEXT,
    split_ratio NUMERIC(3, 2) DEFAULT 0.50, -- 50/50 split by default
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finances_household_id ON public.shared_finances(household_id);
CREATE INDEX IF NOT EXISTS idx_finances_date ON public.shared_finances(household_id, date);
CREATE INDEX IF NOT EXISTS idx_finances_reimbursed ON public.shared_finances(household_id, is_reimbursed);

CREATE TABLE IF NOT EXISTS public.monthly_budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    month_year VARCHAR(7) NOT NULL, -- e.g. '2026-09'
    total_budget DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    category_budgets JSONB NOT NULL DEFAULT '{}'::jsonb, -- {"groceries": 800, "utilities": 250, ...}
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_household_month_budget UNIQUE (household_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_budgets_household_month ON public.monthly_budgets(household_id, month_year);

-- ------------------------------------------------------------------------------
-- 9. HELPER FUNCTIONS & TRIGGERS
-- ------------------------------------------------------------------------------

-- Helper to retrieve current authenticated user's household_id with caching behavior
CREATE OR REPLACE FUNCTION public.get_auth_household_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT household_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Trigger to auto-update 'updated_at' column
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Apply updated_at triggers
DO $$ 
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN 
        SELECT unnest(ARRAY[
            'households', 'profiles', 'chores', 'shopping_items', 
            'calendar_events', 'daily_moods', 'pets', 'pet_logs', 
            'shared_finances', 'monthly_budgets'
        ])
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trigger_set_updated_at ON public.%I;
            CREATE TRIGGER trigger_set_updated_at
            BEFORE UPDATE ON public.%I
            FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
        ', tbl, tbl);
    END LOOP;
END $$;

-- Trigger on auth.users creation to automatically seed a public.profiles record
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_household_id UUID;
    v_invite_code TEXT;
    v_mode TEXT;
    v_h_name TEXT;
    v_member_count INT;
BEGIN
    v_mode := NEW.raw_user_meta_data->>'household_mode';
    v_invite_code := UPPER(TRIM(COALESCE(NEW.raw_user_meta_data->>'invite_code', '')));
    v_h_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'household_name'), ''), 'Our Home');

    -- Option 1: Create a new household if requested
    IF v_mode = 'create' THEN
        INSERT INTO public.households (name)
        VALUES (v_h_name)
        RETURNING id INTO v_household_id;
    -- Option 2: Join an existing household by invite code if provided
    ELSIF v_mode = 'join' AND v_invite_code <> '' THEN
        SELECT id INTO v_household_id
        FROM public.households
        WHERE invite_code = v_invite_code;

        IF v_household_id IS NOT NULL THEN
            SELECT COUNT(*) INTO v_member_count
            FROM public.profiles
            WHERE household_id = v_household_id;

            IF v_member_count >= 2 THEN
                v_household_id := NULL; -- Household full, profile left unattached
            END IF;
        END IF;
    END IF;

    INSERT INTO public.profiles (
        id, 
        household_id,
        username,
        full_name, 
        nickname,
        avatar_url,
        role
    )
    VALUES (
        NEW.id,
        v_household_id,
        LOWER(NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), '')),
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'username', 'Homie Partner'),
        COALESCE(NEW.raw_user_meta_data->>'nickname', NEW.raw_user_meta_data->>'full_name', 'Honey'),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
        CASE WHEN v_household_id IS NOT NULL AND v_mode = 'create' THEN 'partner_1' ELSE 'partner' END
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper to look up an auth user's email using their unique username
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email TEXT;
BEGIN
    SELECT u.email INTO v_email
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE LOWER(p.username) = LOWER(TRIM(p_username));

    RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_by_username(TEXT) TO anon, authenticated;

-- Atomic function for creating a new household and linking the user
CREATE OR REPLACE FUNCTION public.create_household_and_join(household_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_household_id UUID;
    new_invite_code TEXT;
BEGIN
    INSERT INTO public.households (name)
    VALUES (COALESCE(NULLIF(TRIM(household_name), ''), 'Our Home'))
    RETURNING id, invite_code INTO new_household_id, new_invite_code;

    UPDATE public.profiles
    SET household_id = new_household_id,
        role = 'partner_1'
    WHERE id = auth.uid();

    RETURN jsonb_build_object(
        'success', true,
        'household_id', new_household_id,
        'invite_code', new_invite_code
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_household_and_join(TEXT) TO authenticated;

-- Atomic function for joining a household by invite code
CREATE OR REPLACE FUNCTION public.join_household_by_invite(invite_code_input TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_household_id UUID;
    member_count INT;
BEGIN
    -- Verify invite code
    SELECT id INTO target_household_id
    FROM public.households
    WHERE invite_code = UPPER(TRIM(invite_code_input));

    IF target_household_id IS NULL THEN
        RAISE EXCEPTION 'Invalid invite code';
    END IF;

    -- Couples constraint: check current members count
    SELECT COUNT(*) INTO member_count
    FROM public.profiles
    WHERE household_id = target_household_id;

    IF member_count >= 2 THEN
        RAISE EXCEPTION 'This household already has 2 partners';
    END IF;

    -- Update user profile
    UPDATE public.profiles
    SET household_id = target_household_id,
        role = CASE WHEN member_count = 0 THEN 'partner_1' ELSE 'partner_2' END
    WHERE id = auth.uid();

    RETURN jsonb_build_object(
        'success', true,
        'household_id', target_household_id
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

-- Enable RLS across all tables
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_moods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_finances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_budgets ENABLE ROW LEVEL SECURITY;

-- 10.1 HOUSEHOLDS POLICIES
DROP POLICY IF EXISTS "Members can view their household" ON public.households;
CREATE POLICY "Members can view their household"
ON public.households FOR SELECT
USING (id = public.get_auth_household_id());

DROP POLICY IF EXISTS "Authenticated users can create a household" ON public.households;
CREATE POLICY "Authenticated users can create a household"
ON public.households FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Members can update their household" ON public.households;
CREATE POLICY "Members can update their household"
ON public.households FOR UPDATE
USING (id = public.get_auth_household_id());

-- 10.2 PROFILES POLICIES
DROP POLICY IF EXISTS "Profiles viewable by household members or self" ON public.profiles;
CREATE POLICY "Profiles viewable by household members or self"
ON public.profiles FOR SELECT
USING (
    id = auth.uid() 
    OR (household_id IS NOT NULL AND household_id = public.get_auth_household_id())
);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 10.3 CHORES POLICIES
DROP POLICY IF EXISTS "Household members can view chores" ON public.chores;
CREATE POLICY "Household members can view chores"
ON public.chores FOR SELECT
USING (household_id = public.get_auth_household_id());

DROP POLICY IF EXISTS "Household members can insert chores" ON public.chores;
CREATE POLICY "Household members can insert chores"
ON public.chores FOR INSERT
WITH CHECK (household_id = public.get_auth_household_id());

DROP POLICY IF EXISTS "Household members can update chores" ON public.chores;
CREATE POLICY "Household members can update chores"
ON public.chores FOR UPDATE
USING (household_id = public.get_auth_household_id())
WITH CHECK (household_id = public.get_auth_household_id());

DROP POLICY IF EXISTS "Household members can delete chores" ON public.chores;
CREATE POLICY "Household members can delete chores"
ON public.chores FOR DELETE
USING (household_id = public.get_auth_household_id());

-- 10.4 SHOPPING ITEMS POLICIES
DROP POLICY IF EXISTS "Household members can view shopping items" ON public.shopping_items;
CREATE POLICY "Household members can view shopping items"
ON public.shopping_items FOR SELECT
USING (household_id = public.get_auth_household_id());

DROP POLICY IF EXISTS "Household members can insert shopping items" ON public.shopping_items;
CREATE POLICY "Household members can insert shopping items"
ON public.shopping_items FOR INSERT
WITH CHECK (household_id = public.get_auth_household_id());

DROP POLICY IF EXISTS "Household members can update shopping items" ON public.shopping_items;
CREATE POLICY "Household members can update shopping items"
ON public.shopping_items FOR UPDATE
USING (household_id = public.get_auth_household_id())
WITH CHECK (household_id = public.get_auth_household_id());

DROP POLICY IF EXISTS "Household members can delete shopping items" ON public.shopping_items;
CREATE POLICY "Household members can delete shopping items"
ON public.shopping_items FOR DELETE
USING (household_id = public.get_auth_household_id());

-- 10.5 CALENDAR EVENTS POLICIES
DROP POLICY IF EXISTS "Household members can view calendar events" ON public.calendar_events;
CREATE POLICY "Household members can view calendar events"
ON public.calendar_events FOR SELECT
USING (
    household_id = public.get_auth_household_id()
    AND (is_shared = TRUE OR owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Household members can insert calendar events" ON public.calendar_events;
CREATE POLICY "Household members can insert calendar events"
ON public.calendar_events FOR INSERT
WITH CHECK (household_id = public.get_auth_household_id());

DROP POLICY IF EXISTS "Household members can update calendar events" ON public.calendar_events;
CREATE POLICY "Household members can update calendar events"
ON public.calendar_events FOR UPDATE
USING (household_id = public.get_auth_household_id())
WITH CHECK (household_id = public.get_auth_household_id());

DROP POLICY IF EXISTS "Household members can delete calendar events" ON public.calendar_events;
CREATE POLICY "Household members can delete calendar events"
ON public.calendar_events FOR DELETE
USING (household_id = public.get_auth_household_id());

-- 10.6 DAILY MOODS POLICIES
DROP POLICY IF EXISTS "Household members can view partner moods" ON public.daily_moods;
CREATE POLICY "Household members can view partner moods"
ON public.daily_moods FOR SELECT
USING (household_id = public.get_auth_household_id());

DROP POLICY IF EXISTS "Users can insert their own daily mood" ON public.daily_moods;
CREATE POLICY "Users can insert their own daily mood"
ON public.daily_moods FOR INSERT
WITH CHECK (
    household_id = public.get_auth_household_id() 
    AND user_id = auth.uid()
);

DROP POLICY IF EXISTS "Users can update their own daily mood" ON public.daily_moods;
CREATE POLICY "Users can update their own daily mood"
ON public.daily_moods FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 10.7 PETS & PET LOGS POLICIES
DROP POLICY IF EXISTS "Household members can view pets" ON public.pets;
CREATE POLICY "Household members can view pets"
ON public.pets FOR SELECT
USING (household_id = public.get_auth_household_id());

DROP POLICY IF EXISTS "Household members can manage pets" ON public.pets;
CREATE POLICY "Household members can manage pets"
ON public.pets FOR ALL
USING (household_id = public.get_auth_household_id())
WITH CHECK (household_id = public.get_auth_household_id());

DROP POLICY IF EXISTS "Household members can view pet logs" ON public.pet_logs;
CREATE POLICY "Household members can view pet logs"
ON public.pet_logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.pets
        WHERE pets.id = pet_logs.pet_id
        AND pets.household_id = public.get_auth_household_id()
    )
);

DROP POLICY IF EXISTS "Household members can manage pet logs" ON public.pet_logs;
CREATE POLICY "Household members can manage pet logs"
ON public.pet_logs FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.pets
        WHERE pets.id = pet_logs.pet_id
        AND pets.household_id = public.get_auth_household_id()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.pets
        WHERE pets.id = pet_logs.pet_id
        AND pets.household_id = public.get_auth_household_id()
    )
);

-- 10.8 SHARED FINANCES POLICIES
DROP POLICY IF EXISTS "Household members can view shared finances" ON public.shared_finances;
CREATE POLICY "Household members can view shared finances"
ON public.shared_finances FOR SELECT
USING (household_id = public.get_auth_household_id());

DROP POLICY IF EXISTS "Household members can insert shared finances" ON public.shared_finances;
CREATE POLICY "Household members can insert shared finances"
ON public.shared_finances FOR INSERT
WITH CHECK (household_id = public.get_auth_household_id());

DROP POLICY IF EXISTS "Household members can update shared finances" ON public.shared_finances;
CREATE POLICY "Household members can update shared finances"
ON public.shared_finances FOR UPDATE
USING (household_id = public.get_auth_household_id())
WITH CHECK (household_id = public.get_auth_household_id());

DROP POLICY IF EXISTS "Household members can delete shared finances" ON public.shared_finances;
CREATE POLICY "Household members can delete shared finances"
ON public.shared_finances FOR DELETE
USING (household_id = public.get_auth_household_id());

-- 10.9 MONTHLY BUDGETS POLICIES
DROP POLICY IF EXISTS "Household members can view budgets" ON public.monthly_budgets;
CREATE POLICY "Household members can view budgets"
ON public.monthly_budgets FOR SELECT
USING (household_id = public.get_auth_household_id());

DROP POLICY IF EXISTS "Household members can manage budgets" ON public.monthly_budgets;
CREATE POLICY "Household members can manage budgets"
ON public.monthly_budgets FOR ALL
USING (household_id = public.get_auth_household_id())
WITH CHECK (household_id = public.get_auth_household_id());

-- 10.10 HOUSEHOLD PHOTOS POLICIES
ALTER TABLE public.household_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Household members can view photos" ON public.household_photos;
CREATE POLICY "Household members can view photos"
ON public.household_photos FOR SELECT
USING (household_id = public.get_auth_household_id());

DROP POLICY IF EXISTS "Household members can insert photos" ON public.household_photos;
CREATE POLICY "Household members can insert photos"
ON public.household_photos FOR INSERT
WITH CHECK (household_id = public.get_auth_household_id());

DROP POLICY IF EXISTS "Household members can delete their photos" ON public.household_photos;
CREATE POLICY "Household members can delete their photos"
ON public.household_photos FOR DELETE
USING (household_id = public.get_auth_household_id());

-- ------------------------------------------------------------------------------
-- 11. SUPABASE REALTIME REPLICATION CONFIGURATION
-- ------------------------------------------------------------------------------
-- Enable full record replication on replica identity for instant optimistic update syncing
ALTER TABLE public.chores REPLICA IDENTITY FULL;
ALTER TABLE public.shopping_items REPLICA IDENTITY FULL;
ALTER TABLE public.calendar_events REPLICA IDENTITY FULL;
ALTER TABLE public.daily_moods REPLICA IDENTITY FULL;
ALTER TABLE public.shared_finances REPLICA IDENTITY FULL;
ALTER TABLE public.household_photos REPLICA IDENTITY FULL;

-- Add tables to the supabase_realtime publication
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chores;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_items;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_moods;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_finances;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.household_photos;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ------------------------------------------------------------------------------
-- 12. STORAGE BUCKETS SETUP & POLICIES (Avatars & Couple Photos)
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) 
VALUES 
    ('avatars', 'avatars', true),
    ('couple-photos', 'couple-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Public read access for avatars and couple photos
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id IN ('avatars', 'couple-photos'));

-- Storage RLS: Authenticated users can upload to avatars and couple-photos
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id IN ('avatars', 'couple-photos'));

-- Storage RLS: Users can update/delete their own uploads
DROP POLICY IF EXISTS "Users can update their uploaded photos" ON storage.objects;
CREATE POLICY "Users can update their uploaded photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id IN ('avatars', 'couple-photos') AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their uploaded photos" ON storage.objects;
CREATE POLICY "Users can delete their uploaded photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id IN ('avatars', 'couple-photos') AND auth.uid()::text = (storage.foldername(name))[1]);
