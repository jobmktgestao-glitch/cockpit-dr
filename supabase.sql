-- ============================================
-- COCKPIT FINANCEIRO — DR MARKETING
-- Rode no SQL Editor do Supabase
-- ============================================

create table if not exists public.dr_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table public.dr_state enable row level security;

create policy "dr select proprio" on public.dr_state
  for select using (auth.uid() = user_id);

create policy "dr insert proprio" on public.dr_state
  for insert with check (auth.uid() = user_id);

create policy "dr update proprio" on public.dr_state
  for update using (auth.uid() = user_id);
