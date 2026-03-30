-- Run this in Supabase → SQL Editor after creating a project.
-- Authentication → Providers: enable "Anonymous sign-ins" for zero-friction demos.

create table if not exists public.workspaces (
  user_id uuid primary key references auth.users (id) on delete cascade,
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists workspaces_updated_at_idx on public.workspaces (updated_at desc);

alter table public.workspaces enable row level security;

create policy "workspaces_select_own"
  on public.workspaces
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "workspaces_insert_own"
  on public.workspaces
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "workspaces_update_own"
  on public.workspaces
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
