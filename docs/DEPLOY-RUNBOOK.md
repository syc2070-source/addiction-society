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

| 키 | 어디서 가져오나 | 필수 |
|---|---|---|
| `DB_HOST` | Supabase Connect의 Host | ✅ |
| `DB_PORT` | `5432` | ✅ |
| `DB_USER` | `postgres.<프로젝트ID>` (점 뒤까지) | ✅ |
| `DB_PASSWORD` | Supabase DB 비밀번호 | ✅ |
| `DB_NAME` | `postgres` | ✅ |
| `JWT_SECRET` | 임의의 긴 무작위 문자열 | ✅ **미설정 시 서버 기동 실패**(AS-FIX-1) |
| `JWT_EXPIRES_IN` | 예: `7d` | 선택(기본 24h) |
| `ADMIN_INVITE_CODE` | 임의의 긴 무작위 문자열 | 첫 관리자 생성 때만. **비우면 회원가입 완전 차단**(권장 상태) |
| `CORS_ORIGINS` | 쉼표 구분 출처 목록 | 선택. 비우면 addictionsociety.net·www·localhost:3000 + `*.vercel.app` |
| `LLM_POLICY_API_KEY` | DeepSeek API 키 (정책 D×P 분석) | 선택 |
| `STATORY_API_URL` | Statory API 주소 (분석실 /lab) | 선택. **없으면 /lab이 영구 빈 목록** |
| `DISCORD_WEBHOOK_OBSERVATORY` | Discord 웹훅 URL | 선택. 비우면 알림은 로그만 |
| `INDICATOR_PDF_CRON_ENABLED` | `true`로 바꾸면 PDF 추출 크론 가동 | 기본 `false` — 아래 3-2 참조 |
| `API_PUBLIC_URL` | Discord 검수 링크가 가리킬 API 주소 | 기본 `https://addiction-society-api.onrender.com` |
| `REVIEW_TOKEN_SECRET` | 검수 토큰 서명키 | 선택. 비우면 `JWT_SECRET`에서 파생 |

> ⚠️ `OPENAI_API_KEY`·`AUTO_COLLECT_*`·`STATORY_ACADEMIC_*`는 **AS-M3-1에서 폐기**되었습니다.
> 남아 있다면 지워도 됩니다(코드가 읽지 않습니다).

> `DB_SSL=true`, `DB_SYNCHRONIZE=false`는 `render.yaml`에 이미 박혀 있어 입력 불필요.
> `PORT`도 Render가 자동 주입합니다.

4. **Apply** → 빌드 후 **preDeployCommand가 자동으로** 마이그레이션·시딩을 실행합니다.

---

## 3) 첫 배포 로그 확인 — 약 2분

Render 서비스 → **Logs** 탭에서 `[deploy-init]` 줄을 찾으세요.

**필수 단계 (하나라도 실패하면 배포가 중단되고 구버전이 유지됨)**

- `1/4 migration:run` → `... has been executed successfully.` (재배포 시엔 "No migrations pending")
- `2/4 seed:tags` → `테이블 총 17건`
- `3/4 seed:sources` → `테이블 총 23건` (scope: global 10 / regional 4 / korea 9)
- `4/4 backfill:next` → `채움 13 / null 10`

**선택 단계 (AS-FIX-1 — 실패해도 배포는 계속. ⚠️ 로그만 남음)**

- `5/8 seed:recovery` → `73건`
- `6/8 collect:indicators` → 지표 3 / 관측치 3
- `7/8 seed:documents` → 후보 29건 URL 실검증 (봇 차단분은 `REG*`로 구제 등록)
- `8/8 collect:research` → OpenAlex 수집 건수

마지막 줄이 `[deploy-init] 완료 — 스키마·시드 전 단계 적용됨`이면 전부 성공,
`(선택 단계 N건 건너뜀 ⚠️)`이면 그 N건은 **다음 배포에서 자동 재시도**됩니다
(전부 멱등). 외부 사이트가 잠깐 죽었다고 배포를 막지 않기 위한 설계입니다.

> 선택 단계는 단계당 `DEPLOY_SOFT_TIMEOUT`(기본 420초) 상한이 걸려 있어
> preDeploy가 무한정 붙들리지 않습니다.

---

## 3-1) ★ DB를 처음부터 세우는 명령 순서 (AS-FIX-1)

**보통은 이 절을 볼 일이 없습니다** — 위 `deploy-init`이 매 배포마다 아래를 그대로 수행합니다.
DB를 새로 만들었거나, 백업에서 복구했거나, 로컬에 운영과 같은 상태를 만들고 싶을 때만
`backend/` 디렉터리에서 순서대로 실행하세요. **전부 멱등이라 몇 번을 돌려도 안전합니다.**

```bash
# 0) 접속 env 준비 (.env 또는 export)
#    DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME  (원격이면 DB_SSL=true)
#    JWT_SECRET  ← 없으면 서버가 기동하지 않습니다

# ── 필수: 스키마 + 소스 레지스트리 ──
npm run migration:run       # 스키마 (마이그레이션 10종)
npm run seed:tags           # 태그 17건
npm run seed:sources        # 소스 레지스트리 23건
npm run backfill:next       # next_expected_at 계산·지난 예정일 이월

# ── 자료 적재 (네트워크 필요한 것은 실패해도 무방, 나중에 재실행) ──
npm run seed:recovery       # 회복자원 73건   (로컬 JSON, 네트워크 불요)
npm run collect:indicators  # 지표 3 / 관측치 3 (로컬 JSON, 네트워크 불요)
npm run seed:documents      # 정책문서 ~29건  (URL 실검증 — 네트워크 필요)
npm run collect:research    # 연구자료        (OpenAlex — 네트워크 필요)

# ── 첫 관리자 만들기 (AS-FIX-1) ──
# 1. Render env에 ADMIN_INVITE_CODE=<임의 문자열> 설정 후 재배포
# 2. 가입 (role은 viewer로 생성됨)
curl -X POST https://addiction-society-api.onrender.com/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"<이메일>","password":"<비밀번호>","name":"<이름>","inviteCode":"<위 값>"}'
# 3. DB에서 승격 (쓰기 권한은 admin만)
#    UPDATE users SET role='admin' WHERE email='<이메일>';
# 4. ADMIN_INVITE_CODE를 다시 비우고 재배포 → 가입 완전 차단
```

기대 결과:

| 테이블 | 건수 |
|---|---|
| `sources` | 23 |
| `tags` | 17 |
| `recovery_resources` | 73 |
| `indicators` / `observations` | 3 / 3 |
| `documents` | 최대 29 (법률 6 + 소스 산출물 23. URL 검증 실패분은 보류) |
| `research` | OpenAlex 수집량에 따라 가변 |

---

## 3-2) ★ PDF 지표 추출 — 첫 실행과 크론 켜기 (AS-PDF-RUN)

PDF 표에서 뽑은 값은 기계 오독 위험이 있어 **항상 `pending`으로 들어가고 사람이
승인해야 공개**된다(원칙 8). 승인은 **Discord 알림의 링크 클릭**으로 끝난다 —
관리자 로그인이 필요 없다.

### ① 즉시 1회 실행 (크론을 기다리지 않고)

Render 서비스 → **Shell**:

```bash
npm run extract:pdf                    # 대상 소스·회차 전부
npm run extract:pdf -- kcgp_youth      # 그 소스의 모든 회차
npm run extract:pdf -- kcgp_youth 2024 # 특정 회차만
```

스크립트가 먼저 환경(python·pdfplumber·회차별 PDF URL 확정)을 점검해 출력한다.
`"ok": false`면 추출을 하지 않고 중단하므로, 빌드 로그의 `install-pdf-deps.sh`
결과를 먼저 확인하면 된다.

> Shell을 쓰는 것은 **첫 완주·재시도 부트스트랩**에 한정된다. 상시 운용은 크론이 한다.

### ② Discord 알림에서 검수

추출로 `pending`이 생기면 관측소 채널에 이런 알림이 온다:

```
🧾 지표 자동추출 — 검수 요망 (한국도박문제예방치유원 · 청소년 도박문제 실태조사)
회차 2022 · pending 신규 9 / 갱신 0
추출값 (지표 | 기간 | 분류 | 값):
· 청소년 도박문제 위험군(YELLOW) 비율 | 2022 | 전체 | 3.9%
· 청소년 도박문제 위험군(YELLOW) 비율 | 2022 | 남학생 | 5.1%
  … (최대 25줄, 초과분은 링크에서)
원본: https://www.data.go.kr/data/15142248/fileData.do
검수(승인/폐기): https://…/api/indicators/review/<서명토큰>
※ 승인 전까지 공개되지 않습니다. 링크는 14일 후 만료됩니다.
```

**값이 본문에 그대로 들어 있으므로 알림만 보고 원본과 대조**할 수 있다.
링크를 열면 값 표와 [승인하고 공개] / [폐기(비공개 유지)] 버튼이 나온다.
링크를 여는 것만으로는 아무것도 바뀌지 않는다(처리는 버튼 = POST).

- **승인** → 즉시 공개. Discord에 `✅ 지표 검수 승인 — N건 공개` 회신.
- **폐기** → 비공개 유지(삭제 아님 — 파서 수정의 근거로 남는다). `🗑️` 회신.
- 이미 처리한 링크를 다시 눌러도 0건(1회성).

### ③ 크론 켜기 — ①②가 실제로 동작한 뒤에

`INDICATOR_PDF_CRON_ENABLED=true`로 바꾸고 재배포한다. 켜기 전에 확인할 것:

| 확인 | 방법 |
|---|---|
| python·pdfplumber 준비됨 | `npm run extract:pdf`의 환경 점검 `"ok": true` |
| 회차별 PDF URL 확정됨 | 같은 출력의 `rounds[].resolvedUrl`이 null이 아님 |
| Discord 알림 도착 | ①을 돌렸을 때 채널에 검수 알림이 왔는지 |
| 검수 링크 동작 | 실제로 승인/폐기를 한 번 눌러 봤는지 |
| `API_PUBLIC_URL` 정확 | 알림 속 링크가 실제 서비스 주소인지 |

- **첫 크론 실행**: 켠 다음 달 **1일 04:00 (KST)**. 매월 1일 04시 고정.
- **예상 알림**: 대상 소스·회차마다 위 형태의 검수 알림 1건. 값이 그대로면
  `pending 신규 0 / 갱신 N`이 되고, 아무 변화가 없으면 알림을 보내지 않는다.
- **실패 시**: `⚠️ 지표 자동추출 실패 (소스 회차): 사유` 알림 + `/timeline`에 기록.
  회차 하나가 실패해도 나머지 회차는 계속 진행된다.

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
4. **보안 확인**(AS-FIX-1 — 반드시): 아래가 `403`이어야 정상입니다.
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' -X POST \
     https://addiction-society-api.onrender.com/api/auth/register \
     -H 'Content-Type: application/json' \
     -d '{"email":"probe@example.com","password":"probe1234","name":"probe","inviteCode":"guess"}'
   ```
   `200`이 나오면 `ADMIN_INVITE_CODE`가 노출된 것이니 즉시 교체하세요.
5. **미검수 자료 비노출 확인**: `.../api/research?status=all` 이 approved만 반환해야 합니다.

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
  `migration:run`, `seed:tags`, `seed:sources`, `backfill:next`, `seed:recovery`,
  `seed:documents`, `collect:research`, `collect:indicators`, `extract:pdf`,
  `monitor:once`, `start:prod`, `build`.
- 감사 보고서(문제 목록·확인용 SQL): `docs/AUDIT-2026-08.md`
