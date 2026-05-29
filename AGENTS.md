Netlify production은 항상 lock 유지, 운영 배포할 때만 unlock/deploy/re-lock 원칙.

Codex 앱 번들 또는 설치본을 직접 패치/수정해야 하는 경우, 작업 전에 반드시 🚨 이모티콘을 포함해 실행 불능, 업데이트 충돌, 코드서명/무결성 문제 등의 위험이 있음을 명확히 고지하고 사용자 확인을 받은 뒤 진행할 것.

이 프로젝트에서는 다른 에이전트와 충돌하지 않도록 Codex 전용 `codex_` prefix가 붙은 Supabase 테이블, 정책, 함수, localStorage key만 생성/수정한다.
`cursor_`, `claude_`, prefix 없는 기존 테이블/정책/함수/Storage bucket은 생성/수정/삭제하지 않는다.
