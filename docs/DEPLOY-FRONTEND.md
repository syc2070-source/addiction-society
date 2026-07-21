# 프론트엔드(Vercel) 배포 가이드 — frontend-next

> 백엔드(Render) 배포는 `DEPLOY-RUNBOOK.md` 참고. 이 문서는 Next.js 프론트만 다룬다.
> 예상 소요: **Vercel 화면 작업 약 5분** + 첫 빌드 대기 2~3분.

## 0. 전제

- GitHub 레포 `syc2070-source/addiction-society`의 `frontend-next/`가 배포 대상.
- 백엔드 운영 API가 살아 있어야 한다: https://addiction-society-api.onrender.com/api/sources/summary → 200.
- 빌드는 로컬에서 검증됨 (`npm run build`). Vercel 쪽 특별 설정은 Root Directory와 환경변수 2개뿐.

## 1. Vercel 프로젝트 생성 (화면 작업, 1회)

1. https://vercel.com 로그인 (GitHub 계정 연동 권장).
2. **Add New… → Project** → `addiction-society` 레포 **Import**.
3. **Root Directory**: `Edit` 눌러 **`frontend-next`** 선택. ← 가장 중요. 이걸 안 하면 레포 루트에서 빌드가 실패한다.
4. Framework Preset은 자동으로 **Next.js** 감지됨 (그대로 둠). Build/Output 설정도 기본값 그대로.
5. **Environment Variables**에 아래 2개 입력:

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://addiction-society-api.onrender.com` |
   | `NEXT_PUBLIC_SITE_URL` | 일단 비워두거나 `https://addiction-society.vercel.app` 형태(3단계에서 실제 URL 확인 후 수정) |

6. **Deploy** 클릭 → 빌드 완료 대기 (2~3분).

## 2. 프리뷰 확인 (이번 범위의 끝)

배포 완료 화면의 URL(`https://<프로젝트명>.vercel.app`)에서:

- `/` → 한국어 홈, 관측소 카드에 "23개 소스" (운영 API 연동 확인)
- `/en` → 영어 홈
- `/sources` `/calendar` `/policy` `/research` `/recovery` 각각 렌더
- `/robots.txt`, `/sitemap.xml` 응답 확인

확인 후 **`NEXT_PUBLIC_SITE_URL`을 실제 배포 URL로 수정**하고 Redeploy
(Settings → Environment Variables → 수정 → Deployments에서 최신 배포 ⋯ → Redeploy).
이 값은 canonical·hreflang·sitemap에 들어가므로 실제 URL과 일치해야 한다.

## 3. 이후 자동 배포

`main`에 push하면 Vercel이 `frontend-next/` 변경을 감지해 자동 재배포한다.
(Render 백엔드도 같은 push로 자동 재배포 — 서로 독립.)

---

## 4. 도메인 전환 (addictionsociety.net) — ⚠️ 사용자 결정 후 진행

> 되돌리기 비싼 대외 노출 결정이므로 여기서 멈춘다. 진행 결정 시 아래 순서.

1. Vercel 프로젝트 → Settings → Domains → `addictionsociety.net` 추가.
2. 도메인 등록기관에서 Vercel이 안내하는 DNS 레코드(A 또는 CNAME) 설정.
3. `NEXT_PUBLIC_SITE_URL=https://addictionsociety.net` 으로 수정 후 Redeploy.
4. 기존 사이트(구 frontend)를 어디에 둘지 결정: 구 관리자(admin) 기능은 새 판에 아직
   없으므로, 구 프론트는 내부 URL로 당분간 유지 권장.
5. Search Console에 새 도메인 등록 + sitemap 제출.
