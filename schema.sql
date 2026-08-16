-- 0. Nulstil eksisterende tabeller for ren multi-turnering struktur
DROP TABLE IF EXISTS public.matches CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;
DROP TABLE IF EXISTS public.tournaments CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.config CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TOURNAMENTS TABLE
CREATE TABLE public.tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    admin_username TEXT NOT NULL,
    admin_contact TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT 'double' CHECK (format IN ('single', 'double')),
    max_teams INT NOT NULL DEFAULT 8 CHECK (max_teams IN (4, 8, 16)),
    status TEXT NOT NULL DEFAULT 'registration' CHECK (status IN ('registration', 'matches', 'finished')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TEAMS TABLE
CREATE TABLE public.teams (
    id SERIAL PRIMARY KEY,
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    team_number INT NOT NULL,
    player1 TEXT,
    player2 TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. MATCHES TABLE
CREATE TABLE public.matches (
    id SERIAL PRIMARY KEY,
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    match_number INT NOT NULL,
    round INT NOT NULL,
    match_type TEXT,
    team_a_id INT REFERENCES public.teams(id) ON DELETE SET NULL,
    team_b_id INT REFERENCES public.teams(id) ON DELETE SET NULL,
    score_a INT DEFAULT 0,
    score_b INT DEFAULT 0,
    winner_team_id INT REFERENCES public.teams(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'ready', 'finished'))
);

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for public anon access
CREATE POLICY "Public access users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access tournaments" ON public.tournaments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access teams" ON public.teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access matches" ON public.matches FOR ALL USING (true) WITH CHECK (true);

-- Enable publication for Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournaments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
