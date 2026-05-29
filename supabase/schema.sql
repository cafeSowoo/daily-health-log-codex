create table if not exists public.codex_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_date date not null,
  record_type text not null check (record_type in ('exercise', 'meal', 'alcohol', 'mood', 'weight', 'reading')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists codex_records_user_date_idx
  on public.codex_records (user_id, record_date desc, created_at desc);

create index if not exists codex_records_type_idx
  on public.codex_records (record_type);

create or replace function public.codex_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists codex_records_set_updated_at on public.codex_records;
create trigger codex_records_set_updated_at
  before update on public.codex_records
  for each row
  execute function public.codex_set_updated_at();

alter table public.codex_records enable row level security;

drop policy if exists "codex_records_select_owner" on public.codex_records;
drop policy if exists "codex_records_insert_owner" on public.codex_records;
drop policy if exists "codex_records_update_owner" on public.codex_records;
drop policy if exists "codex_records_delete_owner" on public.codex_records;

create policy "codex_records_select_owner"
  on public.codex_records
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and lower((select auth.jwt() ->> 'email')) = 'harminis@gmail.com'
  );

create policy "codex_records_insert_owner"
  on public.codex_records
  for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and lower((select auth.jwt() ->> 'email')) = 'harminis@gmail.com'
  );

create policy "codex_records_update_owner"
  on public.codex_records
  for update
  to authenticated
  using (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and lower((select auth.jwt() ->> 'email')) = 'harminis@gmail.com'
  )
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and lower((select auth.jwt() ->> 'email')) = 'harminis@gmail.com'
  );

create policy "codex_records_delete_owner"
  on public.codex_records
  for delete
  to authenticated
  using (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and lower((select auth.jwt() ->> 'email')) = 'harminis@gmail.com'
  );

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.codex_records to authenticated;
revoke all on public.codex_records from anon;
