# 오늘의 기록

개인용 건강 기록 홈페이지 첫 작동 버전입니다.

## 실행

```bash
python3 -m http.server 4177
```

브라우저에서 `http://localhost:4177/`을 엽니다.

## Supabase

- 프로젝트: `daily-health-log-codex`
- URL: `https://uitjxkdhrbqkhsalmdeh.supabase.co`
- 테이블: `public.codex_records`
- migration: `supabase/migrations/20260529_codex_records.sql`

RLS는 `auth.uid() = user_id` 이면서 JWT email이 `harminis@gmail.com`인 사용자만 `select/insert/update/delete` 가능하도록 설정했습니다.

## 충돌 방지

이 프로젝트는 `codex_` prefix만 사용합니다.

- Supabase: `codex_records`, `codex_records_*`, `codex_set_updated_at`
- localStorage: `codex_daily_health_records_v1`, `codex_daily_health_settings_v1`
