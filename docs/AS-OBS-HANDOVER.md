# 중독사회 데이터 관측소 — 인수인계서 (AS-OBS)

> **수신**: Claude Code
> **레포**: `addiction-society` (branch: `master`)
> **작성일**: 2026-07-16
> **범위**: M0 (리스크 제거) → M1 (소스 레지스트리) → M2 (발표 감시 자동화)
> **선행 상태**: C-6-d1 완료 (`GET /api/reports` Statory 프록시). d2(보고서 전시 UI)는 미착수 — **본 작업과 무관, 건드리지 말 것**

---

## 0. 이 문서를 읽는 법

이 문서는 **3개 마일스톤**을 다룹니다. **반드시 M0 → M1 → M2 순서로**, 각 마일스톤이 끝날 때마다 멈추고 보고하십시오.

**절대 한 번에 다 하지 마십시오.** M0는 30분, M1은 반나절, M2는 하루 분량입니다.

---

## 1. 배경 — 왜 이걸 만드는가

중독사회(addictionsociety.net)는 현재 홈·연구자료·정책문서·회복자원 4개 페이지가 있습니다. 문제는 **데이터가 정적**이라는 것입니다.

세계 어디에도 "중독 전체(알코올·마약·도박·디지털)를, 한국 포함해서, 최신으로" 보여주는 곳이 없습니다:

| 기관 | 한계 |
|---|---|
| WHO | 도박 없음. SDG 지표에 미포함 |
| UNODC | 마약만 |
| EUDA | 유럽만 |
| Lancet 도박위원회 | 2024년 단발. WHO에 "도박을 전략에 포함하라" 공식 요청한 상태 |
| Global Drug Policy Index | 30개국, **한국 미포함**, 2021년이 마지막 |
| WHO ATLAS-SU | 2014년이 마지막 |
| 한국 | 6개 부처 분산, 법적 근거·데이터 체계가 달라 **정보 공유 불가** (복지부 2025 국감 답변) |

**우리가 할 일**: 흩어진 소스를 한 곳에서 감시·수집·게시한다. 지수(Index)를 만들지 않는다. **집계(aggregation)만으로 충분하다.**

---

## 2. 설계 원칙 — 위반 시 롤백

이 5개는 협상 대상이 아닙니다.

1. **예시 숫자 절대 금지.** 실제 값이 없으면 빈칸 + "수집 중". 스크린샷으로 유포되면 되돌릴 수 없다.
2. **모든 수치에 딥링크.** `source_url`을 화면에 노출. 클릭하면 원본으로.
3. **정의 없는 지표 금지.** `definition_ko`가 비면 발행 불가 — **DB 제약으로 강제**.
4. **불확실성 표시.** `value_low`/`value_high`가 있으면 반드시 UI에 표시.
5. **1차 소스 우선.** `reliability=1`만 지표로 사용. 언론 인용은 맥락 설명용.

### 기존 코딩 원칙 (레포 전체 공통)
- 코드를 읽고 행동할 것. 추측 금지.
- **추가 전용(add-only).** 기존 코드 삭제·수정 최소화.
- "지금만 넘기자" 절대 금지.
- 한국어 주석·문서.
- 최대값/최소값 (사이시옷 없음).

---

# M0 — 리스크 제거 (최우선, 30분)

## M0 목적

현재 홈페이지에 **가짜 숫자**가 노출돼 있습니다. 이것부터 지웁니다.

## M0-1. 삭제 대상 (전수 조사 후 제거)

프론트엔드에서 아래 문자열을 **전부 검색**하십시오:

```
73.4
정책 강도 지수
0.82        (광고 규제)
0.76        (베팅한도)
0.68        (데이터 접근권)
78          (영국 종합점수)
74          (호주 종합점수)
68          (한국 종합점수)
62          (미국 종합점수)
12개국
GLOBAL GAMBLING GOVERNANCE
v1.0 데이터 파일럿
```

**대상 섹션 2개:**

| 위치 | 현재 내용 | 조치 |
|---|---|---|
| 히어로 우측 카드 | "GLOBAL GAMBLING GOVERNANCE / 정책 강도 지수 73.4 / 광고 규제 0.82…" | **M0-2로 교체** |
| 하단 표 | "12개국 도박중독 거버넌스 데이터 허브(예시 구조)" — 영국78/호주74/한국68/미국62 | **M0-3으로 교체** |

> ⚠️ "예시"라고 표기돼 있어도 지웁니다. 캡처되면 끝입니다.

## M0-2. 히어로 우측 카드 → "관측소" 카드

같은 자리, 같은 스타일(다크 카드 + 그린 액센트)을 유지하되 내용만 교체합니다.

**이 단계에서는 하드코딩해도 됩니다.** M2에서 DB 연동으로 바꿉니다.

```
┌────────────────────────────────────┐
│ 중독 데이터 관측소          ● LIVE  │
│ 23개 소스 · 6개 부처 · 4개 국제기구  │
├────────────────────────────────────┤
│ 최근 갱신                           │
│ 2026-06-26  WHO SAFER 진행보고서    │
│ 2026-06-26  UNODC 세계마약보고서 2026│
│ 2026-06-09  EUDA 유럽마약보고서 2026 │
│ 2026-03-26  NIA 스마트폰 과의존 2025 │
├────────────────────────────────────┤
│ 다음 발표 예정                       │
│ 2026-07  SAMHSA NSDUH              │
│ 2026-10  국정감사 자료              │
│ 2026-11  HRI 해악감소 보고서        │
│ 미정     정신건강실태조사 (5년 주기)  │
└────────────────────────────────────┘
```

**위 날짜는 전부 실제 확인된 사실입니다.** 임의로 바꾸지 마십시오.

## M0-3. 하단 12개국 표 → 부처 분산 지도

12개국 비교보다 이게 먼저입니다. **국내 독자에게 훨씬 강력하고, 데이터가 진짜입니다.**

```
제목: 한국의 중독 대응은 6개 부처로 흩어져 있습니다

| 중독 유형        | 소관 부처         | 집행 기관                    |
|-----------------|------------------|----------------------------|
| 알코올·마약(치료) | 보건복지부        | 중독관리통합지원센터 63개소    |
| 도박            | 국무총리실        | 사감위 → 한국도박문제예방치유원 |
| 인터넷·스마트폰  | 과학기술정보통신부 | 스마트쉼센터                 |
| 게임            | 문화체육관광부     | 게임과몰입힐링센터            |
| 마약(수사)       | 대검·경찰·관세·해경 | 마약범죄 정부합동수사본부      |
| 마약(예방)       | 식품의약품안전처   | 한국마약퇴치운동본부          |

인용구 (강조 박스):
"부처별 소관 법률이 달라 협력 체계를 구축하기 어렵다"
— 보건복지부 관계자, 2025 국정감사

각주:
법적 근거와 데이터 체계가 달라 정보 공유조차 불가능하며,
청소년 1명을 초기 상담부터 치료·사후관리까지 연속 지원할
통합 시스템은 부재.
```

## M0-4. 유지할 것 (건드리지 말 것)

- ✅ 다크 네이비 + 블루/그린 액센트 색상 체계
- ✅ 히어로 헤드라인: "중독은 개인의 도덕 실패가 아니라, 사회 전체의 구조적 위험 시그널입니다."
- ✅ "왜 '중독사회'인가" 섹션 (개인의 위험 / 구조적 위험 2단)
- ✅ Phase 1-2-3 로드맵 섹션
- ✅ 상단 네비 (홈/연구자료/정책문서/회복자원/보고서)
- ✅ CTA 버튼 2개

## M0 산출물

- 변경 파일 목록 + 라인 수
- 삭제한 예시 숫자 전수 목록 (파일·라인)
- 스크린샷 불가하면 변경 후 JSX/HTML 발췌

**M0 커밋**: `AS-OBS-M0: 예시 지수 제거, 관측소 카드·부처 분산 지도로 교체`

**여기서 멈추고 보고하십시오.**

---

# M1 — 소스 레지스트리 (반나절)

## M1 목적

**이게 프로젝트의 심장입니다.** 감시할 소스 23개를 DB에 정의합니다.

## M1-1. 스키마

기존 TypeORM 패턴을 따르십시오. (`app.module.ts`의 `synchronize` 설정 확인 후 결정 — 켜져 있으면 엔티티만, 꺼져 있으면 마이그레이션 작성)

```typescript
// src/modules/sources/entities/source.entity.ts

@Entity('sources')
export class Source {
  @PrimaryColumn('text')
  id: string;                    // 'who_gho_alcohol_apc'

  @Column('text')
  org: string;                   // 'WHO'

  @Column('text')
  org_ko: string;                // '세계보건기구'

  @Column('text')
  domain: string;                // alcohol|drug|gambling|digital|tobacco|policy|multi

  @Column('text')
  scope: string;                 // global|regional|korea

  @Column('text')
  kind: string;                  // prevalence|policy|treatment|market|enforcement

  @Column('text')
  title_ko: string;

  @Column('text')
  title_en: string;

  @Column('text')
  url: string;

  @Column('text')
  access_method: string;         // api|csv|pdf|html|manual

  @Column('jsonb', { nullable: true })
  access_detail: Record<string, any>;   // 엔드포인트, 셀렉터, 파일패턴

  @Column('text')
  cadence: string;               // monthly|quarterly|annual|biennial|quinquennial|irregular

  @Column('int', { array: true, nullable: true })
  expected_month: number[];      // [6] = 매년 6월

  @Column('timestamptz', { nullable: true })
  last_checked_at: Date;

  @Column('date', { nullable: true })
  last_published_at: Date;       // 소스가 발표한 최신일

  @Column('date', { nullable: true })
  next_expected_at: Date;

  @Column('text', { default: 'active' })
  status: string;                // active|stale|dead

  @Column('text', { nullable: true })
  license: string;               // 'CC BY-NC-SA 3.0 IGO'

  @Column('int', { nullable: true })
  reliability: number;           // 1(1차) 2(기관2차) 3(언론)

  @Column('text', { nullable: true })
  etag: string;                  // 변경 감지용

  @Column('text', { nullable: true })
  content_hash: string;          // 변경 감지용

  @Column('text', { nullable: true })
  notes: string;
}
```

## M1-2. 시딩 데이터 — 23개 소스 (전부 실제 확인됨)

시드 스크립트를 작성하십시오. `src/modules/sources/seed/sources.seed.ts`

### 국제 (12개)

| id | org | org_ko | domain | scope | kind | cadence | exp_month | access | reliab |
|---|---|---|---|---|---|---|---|---|---|
| `unodc_wdr` | UNODC | 유엔마약범죄사무소 | drug | global | prevalence | annual | [6] | csv | 1 |
| `unodc_wdr_trends` | UNODC | 유엔마약범죄사무소 | drug | global | market | annual | [6] | csv | 1 |
| `euda_statbulletin` | EUDA | 유럽연합마약청 | drug | regional | prevalence | annual | [6] | csv | 1 |
| `euda_edr` | EUDA | 유럽연합마약청 | policy | regional | policy | annual | [6] | pdf | 1 |
| `who_gho_alcohol` | WHO | 세계보건기구 | alcohol | global | prevalence | irregular | null | api | 1 |
| `who_gho_substance` | WHO | 세계보건기구 | policy | global | policy | irregular | null | api | 1 |
| `who_atlas_su` | WHO | 세계보건기구 | policy | global | treatment | irregular | null | api | 1 |
| `who_safer` | WHO | 세계보건기구 | alcohol | global | policy | irregular | null | pdf | 1 |
| `who_whs` | WHO | 세계보건기구 | multi | global | prevalence | annual | [5] | pdf | 1 |
| `lancet_gambling` | Lancet | 랜싯공중보건위원회 | gambling | global | prevalence | irregular | null | manual | 1 |
| `hri_gshr` | HRI | 국제해악감소협회 | policy | global | policy | biennial | [11] | pdf | 2 |
| `gdpi` | HRC | 해악감소컨소시엄 | policy | global | policy | irregular | null | pdf | 2 |

**URL 및 상세:**
```
unodc_wdr          https://www.unodc.org/unodc/en/data-and-analysis/world-drug-report-2026.html
unodc_wdr_trends   https://data.unodc.org/wdr2026trends
                   access_detail: { note: "인터랙티브 플랫폼, 엑셀 다운로드 제공" }
euda_statbulletin  https://www.euda.europa.eu/publications/european-drug-report/2026_en
                   access_detail: { format: "CSV", note: "오픈포맷, 방법론·정의·유의사항 동봉. 최우선 자동화 대상" }
euda_edr           https://www.euda.europa.eu/publications/european-drug-report/2026_en
who_gho_alcohol    https://www.who.int/data/gho/data/themes/global-information-system-on-alcohol-and-health
                   access_detail: { note: "GISAH. 150+ 지표, 225개국+" }
who_gho_substance  https://www.who.int/data/gho/data/indicators/indicators-index
who_atlas_su       https://www.who.int/data/gho/data/themes/resources-for-substance-use-disorders
                   notes: "⚠️ 최신 데이터 2014년 ATLAS-SU 조사. 정책 자원을 국가별 비교한 유일 전수 데이터"
who_safer          https://www.who.int/initiatives/SAFER
                   last_published_at: 2026-06-26
                   notes: "2026.6.26 신규 발간. 알코올만 SDG 목표 궤도에 오른 이유"
who_whs            https://www.who.int/data/gho/publications/world-health-statistics
lancet_gambling    https://www.thelancet.com/commissions-do/gambling
                   last_published_at: 2024-10-24
hri_gshr           https://hri.global/flagship-research/the-global-state-of-harm-reduction/
                   last_published_at: 2025-12-03
                   notes: "2년 주기(2024년 9판) + 중간연도 업데이트"
gdpi               https://globaldrugpolicyindex.net/
                   last_published_at: 2021-11-08
                   notes: "⚠️ 30개국, 한국 미포함. 75개 지표 5개 차원"
```

**라이선스**: WHO 발간물 대부분 `CC BY-NC-SA 3.0 IGO` — **출처표시 필수, 상업적 이용 금지**. 이 컬럼 반드시 채우십시오.

### 미국 (2개)

| id | org | org_ko | domain | scope | kind | cadence | exp_month | access | reliab |
|---|---|---|---|---|---|---|---|---|---|
| `samhsa_nsduh` | SAMHSA | 미국약물남용정신건강청 | multi | regional | prevalence | annual | [7] | csv | 1 |
| `samhsa_nsumhss` | SAMHSA | 미국약물남용정신건강청 | treatment | regional | treatment | annual | null | csv | 1 |

```
samhsa_nsduh    https://www.samhsa.gov/data/data-we-collect/nsduh-national-survey-drug-use-and-health
                notes: "1971년부터. 미국 1차 통계 출처"
samhsa_nsumhss  https://www.samhsa.gov/data/all-reports
                notes: "치료시설 전수조사. 한국에 없는 것"
```

### 한국 (9개)

| id | org | org_ko | domain | scope | kind | cadence | exp_month | access | reliab |
|---|---|---|---|---|---|---|---|---|---|
| `spo_drug_monthly` | 대검찰청 | 대검찰청 | drug | korea | enforcement | **monthly** | [1..12] | pdf | 1 |
| `drugfree_stats` | 마약퇴치운동본부 | 한국마약퇴치운동본부 | drug | korea | enforcement | monthly | [1..12] | html | 2 |
| `ngcc_gambling` | 사감위 | 사행산업통합감독위원회 | gambling | korea | market | annual | null | pdf | 1 |
| `kcgp_youth` | 도박예방치유원 | 한국도박문제예방치유원 | gambling | korea | prevalence | annual | [2] | csv | 1 |
| `kcgp_rehab` | 도박예방치유원 | 한국도박문제예방치유원 | gambling | korea | treatment | annual | null | csv | 1 |
| `ncmh_mhs` | 국립정신건강센터 | 국립정신건강센터 | alcohol | korea | prevalence | **quinquennial** | null | pdf | 1 |
| `nia_smartphone` | NIA | 한국지능정보사회진흥원 | digital | korea | prevalence | annual | [3] | pdf | 1 |
| `kocca_game` | KOCCA | 한국콘텐츠진흥원 | digital | korea | prevalence | annual | [12] | pdf | 2 |
| `mohw_addiction_center` | 보건복지부 | 보건복지부 | policy | korea | treatment | annual | [10] | manual | 1 |

```
spo_drug_monthly  https://www.spo.go.kr/site/spo/ex/board/List.do?cbIdx=1201
                  access_detail: { doc: "마약류 월간동향", parser: "pdfplumber",
                    tables: ["월간 단속현황","연간 누계","유형별","연령별","성별","직업별","지역별","외국인","압수현황"] }
                  notes: "★자동화 1순위. 월 단위 시계열 확보 가능"

drugfree_stats    https://www.drugfree.or.kr/portal/kor/M467848284/board.do
                  notes: "대검 통계 미러. HTML 테이블 → cheerio. spo_drug_monthly 백업"

ngcc_gambling     https://www.ngcc.go.kr/
                  notes: "합법 사행산업 25.3조(2024). 불법도박 102.7조(2022 제5차 실태조사)"

kcgp_youth        https://www.data.go.kr/data/15142248/fileData.do
                  access_detail: { portal: "공공데이터포털", raw_data: true }
                  notes: "★Raw Data 공개. API 연동 가능"

kcgp_rehab        https://www.data.go.kr/data/15012875/fileData.do

ncmh_mhs          https://mhs.ncmh.go.kr/
                  last_published_at: 2021-12-27
                  notes: "⚠️★2026년판 임박. 5년 주기(2001→2006→2011→2016→2021).
                          2025.10 연구성과 발표회 개최됨. 알코올사용장애 평생유병률 11.6%(정신질환 1위),
                          정신과 방문율 8.1%(기분장애 40.4% 대비 최저). 발표 시 즉시 기사화"

nia_smartphone    https://www.nia.or.kr/site/nia_kor/ex/bbs/List.do?cbIdx=65914
                  last_published_at: 2026-03-27
                  notes: "2025년판 발표됨. 전체 22.7%(5년 연속 하락), 청소년 43%(역행)"

kocca_game        https://welcon.kocca.kr/
                  last_published_at: 2025-12-18
                  notes: "이용률 중심. 과몰입 지표 약함 — reliability 2"

mohw_addiction_center  https://www.mohw.go.kr/menu.es?mid=a10706040400
                  access_detail: { source: "국정감사 요구자료", route: "국회 보건복지위" }
                  notes: "★센터 63개소, 예산 55.85억(+57.4%), 인력 258명,
                          청소년 등록자 4년 누적 89명. 국정감사가 금광"
```

## M1-3. `/sources` 공개 페이지

**이게 의외의 킬러 콘텐츠입니다.** "중독 통계 어디서 찾나요?"의 답이 세상에 없습니다.

기존 `PolicyList.tsx` 패턴을 클론하십시오 (검색·필터·카드 UI 이미 있음).

- 필터: 도메인(알코올/마약/도박/디지털/정책), 범위(국제/한국), 주기
- 카드: 기관 뱃지, 제목(ko), 주기, 최근 발표일, 다음 예정일, 신뢰도 뱃지, 원본 링크
- 정렬: `next_expected_at` 오름차순 (임박한 것 먼저)
- `status='stale'`이면 회색 처리 + "갱신 지연" 뱃지

**nav에 탭 추가하지 마십시오.** 일단 `/sources` 직접 접근만. nav 정리는 M3에서.

## M1-4. API

```
GET /api/sources              목록 (필터: domain, scope, cadence, status)
GET /api/sources/:id          상세
GET /api/sources/calendar     발표 예정 (next_expected_at 기준 정렬)
```

기존 `reports.controller.ts` 패턴 참고.

## M1 산출물

- 마이그레이션 or 엔티티 파일
- 시드 스크립트 + 실행 결과 (23행 확인)
- `/api/sources` 응답 샘플
- `/sources` 페이지 스크린샷 or JSX

**M1 커밋**: `AS-OBS-M1: sources 레지스트리 + 23개 시딩 + /sources 공개 페이지`

**여기서 멈추고 보고하십시오.**

---

# M2 — 발표 감시 자동화 (하루)

## M2 목적

**핵심 설계: "발표 감시"와 "데이터 수집"을 분리합니다.**

대부분의 소스는 연 1회입니다. 크롤러를 매일 돌릴 필요가 없습니다. 먼저 **언제 나오는지 아는 것**부터 합니다.

## M2-1. 감시 크론

```typescript
// src/modules/sources/sources.scheduler.ts

@Injectable()
export class SourcesScheduler {
  // 매일 09:00 KST
  @Cron('0 9 * * *', { timeZone: 'Asia/Seoul' })
  async watchSources() {
    const due = await this.sourceRepo.find({
      where: {
        status: 'active',
        next_expected_at: LessThanOrEqual(addDays(new Date(), 30)),
      },
    });

    for (const s of due) {
      if (s.access_method === 'manual') continue;   // 수동 소스는 알림만

      const changed = await this.hasChanged(s);     // ETag → Last-Modified → 해시
      if (changed) {
        await this.notifyDiscord(s);
        s.last_checked_at = new Date();
        await this.sourceRepo.save(s);
      }
    }
  }

  private async hasChanged(s: Source): Promise<boolean> {
    // 1. HEAD 요청 → ETag 비교
    // 2. ETag 없으면 Last-Modified 비교
    // 3. 둘 다 없으면 GET → 본문 해시 비교 (content_hash)
    // 실패 시 false 반환 + 로그. 절대 throw하지 말 것 (크론 죽음)
  }
}
```

**주의사항:**
- User-Agent 명시: `AddictionSociety-Observatory/1.0 (+https://addictionsociety.net)`
- 요청 간 최소 2초 간격 (rate limit 예의)
- 타임아웃 30초
- 실패해도 크론 전체가 죽지 않게 try/catch로 소스별 격리
- 실패 3회 연속 → `status='stale'` 전환

## M2-2. `next_expected_at` 자동 계산

```typescript
function computeNextExpected(s: Source): Date | null {
  if (!s.expected_month?.length) return null;
  if (!s.last_published_at) return null;

  const lastYear = s.last_published_at.getFullYear();
  const candidates = s.expected_month.map(m =>
    new Date(lastYear + (s.cadence === 'monthly' ? 0 : 1), m - 1, 1)
  );
  // monthly면 다음 달, 나머지는 내년 같은 달
  return candidates.find(d => d > new Date()) ?? null;
}
```

`cadence='quinquennial'` (정신건강실태조사) → +5년.
`cadence='irregular'` → null, 감시만.

## M2-3. Discord 알림

**기존 Statory Discord 서버를 재사용하십시오.** 새 채널 `#중독사회-관측소` 하나 추가.

```
📢 소스 갱신 감지

기관: 국립정신건강센터
자료: 정신건강실태조사
주기: 5년 (마지막 2021-12-27)
링크: https://mhs.ncmh.go.kr/

⚠️ 이 소스는 알코올사용장애 유병률·치료율 갱신 대상입니다.
   즉시 확인 요망.
```

환경변수: `DISCORD_WEBHOOK_OBSERVATORY`

## M2-4. `/calendar` 페이지

발표 예정 달력. 심플하게 시작:

```
2026년 하반기 발표 예정

7월  ▸ SAMHSA NSDUH 2025                    [미국]
10월 ▸ 국정감사 자료 (중독관리통합지원센터)   [한국] ★
11월 ▸ HRI 해악감소 보고서 (10판)            [국제]
12월 ▸ KOCCA 게임이용자 실태조사              [한국]

미정 ▸ 정신건강실태조사 (5년 주기, 2021 이후) [한국] ★★
```

★ = `reliability=1` AND 한국 소스 (기사화 우선순위)

## M2-5. 히어로 카드 DB 연동

M0에서 하드코딩한 관측소 카드를 실제 데이터로 교체:

```
GET /api/sources/summary
→ {
    total: 23,
    by_scope: { global: 12, regional: 2, korea: 9 },
    recent: [ ...last_published_at DESC LIMIT 4 ],
    upcoming: [ ...next_expected_at ASC LIMIT 4 ]
  }
```

## M2 산출물

- 스케줄러 코드
- **첫 자동 알림 성공 스크린샷** ← 이게 마일스톤
- `/calendar` 페이지
- 히어로 카드 DB 연동 확인

**M2 커밋**: `AS-OBS-M2: 소스 감시 크론 + Discord 알림 + /calendar + 히어로 DB 연동`

---

# 3. 이후 로드맵 (참고, 착수 금지)

| 마일스톤 | 내용 | 시점 |
|---|---|---|
| **M3** | Tier1 수집 (EUDA CSV, WHO GHO API, 공공데이터포털) + `indicators`/`observations` 테이블 | 6주 |
| **M4** | 대검 월간동향 PDF 파서 → 월 단위 시계열 (온라인 마약사범 21.4%→31.6% 차트) | 8주 |
| **M5** | 국제 비교 (한국 도박 5.3% vs Lancet 1.4%). **"비교"이지 "점수"가 아님** | 12주 |
| **M6** | 자체 지표 (조건: 정의 공개 + 가중치 근거 + 원데이터 다운로드 + 외부 검토 1인) | 6개월 |

## M3에서 쓸 스키마 (미리 참고만)

```sql
create table indicators (
  id            text primary key,
  domain        text,
  name_ko       text,
  name_en       text,
  unit          text,                    -- '%', '명', '조원', '리터'
  definition_ko text not null,           -- ★ NOT NULL 강제
  method_note   text
);

create table observations (
  indicator_id text references indicators(id),
  source_id    text references sources(id),
  geo          text,                     -- 'KR','GLOBAL','WHO_WPR','EU'
  period       text,                     -- '2024','2024-06','2021-2024'
  value        numeric,
  value_low    numeric,
  value_high   numeric,
  qualifier    text,                     -- 'estimate','provisional','break_in_series'
  fetched_at   timestamptz,
  source_url   text not null,            -- ★ 딥링크 강제
  primary key (indicator_id, source_id, geo, period)
);
```

---

# 4. 부록 — 검증된 사실 자산

M0-M2에서 화면에 쓸 수 있는 **실제 수치**입니다. 전부 2026-07-16 검색으로 확인됨.

## 한국 — 정책 실패

| 항목 | 2019 | 2025 |
|---|---|---|
| 중독관리통합지원센터 | 50개소 | 63개소 |
| 예산 | 35.48억 | 55.85억 (+57.4%) |
| 전담인력 | 180명 | 258명 (+43.3%) |
| 청소년 인터넷·게임 중독 등록자 (2021–24 4년 누적) | — | **89명** |

- 전담인력 1인당 관리 대상 **0.06명** = 전문인력 16명이 청소년 1명
- 부산·대구·대전·울산·세종: 4년간 **0명**
- 출처: 보건복지부 → 김미애 의원실, 2025 국정감사
- 법적 근거: 정신건강복지법 제15조의3 — **"설치·운영할 수 있다"** (의무 아님)

## 한국 — 도박

- 유병률 5.3%(2020) / 일반국민 5.5%(2022) — **해외 주요국 대비 2~3배**
- 학교 밖 청소년 12.6% (2020년 6.9% → 2022년 12.6%)
- **연령 역전**: 초등 6% > 중등 5.1% > 고등 3.2%
- 합법 사행산업 25.3조 (2024) / **불법도박 102.7조 (2022)** = 4배
- 청소년 상담 4,042건 → **8,915건** (1년 만에 2배 이상)

## 한국 — 알코올

- 알코올사용장애 평생유병률 **11.6%** (2021) — 모든 정신질환 중 **1위**
- 정신과 전문의 방문율 **8.1%** ← 기분장애 40.4%, 조현병 32.1%, 불안장애 19.3%
- 젊은 여성 역주행: 30–39세 1.4%(2001) → 2.8%(2016) = 2배

## 한국 — 마약

- 마약사범 23,403명 검거 (2025)
- **온라인 마약사범 비중**: 21.4%(2020) → 24.0% → 25.0% → 25.3% → **31.6%(2024)**
- 국경단계 적발: 10개월 1,181건/3,233kg — 건수 +22%, **중량 +307%**

## 한국 — 디지털

- 스마트폰 과의존위험군 전체 **22.7%** (2025, 5년 연속 하락)
- **청소년 43%** (연령대 중 최고, 역행 중)
- 기타중독(인터넷·스마트폰) 경험률 6.4%(2022) → **18.4%(2024)** = 3배

## 국제 — 치료율 삼각편대 (핵심 서사)

| 출처 | 지표 | 값 |
|---|---|---|
| WHO | 알코올사용장애 치료 접촉 (세계 중앙값) | **3.2%** |
| WHO | 약물사용장애 치료 접촉 (세계 중앙값) | 10.0% |
| UNODC | 마약사용장애 치료 (여성) | **23명 중 1명** |
| UNODC | 마약사용장애 치료 (남성) | 9명 중 1명 |
| 한국 | 알코올사용장애 정신과 방문 | **8.1%** |

- WHO SDG 3.5 설문 응답 145개국 중 **약 40%가 데이터 미수집**
- WHO는 이 지표를 "명시적 수치 목표 없음"으로 **SDG 진행평가에서 제외**

## 국제 — 마약 (UNODC 2026, 3주 전)

- 전 세계 사용자 **3억 3,100만 명** (2024) = 15–64세의 6.2%, 10년 전 5.2%
- 대마 2.56억 / 아편류 6,300만 / 암페타민 3,200만 / 코카인 2,500만 / 엑스터시 2,100만
- NPS 755종 (2024), 그중 118종 최초 보고
- 압수물 내 약물 종류 = 2000년 이전의 **5배**

## 국제 — 도박 (Lancet 2024)

- 피해 경험 **4.5억 명** / 도박장애 **8,000만 명**
- 성인 1년 도박 경험률 46.2% / **청소년 17.9%**
- 온라인 카지노·슬롯 이용자 중 도박장애 **15.8%**
- 스포츠베팅 이용자 중 8.9%
- 도박 합법 국가 **80% 이상**
- 위원회가 **WHO에 "도박을 전략에 포함하라" 공식 요청**

## 국제 — 알코올 (유일한 성공)

- WHO 검토 SDG 지표 중 **목표 궤도에 오른 유일한 지표**
- 1인당 소비 5.7L(2010) → **5.0L(2022)**, 2030년 4.6L 전망 = 20% 감축 달성 가능
- 연간 사망 **260만 명** (하루 약 7,000명)
- SAFER 5대 개입: 이용가능성 제한 / 음주운전 대책 / 선별·단기개입·치료 / 광고 제한 / 가격 인상
- **서태평양(한국 소속)이 SAFER를 지역 프레임워크로 채택한 세계 최초 지역** (2025.10)

## 국제 — 정책 실패의 국제적 증거

| 출처 | 증거 |
|---|---|
| Global Drug Policy Index | 중앙값 **48/100**, 1위 노르웨이도 74점. 30개국 중 8개국만 비범죄화, 그중 3개국만 실제 전환 |
| UNODC/WHO 치료기준 | 현장검증 참여자 **40%가 "실현 불가능"** 응답 |
| HRI 2024 | 108개국이 해악감소를 국가 정책에 포함, 그러나 처벌적 대응이 여전히 지배적 |
| HRI 2025 | 2025.1 미국 자금 철회 → **92%가 위협 인식, 62%가 심각/치명적**. 케냐 최대 대체요법 센터 폐쇄 |
| EUDA 2026 | 코카인 최초 사용 → 치료 진입까지 **14년** |

---

# 5. 금지 사항 (재확인)

1. ❌ **예시·가상 숫자를 화면에 넣지 말 것.** 없으면 "수집 중".
2. ❌ **지수(Index) 산출 금지.** M6까지 보류. 가중치 정당화 없이 점수 내면 공격당함.
3. ❌ **d2(보고서 전시 UI) 건드리지 말 것.** 별도 트랙.
4. ❌ **qaicle-v2-recovery 수정 금지.** 이 작업은 addiction-society 단독.
5. ❌ **nav 구조 대개편 금지.** M1은 `/sources` 직접 접근만.
6. ❌ **크론에서 throw 금지.** 소스별 try/catch 격리.
7. ❌ **WHO 자료 상업적 이용 금지** (CC BY-NC-SA 3.0 IGO). 출처표시 필수.

---

# 6. 작업 순서 요약

```
M0  예시 숫자 제거 + 관측소 카드 + 부처 분산 지도     [30분]  → 보고
M1  sources 테이블 + 23개 시딩 + /sources 페이지      [반나절] → 보고
M2  감시 크론 + Discord + /calendar + DB 연동         [하루]   → 보고
```

각 마일스톤 끝에 **반드시 멈추고 보고**하십시오. 다음 지시를 받고 진행합니다.

---

# 7. 첫 질문에 대한 답 (예상 질문 선점)

**Q. sources 테이블을 어디에 두나?**
A. `addiction-society` 백엔드. 중독뉴스와 공유하지 않습니다. 데이터·정책은 중독사회, 사건·기사는 중독뉴스로 분업.

**Q. synchronize가 켜져 있는데?**
A. 먼저 `app.module.ts`를 읽고 보고하십시오. 켜져 있으면 엔티티만 추가하되, **프로덕션에서 synchronize=true는 위험**하므로 이 사실을 보고에 명시하십시오.

**Q. 23개 소스의 URL이 살아있는지 확인해도 되나?**
A. 네. M1에서 시딩 후 1회 HEAD 요청으로 200 확인은 권장합니다. 단, 실패해도 시딩은 진행하고 `status='stale'`로 표시.

**Q. /sources 페이지 디자인은?**
A. `PolicyList.tsx`를 클론하십시오. 이미 카드 UI·검색·필터가 있습니다. 새로 만들지 마십시오.

**Q. expected_month가 [1..12]인 monthly 소스는 매일 확인하나?**
A. 아니요. `next_expected_at`이 30일 이내인 것만. monthly는 매달 1회씩 걸립니다.
