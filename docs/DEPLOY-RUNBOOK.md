# 배포 런북 — Supabase + Render (예상 30분)

중독사회 백엔드를 Supabase(DB) + Render(API 서버)로 올리는 순서입니다.
**로컬 원본 DB는 건드리지 않습니다.** 아래를 위에서부터 그대로 따라 하세요.
명령은 **Windows Git Bash** 기준입니다. 비밀번호 자리 `<PASSWORD>`는 실제 값으로 바꾸세요.

> 사전 준비: Supabase 프로젝트 1개 생성 완료, 이 레포가 GitHub에 푸시됨(완료됨).

---

## 1) Supabase 접속정보 확인 — 약 3분

1. Supabase 대시보드 → 프로젝트 → 상단 **Connect** 클릭
2. **Direct connection** (포트 **5432**) 항목에서 아래를 메모:
   - Host: `db.<프로젝트ref>.supabase.co`
   - Port: `5432`
   - User: `postgres`
   - Database: `postgres`
   - Password: 프로젝트 생성 시 정한 DB 비밀번호 (`<PASSWORD>`)

> ⚠️ 마이그레이션은 반드시 **Direct connection(5432)**. Pooler(6543)는 마이그레이션에서 문제 생길 수 있음.

---

## 2) 스키마 + 시드를 Supabase에 1회 주입 — 약 8분

Git Bash에서 `backend` 폴더로 이동 후, **이 터미널 세션에만** 접속정보를 설정합니다.

```bash
cd /c/addiction-society/backend

export DB_HOST=db.<프로젝트ref>.supabase.co
export DB_PORT=5432
export DB_USER=postgres
export DB_PASSWORD='<PASSWORD>'
export DB_NAME=postgres
export DB_SSL=true

npm ci                 # 의존성 (처음 1회)
npm run migration:run  # 전체 스키마 생성 (Baseline)
npm run seed:tags      # 기본 태그 17건
npm run seed:sources   # 데이터 관측소 소스 23건
npm run backfill:next  # next_expected_at 계산 (13건 채워짐)
```

> 끝나면 이 터미널을 **닫으세요**(export한 비밀번호가 세션에 남지 않도록).

---

## 3) 주입 결과 확인 — 약 2분

각 명령이 아래 숫자를 출력하면 성공입니다(스크립트가 직접 찍어 줍니다):

- `migration:run` → `Migration Baseline... has been executed successfully.`
- `seed:tags` → `[seed:tags] ... 테이블 총 17건`
- `seed:sources` → `[seed] ... 테이블 총 23건`
- `backfill:next` → `[backfill] ... 채움 13 / null 10`

추가 확인(선택): `npm run migration:show` → `[X] Baseline...` 표시.

---

## 4) Render 배포 (Blueprint) — 약 8분

1. [Render 대시보드](https://dashboard.render.com) → **New +** → **Blueprint**
2. 레포 **`syc2070-source/addiction-society`** 선택 → Render가 루트의 `render.yaml`을 읽음
3. 서비스 이름 `addiction-society-api` 확인 후, **환경변수 값 입력**:

| 키 | 어디서 가져오나 |
|---|---|
| `DB_HOST` | Supabase Connect → Direct connection 의 Host |
| `DB_PORT` | `5432` |
| `DB_USER` | `postgres` |
| `DB_PASSWORD` | Supabase DB 비밀번호 (`<PASSWORD>`) |
| `DB_NAME` | `postgres` |
| `JWT_SECRET` | 기존 `backend/.env`의 값 그대로 |
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
> `PORT`도 Render가 자동 주입하므로 입력하지 않습니다.

4. **Apply** → 첫 빌드/배포 시작(수 분 소요).

---

## 5) ★ 플랜 경고 (반드시 읽기)

> **Render Free 플랜은 15분간 요청이 없으면 서버가 슬립합니다.**
> **그러면 매일 09:00(KST) 발표 감시 크론이 실행되지 않습니다.**
> **발표 감시가 이 서비스의 핵심이므로 반드시 `Starter` 이상을 선택하세요.**
> (`render.yaml`에 `plan: starter`로 지정해 두었습니다. Free로 바꾸면 크론이 죽습니다.)

---

## 6) 배포 후 검증 — 약 5분

배포 완료 후 서비스 URL(`https://addiction-society-api.onrender.com` 형태)에서:

1. **헬스체크**: 브라우저로 `.../api/sources/summary` → `total: 23` JSON 표시
2. **목록**: `.../api/sources` → 23건
3. **크론/알림 1회 테스트** (Discord 웹훅을 넣은 경우):
   - Render 서비스 → **Shell** 탭에서 `npm run monitor:once`
   - 또는 로컬에서 원격 DB로: 2)의 export 후 `npm run monitor:once`
   - → 성공 로그 + (웹훅 설정 시) Discord 채널에 알림 도착 확인

---

## 7) 실패 시 롤백 — 약 2분

- **Render 서비스 삭제** = 원복 (서버만 사라지고 데이터는 그대로).
- **DB**는 Supabase에 독립적으로 남습니다. 필요하면 Supabase 테이블만 비우면 됩니다.
- **로컬 원본 DB(`addiction_society`)는 이 과정에서 전혀 건드리지 않았으므로 무손상**입니다.

---

## 부록: 명령이 실제로 존재하는지 (대조표)

런북에 쓰인 npm 스크립트는 전부 `backend/package.json`에 실존합니다:
`migration:run`, `migration:show`, `seed:tags`, `seed:sources`, `backfill:next`, `monitor:once`, `start:prod`, `build`.

스키마 변경 규칙·신규 DB 절차 상세는 `docs/DB-MIGRATION.md` 참고.
