# Sky Date — 초대장 서비스

기존 하늘색 픽셀 데이트 웹에 Supabase Auth와 초대별 고유 링크, 회원별 답변 대시보드를 추가했습니다.

## 기존 프로젝트에서 업데이트
1. 현재 작업 중인 프로젝트를 백업하세요.
2. 이 ZIP 안의 파일을 **기존 프로젝트 폴더에 덮어씁니다**. 기존 `.env.local`은 보존하세요.
3. Supabase Dashboard → SQL Editor → `supabase_invitation_migration.sql` 전체 실행. **기존 `supabase_legacy_DO_NOT_RUN.sql`은 실행하지 마세요.**
4. Supabase → Authentication → Providers → Email을 켜고, 테스트 시 이메일 인증 여부를 확인하세요.
5. `npm install` → `npm run build` → `npm run dev`.
6. `/`에서 회원가입 또는 로그인, 초대 생성 후 링크 복사, 시크릿 창에서 응답, 원래 대시보드에서 새로고침 확인.
7. `git add . && git commit -m "feat: multi-user invitations" && git push`로 Vercel 배포.

## 주의
- `?invite=<uuid>` 링크를 받은 사람은 로그인 없이 **한 번만** 답변할 수 있습니다.
- 각 회원은 자신의 초대/답변만 볼 수 있습니다(RLS).
- 링크를 가진 사람은 누구든 답변할 수 있습니다. 공유 대상을 주의하세요.
- 이전에 수집된 `date_plans` 데이터는 삭제하지 않지만 특정 회원에 자동 연결하지 않습니다.
- 기존 `.env.local`의 VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY를 그대로 사용합니다. 서버 관리자 키를 브라우저 환경변수에 넣지 마세요.
- 실서비스에서는 CAPTCHA, 요청 횟수 제한, 개인정보 안내 및 운영 모니터링을 추가하는 것이 좋습니다.
- 기존 프로젝트의 다른 변경 사항이 있다면 덮어쓰기 전에 diff를 확인하세요.

## DB 호환성 점검
- 기존 `activities text[]`와 `activities jsonb` 두 구조를 모두 처리하도록 응답 RPC를 수정했습니다.
- **이 ZIP은 정적 코드 검토본입니다.** 실제 Supabase DB 접속/SQL 실행 및 엔드투엔드 테스트는 수행하지 못했습니다.
- Supabase SQL Editor에서 마이그레이션을 실행하고 테스트 계정으로 초대 생성→시크릿 창 답변→대시보드 조회를 검증하세요.
