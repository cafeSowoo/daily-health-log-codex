create table if not exists public.codex_daily_feedbacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feedback_date date not null,
  input_snapshot jsonb not null default '{}'::jsonb,
  feedback_text text not null,
  model text not null default 'gpt-5-nano',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint codex_daily_feedbacks_user_date_key unique (user_id, feedback_date)
);

create index if not exists codex_daily_feedbacks_user_date_idx
  on public.codex_daily_feedbacks (user_id, feedback_date desc);

drop trigger if exists codex_daily_feedbacks_set_updated_at on public.codex_daily_feedbacks;
create trigger codex_daily_feedbacks_set_updated_at
  before update on public.codex_daily_feedbacks
  for each row
  execute function public.codex_set_updated_at();

alter table public.codex_daily_feedbacks enable row level security;

drop policy if exists "codex_daily_feedbacks_select_owner" on public.codex_daily_feedbacks;
drop policy if exists "codex_daily_feedbacks_insert_owner" on public.codex_daily_feedbacks;
drop policy if exists "codex_daily_feedbacks_update_owner" on public.codex_daily_feedbacks;
drop policy if exists "codex_daily_feedbacks_delete_owner" on public.codex_daily_feedbacks;

create policy "codex_daily_feedbacks_select_owner"
  on public.codex_daily_feedbacks
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and lower((select auth.jwt() ->> 'email')) = 'harminis@gmail.com'
  );

create policy "codex_daily_feedbacks_insert_owner"
  on public.codex_daily_feedbacks
  for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and lower((select auth.jwt() ->> 'email')) = 'harminis@gmail.com'
  );

create policy "codex_daily_feedbacks_update_owner"
  on public.codex_daily_feedbacks
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

create policy "codex_daily_feedbacks_delete_owner"
  on public.codex_daily_feedbacks
  for delete
  to authenticated
  using (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and lower((select auth.jwt() ->> 'email')) = 'harminis@gmail.com'
  );

grant select, insert, update, delete on public.codex_daily_feedbacks to authenticated;
revoke all on public.codex_daily_feedbacks from anon;
