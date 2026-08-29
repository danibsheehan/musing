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

-- AI second-brain layer: embeddings, cached AI outputs, and usage/budget tracking.
-- Used by the musing-ai-service backend (service/) — not called directly by the FE.

create extension if not exists vector;

-- one row per embedded block chunk.
-- embedding dimension must match service/EMBEDDING_MODEL's output size —
-- voyage-3-lite (the default) outputs 512 dimensions. Changing EMBEDDING_MODEL
-- to a model with a different output size requires a matching migration here.
create table if not exists public.note_embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  page_id text not null,
  block_id text not null,
  content_hash text not null,
  embedding vector(512),
  created_at timestamptz not null default now(),
  unique (user_id, page_id, block_id, content_hash)
);

create index if not exists note_embeddings_embedding_idx
  on public.note_embeddings
  using ivfflat (embedding vector_cosine_ops);

alter table public.note_embeddings enable row level security;

create policy "note_embeddings_select_own"
  on public.note_embeddings
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "note_embeddings_insert_own"
  on public.note_embeddings
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "note_embeddings_update_own"
  on public.note_embeddings
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- cached summaries / AI outputs so repeats don't re-call the LLM
create table if not exists public.ai_outputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  page_id text not null,
  kind text not null,
  input_hash text not null,
  output jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, page_id, kind, input_hash)
);

alter table public.ai_outputs enable row level security;

create policy "ai_outputs_select_own"
  on public.ai_outputs
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "ai_outputs_insert_own"
  on public.ai_outputs
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "ai_outputs_update_own"
  on public.ai_outputs
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- per-user spend/usage tracking, enforced by musing-ai-service's budget middleware.
-- Anthropic (chat/summarize) and Voyage (embeddings) are billed separately, so each
-- gets its own counter/cap rather than one shared tokens_used.
create table if not exists public.ai_usage (
  user_id uuid primary key references auth.users (id) on delete cascade,
  period_start date not null default date_trunc('month', now()),
  anthropic_tokens_used bigint not null default 0,
  anthropic_requests_used int not null default 0,
  voyage_tokens_used bigint not null default 0,
  voyage_requests_used int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.ai_usage enable row level security;

create policy "ai_usage_select_own"
  on public.ai_usage
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "ai_usage_insert_own"
  on public.ai_usage
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "ai_usage_update_own"
  on public.ai_usage
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
