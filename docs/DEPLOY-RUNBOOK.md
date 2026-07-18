# 배포 런북 — Supabase + Render (예상 15분)

중독사회 백엔드를 Supabase(DB) + Render(API 서버)로 올립니다.
**로컬 터미널 작업은 없습니다.** 마이그레이션·시딩은 **Render가 배포 때 자동 실행**합니다
(`preDeployCommand → backend/scripts/deploy-init.sh`, 전부 멱등이라 매 배포 안전).
사용자는 **Render 화면에서 env 값만 입력**하면 됩니다.

> 사전 준비: Supabase 프로젝트 1개 생성, 이 레포가 GitHub에 푸시됨(완료됨).

---

## 1) Supabase 접속정보 확인 — 약 3분

1. Supabase 대시보드 → 프로젝트 → 상단 **Connect** 클릭
2. **Session pooler**(또는 Direct) 항목에서 아래를 메모:
   - Host: 예) `aws-0-ap-southeast-1.pooler.supabase.com`
   - Port: `5432`
   - User: `postgres.<프로젝트ID>` (점 뒤까지 전부)
   - Database: `postgres`
   - Password: 프로젝트 생성 시 정한 DB 비밀번호

> 마이그레이션이 돌아야 하므로 **Session pooler(5432)** 또는 Direct connection을 쓰세요.
> Transaction pooler(6543)는 피하세요.

---

## 2) Render 배포 (Blueprint) — 약 8분

1. [Render 대시보드](https://dashboard.render.com) → **New +** → **Blueprint**
2. 레포 **`syc2070-source/addiction-society`** 선택 → Render가 루트 `render.yaml`을 읽음
3. 서비스 `addiction-society-api` 확인 후 **환경변수 값 입력**:

| 키 | 어디서 가져오나 |
|---|---|
| `DB_HOST` | Supabase Connect의 Host |
| `DB_PORT` | `5432` |
| `DB_USER` | `postgres.<프로젝트ID>` (점 뒤까지) |
| `DB_PASSWORD` | Supabase DB 비밀번호 |
| `DB_NAME` | `postgres` |
| `JWT_SECRET` | 기존 `backend/.env` 값 그대로 |
| `JWT_EXPIRES_IN` | 기존 `.env` 값 (예: `7d`) |
| `OPENAI_API_KEY` | 기존 `.env` 값 |
| `AUTO_COLLECT_ENABLED` | 기존 `.env` 값 (예: `true`) |
| `AUTO_COLLECT_CRON` | 기존 `.env` 값 (예: `0 3 * * *`) |
| `AUTO_COLLECT_TZ` | 기존 `.env` 값 (`Asia/Seoul`) |
| `STATORY_API_URL` | 기존 `.env` 값 (없으면 비움) |
| `STATORY_ACADEMIC_QUERY` | 기존 `.env` 값 (없으면 비움) |
| `STATORY_ACADEMIC_LIMIT` | 기존 `.env` 값 (없으면 비움) |
| `DISCORD_WEBHOOK_OBSERVATORY` | 기존 `.env` 값 (비우면 알림은 로그만) |

> `DB_SSL=true`, `DB_SYNCHRONIZE=false`는 `render.yaml`에 이미 박혀 있어 입력 불필요.
> `PORT`도 Render가 자동 주입합니다.

4. **Apply** → 빌드 후 **preDeployCommand가 자동으로** 마이그레이션·시딩을 실행합니다.

---

## 3) 첫 배포 로그에서 숫자 4개 확인 — 약 2분

Render 서비스 → **Logs** 탭(또는 Deploy 로그)에서 `[deploy-init]` 줄을 찾으세요.
아래가 보이면 성공입니다:

- `1/4 migration:run` → `Migration Baseline1784357488932 has been executed successfully.` (재배포 시엔 "No migrations pending")
- `2/4 seed:tags` → `테이블 총 17건`
- `3/4 seed:sources` → `테이블 총 23건` (scope: global 10 / regional 4 / korea 9)
- `4/4 backfill:next` → `채움 13 / null 10`
- 마지막에 `[deploy-init] 완료` → 이어서 서버 기동

> 이 초기화는 멱등이라 **재배포마다 안전하게 다시 실행**됩니다(중복·손상 없음).

---

## 4) ★ 플랜 경고 (반드시 읽기)

> **Render Free 플랜은 15분간 요청이 없으면 서버가 슬립합니다.**
> **그러면 매일 09:00(KST) 발표 감시 크론이 실행되지 않습니다.**
> 또한 **preDeployCommand는 유료(Starter+)에서만 동작**합니다.
> **발표 감시가 핵심이므로 반드시 `Starter` 이상을 선택하세요.**
> (`render.yaml`에 `plan: starter`로 지정해 두었습니다.)

---

## 5) 배포 후 검증 — 약 2분

서비스 URL(`https://addiction-society-api.onrender.com` 형태)에서:

1. **헬스체크**: `.../api/sources/summary` → `total: 23` JSON
2. **목록**: `.../api/sources` → 23건, `.../api/sources/calendar` → 13건
3. **알림 테스트**(웹훅 입력한 경우): Render 서비스 → **Shell** → `npm run monitor:once`
   → 로그 성공 + Discord 채널에 알림 도착 확인

---

## 6) 실패 시 롤백 — 약 1분

- preDeploy(초기화)가 실패하면 **배포가 중단되고 구버전이 유지**됩니다(자동 안전장치).
- **Render 서비스 삭제** = 원복 (서버만 사라지고 데이터는 그대로).
- **DB**는 Supabase에 독립적으로 남습니다.
- **로컬 원본 DB(`addiction_society`)는 이 과정에서 전혀 건드리지 않으므로 무손상**입니다.

---

## 부록

- 스키마 변경 규칙·신규 DB 절차: `docs/DB-MIGRATION.md`
- 자동 초기화 스크립트: `backend/scripts/deploy-init.sh`
- 런북의 npm 스크립트는 전부 `backend/package.json`에 실존:
  `migration:run`, `seed:tags`, `seed:sources`, `backfill:next`, `monitor:once`, `start:prod`, `build`.
