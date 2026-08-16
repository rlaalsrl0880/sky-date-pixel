create table if not exists public.date_plans (
  id uuid primary key default gen_random_uuid(),
  date text not null,
  time text not null,
  activities jsonb not null default '[]'::jsonb,
  message text default '',
  created_at timestamptz not null default now()
);

alter table public.date_plans enable row level security;

drop policy if exists "Anyone can submit date plans" on public.date_plans;
create policy "Anyone can submit date plans"
on public.date_plans for insert
to anon, authenticated
with check (true);

drop policy if exists "Authenticated users can view date plans" on public.date_plans;
create policy "Authenticated users can view date plans"
on public.date_plans for select
to authenticated
using (true);
