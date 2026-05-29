alter table public.codex_records
  drop constraint if exists codex_records_record_type_check;

alter table public.codex_records
  add constraint codex_records_record_type_check
  check (record_type in ('exercise', 'meal', 'alcohol', 'mood', 'weight', 'reading'));
