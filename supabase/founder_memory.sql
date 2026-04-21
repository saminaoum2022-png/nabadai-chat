create table if not exists public.founder_memory (
  memory_key text primary key,
  memory jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists founder_memory_updated_at_idx
  on public.founder_memory (updated_at desc);
