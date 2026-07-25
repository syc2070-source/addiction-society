# AS-M3-0 — 지표 수집 파이프 설계 조사

> 성격: **설계 문서**(조사·제안). 실제 마이그레이션 실행·수집·삭제·LLM 이전은 **M3-1 이후**.
> 상위 기준: AS-MASTER-BLUEPRINT (제2장 /indicators, 제3장 P2, 제8장 원칙 3·4·5).
> 작성: AS-M3-0 (2026-07).

---

## 1. 기존 자산 재사용 조사

### 1-1. Statory 프록시 — 통계/관측치 엔드포인트 없음
- `reports.controller.ts`: `STATORY_API_URL/api/reports`(분석 리포트)만 프록시. **지표 값(관측치) 엔드포인트 없음.**
- `research-auto.service.ts`: `STATORY_API_URL/api/search/academic`(학술 검색)만 사용.
- 결론: Statory는 **분석 결과물(Lab)**과 **학술 검색**만 제공. **지표 수집엔 재사용할 소스가 없다.** 지표는 1차 소스(WHO/EUDA/공공데이터포털)에서 직접 수집해야 한다(원칙5와도 정합 — 1차 소스만 지표로).

### 1-2. 기존 international fetcher — 없음(수집 코드 부재)
- `grep` 결과 WHO/ILO/IMF/ECB/World Bank/KOSIS/ECOS/FRED 등 **관측치를 실제로 가져오는 fetcher는 없다.** sources.seed.ts는 소스 **메타데이터(URL·주기)**만 등록. WHO/EUDA는 문자열로만 등장.
- 재사용 가능한 HTTP 패턴: `collect-research.ts`(OpenAlex 페이지네이션·타임아웃·멱등 upsert)와 `check-urls.ts`(HEAD→GET·브라우저 UA·차단 판정)가 **수집 스크립트의 골격으로 재활용 가능**. observations 수집 스크립트도 동일 패턴(초기화→fetch→정규화→멱등 upsert→로그)으로 만든다.

### 1-3. AUTO_COLLECT — 흡수 불가, 폐기 대상
- `auto-collect.scheduler.ts`(매일 03시) → `research-auto.runOnce()` + `policy-auto.runOnce()`.
- 두 서비스의 기본 동작은 **데모/플레이스홀더 삽입**(`[자동수집] OECD…`, `[자동수집] WHO 알코올…`) — **원칙1(예시·가상 숫자 금지) 위반**. env URL(`AUTO_COLLECT_POLICY_URL/RESEARCH_URL`)이 있으면 외부 JSON을 긁지만 실제 운영 소스 없음.
- 지표 파이프로 **흡수 불가**: 서지/문서용이라 지표 스키마와 무관. → **폐기가 정답**(§4). 지표는 새 파이프(P2)로 신설.

---

## 2. 스키마 설계 (제안 — 마이그레이션 초안 작성, 실행은 M3-1)

파일:
- `src/indicators/entities/indicator.entity.ts`, `observation.entity.ts` (신규, 등록 완료)
- `src/migrations/drafts/1785000000000-CreateIndicatorsAndObservations.ts` (**초안 — 자동 실행 제외**)
- `data-source.ts` / `app.module.ts` entities 배열에 등록(9개로) — synchronize=false라 등록만으로 스키마 변화 없음.

### indicators (지표 = /indicators SEO 단위, 지표당 1페이지)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | serial PK | |
| **code** | varchar(100) UNIQUE | 안정 슬러그. SEO URL·멱등 upsert 키. 예 `who_alcohol_pcc` (블루프린트 "지표당 1페이지"를 위해 추가 — 판단) |
| domain | varchar(20) NOT NULL | D0~D3 |
| name_ko | varchar(300) NOT NULL | |
| name_en | varchar(300) | |
| unit | varchar(100) | 예 '순알코올 리터','%','명' |
| **definition_ko** | text **NOT NULL** | **원칙4 — 정의 없는 지표 금지** |
| method_note | text | 산출법·caveat |
| source_id | text FK→sources | **원칙5 — 1차 소스**. 파생지표는 null 허용(method_note에 근거) |
| created_at/updated_at | timestamp | |

### observations (관측치 = 시계열 한 점, **append-only**)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | serial PK | |
| indicator_id | int FK→indicators (CASCADE) | NOT NULL |
| source_id | text FK→sources (SET NULL) | 실측 출처 |
| geo | varchar(20) NOT NULL | ISO3('KOR') 또는 'KR'/시도 |
| period | varchar(20) NOT NULL | 'YYYY'|'YYYY-Qn'|'YYYY-MM' |
| value | numeric NOT NULL | |
| value_low / value_high | numeric | 95% CI 등 |
| qualifier | varchar(100) | 'sex=MLE','beverage=beer','provisional' |
| fetched_at | timestamptz NOT NULL default now() | append-only 키 |
| **source_url** | varchar(500) **NOT NULL** | **원칙3 — 원본 딥링크** |

**유니크 키**: `(indicator_id, source_id, geo, period, fetched_at)` — append-only.
**조회 인덱스**: `(indicator_id, geo, period)`.

### append-only(덮어쓰기 금지) 근거
1. **개정 추적**: WHO GHO·EUDA는 과거 연도 수치를 **재추정(개정)**한다. 덮어쓰면 "그 시점에 우리가 게시한 값"의 감사추적이 사라져 **원칙3(원본 딥링크)·정관2조(검수 신뢰)**와 충돌.
2. **키에 fetched_at 포함** → 같은 (지표·지역·기간)도 수집 시점이 다르면 새 행. 개정 이력이 그대로 남는다.
3. **표시 규칙**: (지표·지역·기간)별 **최신 fetched_at** 행을 노출. 필요 시 "값이 언제 바뀌었나"(개정 타임라인)까지 보여줄 수 있다 — 발표 감시 관측소의 차별 자산.
4. UPDATE 대신 INSERT만. 정정/철회는 새 행(qualifier='retracted' 등)으로 표현.

---

## 3. 첫 수집원 3개 실사 (실접근 확인 — 데이터 저장 안 함)

> 검증 도구: WebSearch/WebFetch(실네트워크). 3곳 모두 **데이터센터 봇을 403으로 차단**하나(law.go.kr·SAMHSA와 동일), **문서·API 규격은 확인**했다. 실제 수집은 인터넷이 열린 운영 환경(Render)에서 서버 fetch로 수행한다.

### a. EUDA Statistical Bulletin / EDR source data — ★ 최우선(가장 쉬움)
- **접근**: 오픈포맷. 표별로 **CSV 다운로드** + **방법론·정의·caveat 동봉**.
  - source-data 허브: `euda.europa.eu/data/source-data/edr/{year}/complete_en`
  - Statistical Bulletin: `euda.europa.eu/data/stats{year}_en`
  - 직접 CSV: `euda.europa.eu/data/csv_download/{tableId}_en?fids=...`
- **구조(문서 확인)**: 국가별 지표 — 약물사용 유병률, 치료수요(TDI), 약물유발사망, 감염병, 압수, 가격·순도. 각 표에 methods/definitions/caveats.
- **뽑을 지표(예, 3~5개)**: ① 대마·코카인·오피오이드 연간사용률(%), ② 약물유발사망(건/백만), ③ 치료수요 초회입소(명). **기간=연**, **geo=국가(ISO)**.
- **definition_ko 출처**: 각 표 동봉 methods/definitions → 번역.
- **인증키**: 불필요. **가장 먼저 자동화.**

### b. WHO GHO (GISAH) — OData API, 키 불필요
- **엔드포인트**: `https://ghoapi.azureedge.net/api` (인증 없음). 지표목록 `/api/Indicator`(IndicatorCode·IndicatorName·Language), 값 `/api/{IndicatorCode}`.
- **시험 지표**: `SA_0000001400` = *Alcohol, total per capita (15+) consumption (litres of pure alcohol)* = **SDG 3.5.2**.
- **응답 구조**: JSON `value[]`, 각 행 `SpatialDim`(국가 ISO3)·`TimeDim`(연)·`Dim1`(성별 MLE/FMLE/BTSX)·`NumericValue`·`Low`·`High`.
  → 우리 매핑: geo=SpatialDim, period=TimeDim, value=NumericValue, value_low/high=Low/High, qualifier=`sex=Dim1`.
- **뽑을 지표(예)**: ① 1인당 총알코올소비(SA_0000001400), ② 폭음률(HED), ③ 알코올사용장애 유병(있으면). **기간=연**, geo=국가.
- **definition_ko 출처**: WHO indicator-details 페이지의 정의문 → 번역. 라이선스 **CC BY-NC-SA 3.0 IGO(출처표시·비상업)** — 원칙7 준수.
- **인증키**: 불필요. (WebFetch는 403이나 Azure-CDN 봇차단일 뿐, 서버 fetch는 정상.)

### c. 공공데이터포털 kcgp_youth (청소년 도박문제 실태조사, id=15142248)
- **형태**: **파일데이터(fileData)** — 원자료 ZIP(설문 microdata + **코드북**). 통계청 승인 469001.
- **접근/인증**: **파일 단순 다운로드는 로그인·인증키 불필요.** (오픈API로 쓸 때만 포털 회원가입+서비스키 필요 — 이 데이터셋은 파일형이라 불필요.)
- **주의**: **개별응답 microcata**라 그대로는 지표가 아니다 → **집계 필요**(예: '청소년 도박문제 위험군 비율 %'). 집계 정의·문항은 **코드북 + KCGP 조사개요**(`kcgp.or.kr/portal/main/contents.do?menuNo=200238`)에서.
- **대안(더 쉬움)**: KCGP가 공표한 **집계 결과표**를 지표로 직접 등록(원자료 집계 대신). M3-1에서 택1.
- **뽑을 지표(예)**: 청소년 도박문제 위험군 비율(%), 최근1년 돈내기게임 경험률(%). **기간=조사연도(격년/연)**, geo=KR.
- **인증키**: 파일 다운로드 **불필요**. (오픈API 확장 시에만 필요.)

---

## 4. AUTO_COLLECT 폐기 계획 (실행은 M3-1)

D-post 진단(env 분기) 기준 영향 범위:

| 구분 | 대상 | 폐기 조치(M3-1) |
|---|---|---|
| 크론 | `auto-collect.scheduler.ts` (매일 03시) | 스케줄러 제거 또는 P2(지표)·P3(정책) 신 파이프로 교체 |
| 라우트 | `POST /api/research/auto-collect`, `POST /api/policy/documents/auto-collect` (둘 다 JwtAuthGuard) | 제거하거나 **명시적 수동 엔드포인트로 가드**(비활성 기본 + env 플래그) |
| 서비스 | `research-auto.service.ts`, `policy-auto.service.ts` | 데모 시드 삭제. 실 소스 있으면 신 파이프로 이관, 없으면 서비스 제거 |
| 모듈 | `scheduler.module.ts`(AutoCollectScheduler 등록) | 스케줄러 참조 정리 |
| env | `AUTO_COLLECT_ENABLED/CRON/TZ/POLICY_URL/RESEARCH_URL`, `STATORY_ACADEMIC_QUERY/LIMIT` | render.yaml·문서에서 제거 |
| 데이터 | documents/research의 `[자동수집]…` 데모행 | 운영 DB에서 정리 SQL(원칙1 위반분 제거) |

**수동 엔드포인트 가드 위치 제안**: 폐기 대신 남긴다면 `research.controller.ts`·`policy.controller.ts`의 `@Post('.../auto-collect')`에 **env 플래그 가드**(`AUTO_COLLECT_MANUAL_ENABLED!=='true' → 403`)를 추가하고, 크론(@Cron)만 제거. 기본은 완전 폐기 권장.

---

## 5. policy D×P — OpenAI → DeepSeek 이전 조사 (실행은 M3-1/2)

- **위치**: `src/policy/gpt-analysis.service.ts` 한 곳.
  - `new OpenAI({ apiKey: process.env.OPENAI_API_KEY })` (line 30)
  - `model: process.env.OPENAI_MODEL || 'gpt-4o-mini'` (line 46)
  - `chat.completions.create({ ..., response_format: { type: 'json_object' } })`
  - 호출부: `policy.controller.ts` `POST /api/policy/documents/:id/analyze`.
- **이전 방식(최소 변경)**: DeepSeek는 **OpenAI 호환 API**. openai SDK의 `baseURL`만 바꾸면 된다.
  - `new OpenAI({ apiKey: DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' })`
  - `model: DEEPSEEK_MODEL || 'deepseek-chat'`
  - `response_format: json_object` DeepSeek 지원(호환). 프롬프트·파싱 로직 **그대로**.
- **바꿀 지점**: `getOpenAI()`의 key/baseURL, model 라인 2곳. 블루프린트 제4장 LLM_POLICY 패턴에 맞춰 **env 키명 통일**(`LLM_POLICY_API_KEY`/`LLM_POLICY_BASE_URL`/`LLM_POLICY_MODEL`) 제안. OpenAI 폴백 유지 여부는 M3-1 결정.
- **주의**: `OPENAI_API_KEY`는 render.yaml에 이미 존재. DeepSeek 키 신규 발급 필요(사용자).

---

## 6. M3-1 실행 계획 초안 (순서)

1. **마이그레이션 활성화**: 초안을 `src/migrations/`로 이동 → `migration:run`(배포 자동). indicators/observations 생성.
2. **indicators 시드**: 첫 3~5개 지표를 정의(definition_ko)·단위·source_id와 함께 등록(멱등, code 기준).
3. **collect:observations (EUDA 먼저)**: CSV 파서 → 정규화(geo/period/unit) → append-only upsert(원칙3 source_url 필수). check-urls/collect-research 패턴 재사용.
4. **WHO GHO 수집**: OData `/{IndicatorCode}` → 매핑. CC BY-NC-SA 출처표시.
5. **kcgp_youth**: 집계표 등록(권장) 또는 microdata 집계. 파일 다운로드(키 불필요).
6. **/indicators 프론트**: 지표당 1페이지(SEO), 값마다 source_url 딥링크, 빈 상태 "수집 중".
7. **AUTO_COLLECT 폐기**(§4) + 데모행 정리.
8. **D×P DeepSeek 이전**(§5) — 병행 가능.

각 단계는 검수 게이트(원칙8): 신규 지표 첫 등록 시 사람 승인.

---

## 7. 사용자 사전 준비물

| 항목 | 필요 시점 | 비고 |
|---|---|---|
| **공공데이터포털 계정** | kcgp를 **오픈API**로 쓸 때만 | 파일 다운로드만 하면 **불필요** |
| 공공데이터포털 **서비스키** | 위와 동일(오픈API 확장 시) | data.go.kr 회원가입 후 발급 |
| **DeepSeek API 키** | D×P 이전(§5) | api.deepseek.com 발급. env에 주입 |
| WHO GHO | — | 키 불필요 |
| EUDA | — | 키 불필요 |

> 즉시 필요한 사용자 준비물: **없음**. EUDA·WHO는 키 없이 M3-1 착수 가능. DeepSeek 키와 data.go.kr 키는 해당 단계 도달 시 발급.
