# ECO-LINK1 계약 초안 — 중독사회 · 중독뉴스 · Statory (SOC-R9 ■3)

> **2026-10-21 · v1 이 섰다 → `docs/ECO_LINK1_CONTRACT_V1.md`.** 받는 문(§6)의 정본은 v1 §6 이다(이 초안의 §6 꼴은 옛 꼴).
> 이 초안은 D1~D9 를 처음 적은 곳이라 지우지 않고 남긴다(본문 변경 0).

> 상태: **초안**(2026-10-19 · SOC-R9 · 코드 0). 11월 1주 ECO-LINK1 이 이 문서로 바로 짠다.
> 읽은 것(읽기 전용 대조): 중독사회 `backend/src/**/entities/*.ts` + 운영 공개 API(10-19 09:40 KST) ·
> 중독뉴스 `D:\addicted-news\backend\src\articles\*.entity.ts` · `backend/data/field_profiles/addiction.json` ·
> `src/crawler/sourceConfig.ts` · Statory `D:\statory\qaicle-v2-recovery\docs\governance\CARD_V4_FIELDS.md` ·
> `field_taxonomy.json`(FIELD_TAXONOMY_V1) · `schemas/report_bundle.v0.json` · `LIBRARY_INDEX_V1.md` §6.
> 빈칸·충돌은 지어 메우지 않고 맨 끝 **「CTO 결정 필요」** 표로 모았다(D1~D9).

## 0. 한 줄 계약

세 저장소가 서로 주고받는 한 줄(이하 **링크 줄**)은 다음 일곱 칸을 반드시 가진다.

| 칸 | 꼴 | 뜻 |
|---|---|---|
| `field` | `addiction` | 분야(창). §1 |
| `subtype` | §1 의 열 id 가운데 0~n | 하위 유형(물질·행동) |
| `grade` | `paper` · `report` · `broadcast` · `article` | 출처 등급. §2 |
| `state` | `public` · `held` · `hidden` | 공통 승인 상태. §3 |
| `slug` | §4 규칙 | 저장소를 넘어 같은 것을 가리키는 열쇠 |
| `origin` | `{ repo, table, id }` | 원 행(`addiction-society` · `addicted-news` · `statory`) |
| `url` | 원문 주소 | 원칙3(원본 딥링크) |

받는 쪽은 모르는 칸을 버리지 않고 `unreceived_keys` 로 이름과 까닭을 돌려준다(Statory 받는 문 규약 그대로 · CARD_V4_FIELDS §5).

## 1. 분야 id 와 하위 유형

- 분야(창) id = **`addiction`** — 중독사회 `data/field_profiles/addiction.json` 의 `field` · 중독뉴스 같은 파일의 `field` 가 이미 이 값이다.
- **충돌**: Statory `FIELD_TAXONOMY_V1`(field_taxonomy.json · 26 id)은 **학문 분과**(psychology · psychiatry · public-health · criminology …)이고 `addiction` id 가 없다. 카드의 `field_id` 는 분과다. 그래서 링크 줄의 `field`(창 · 주제)와 카드의 `field_id`(분과)는 **다른 축**으로 둔다 → D1.
- 하위 유형(오너 10-17) — 영문 id 는 이 초안의 제안(D2):

| 묶음 | id | 한글 | 중독사회 DomainCode | 중독뉴스 category(slug) |
|---|---|---|---|---|
| substance | `alcohol` | 알코올 | D0 | 알코올·약물중독(`alcohol`) |
| substance | `drugs` | 약물 | D0 | 알코올·약물중독(`alcohol`) |
| substance | `nicotine` | 니코틴 | D0 | 중독정책(`policy`) — 담배·니코틴 낱말이 여기 있음 |
| behavioral | `gambling` | 도박 | D1 | 도박중독(`gambling`) |
| behavioral | `gaming` | 게임 | D1 | 게임·디지털중독(`game`) |
| behavioral | `shopping` | 쇼핑 | (없음) | (없음) |
| behavioral | `work` | 일 | D3 | (없음 · NEWS-Q 「일」 핵심어만) |
| behavioral | `smartphone` | 스마트폰 | D2 | 게임·디지털중독(`game`) |
| behavioral | `food` | 음식 | (없음) | (없음 · NEWS-Q 「음식」 핵심어만) |
| behavioral | `ai` | AI | D2 | AI중독(`ai` → 별칭으로 게임·디지털중독) |

- 대응이 하나 대 여럿이다: 중독사회 D0 = 알코올+약물+니코틴 · D2 = 스마트폰+AI(+SNS) · D3 = 「관계/일」. 중독뉴스 「중독정책」·「중독사회와 회복」은 유형이 아니라 **주제**다 → 링크 줄은 `subtype` 을 비워 보내도 된다(빈 배열 = 분야 전체) · D3.

## 2. 출처 등급 넷

정본 = Statory `report_bundle.v0.json` `$defs.grade`: **`paper` > `report` > `broadcast` > `article`**(무거운 차례 · 겉에 늘 보인다).

| 저장소 · 자리 | 지금 값 | → 링크 줄 grade |
|---|---|---|
| 중독사회 `research` | (칸 없음 · 학술 수집 OpenAlex · API 가 `evidenceLevel` 을 지어 냄) | `paper` |
| 중독사회 `documents` | (칸 없음 · 출처 대표 산출물 23 · 법률 후보 6) | `report` (법률 → D4) |
| 중독사회 `indicators`/`observations` | (칸 없음 · 공식 통계 값) | (넷 밖 — `statistic`) → D4 |
| 중독사회 `broadcast_items.grade` | `'방송'`(한글 글자 · 기본값) | `broadcast` (값 낱말 바꿈 → D5) |
| 중독뉴스 `articles.source_type` | `broadcast` / 그 밖 | `broadcast` / `article` |
| 중독뉴스 `articles.source_grade` | `institution` · `academic` · `press` · `aggregator`(GRADE_RANK 0~3) | 모두 `article` — 「기관·학술 뉴스룸 기사」도 기사다. 원 등급은 `origin_grade` 로 함께 싣는다 |
| Statory 카드 `evidence_level` | `fulltext` · `abstract` · `indirect` · `bib_only` | 등급이 아니라 **카드가 얼마나 읽었나**(축이 다름) — 카드는 늘 `paper` |

## 3. 승인 상태 대응표

링크 줄 `state`: **`public`**(창에 보임) · **`held`**(검토 대기 · 안 보임) · **`hidden`**(사람이 숨김 · 안 보임). 세 저장소의 실제 값(지시서의 이름과 다른 곳은 굵게):

| 저장소 | 실제 칸·값 | → state |
|---|---|---|
| 중독사회 research | `status='approved'` ∧ 관련성 관문 통과(공개 7 · 10-19) | `public` |
| 〃 | `status='approved'` ∧ 관문 실패 ∧ `review_decision IS NULL`(**「숨긴 44」** — 오너 검수 몫) | `held` |
| 〃 | `review_decision='keep'` | `public` |
| 〃 | `review_decision='hide'` | `hidden` |
| 〃 | `status='pending'`(collect:research 관문 실패 저장분) | `held` |
| 중독사회 observations | `status='approved'`(기본) / 그 밖 | `public` / `held` |
| 중독사회 documents · broadcast_items | (상태 칸 없음 · 모두 공개) | `public` |
| 중독뉴스 articles | **`tier='publish'`**(지시서 「published」) ∧ `deleted_at IS NULL` ∧ `blocked=false` | `public` |
| 〃 | **`tier='archive'`**(보관층 · 공개 목록 밖 · `?tier=archive` 로만) | `held` |
| 〃 | `blocked=true` 또는 `deleted_at` 있음 | `hidden` |
| 〃 | **`rejected_articles` 표**(지시서 「rejected」 — 상태 값이 아니라 **다른 표** · `reject_reason`) | 링크 줄에 싣지 않음 |
| Statory 카드 | **`learn_status.card_completeness {complete, total}`** 은 카드 **수**(문턱 80 이상 / 잰 온 카드)이지 카드 한 장의 상태가 아니다 | (카드 한 장의 공개 상태 칸 없음) → D6 |
| 〃 | `reviewed`(지시서) — Statory 문서에서 카드 상태 낱말로 찾지 못함 | → D6 |

## 4. slug 규칙

지금 셋이 다르다:

| 자리 | 꼴 | 예 |
|---|---|---|
| 중독사회 출처 `sources.id` · 지표 `indicators.code` | 소문자·밑줄 | `spo_drug_monthly` · `who_alcohol_per_capita_kr` |
| 중독사회 근거지도 주제 | 소문자·붙임표(`^[a-z0-9-]+$`) | `youth-gambling` · `alcohol-recovery` |
| 중독뉴스 category slug | 소문자 한 낱말 | `policy` · `alcohol` · `gambling` · `game` · `ai` · `issue` |
| Statory `field_id` | 소문자·붙임표 | `public-health` · `research-methods` |

제안(D7): 링크 줄 `slug` = **`<repo>:<kind>:<local id>`**, local id 는 그 저장소 원값 그대로(바꾸지 않음 · 기존 행 변경 0).
예: `addiction-society:indicator:who_alcohol_per_capita_kr` · `addiction-society:source:hri_gshr` ·
`addicted-news:article:5695` · `statory:card:<card id>`. 분야·하위 유형 id 만 새로 짓는 값이고 **소문자·붙임표**(`^[a-z][a-z0-9-]*$` · Statory 와 같은 꼴).

## 5. 세 저장소 현재 필드 대조표

### 5-a 중독사회 (엔티티 + 운영 API 실측 10-19)

| 표 | 행 수(실측) | 칸 |
|---|---|---|
| `research` | 공개 7(API total) · 「숨긴 44」 | id · title · authors[] · year · abstract · summary · keywords[] · domains[](D0~D3) · pdf_url · source_url · source(학술지) · status · reviewed_by · reviewed_at · review_decision · relevance_score · relevance_reason · relevance_checked_at · region · is_featured · view_count · created_at · updated_at · tags(research_tags) / API 덧: publicBasis · evidenceLevel |
| `indicators` | 11 | id · code · domain · name_ko · name_en · unit · definition_ko · method_note · source_id · break_years[] · created_at · updated_at (영어 정의 = 화면 표 `frontend-next/src/lib/enIndicators.ts` · DB 칸 없음) |
| `observations` | 98 | id · indicator_id · source_id · geo · period · value · value_low · value_high · qualifier · revisions(jsonb) · status · review_batch · note · fetched_at · source_url |
| `documents` | 23 | id · title · country · year · description · summary(출처 문서 = 출처 영어 제목) · pdf_url · source_url · source · source_id · region · is_featured · view_count · created_at · updated_at · tags · assessment_cells |
| `broadcast_items` | **0** | id · url(유일) · title · broadcaster · published_at · grade(기본 '방송') · fetched_at |

`broadcast_items` 가 0 인 까닭(10-19 실측): 공급 경로는 산다 — 04:00 `collect:broadcasts` ok(받음 0 · 넣음 0) · 중독뉴스 `GET /articles/latest?kind=broadcast` = HTTP 200 `[]`(`tier=archive` 도 `[]`). 중독뉴스에 저장된 방송 행이 아직 0 이다(NEWS-Q9 10-18: 방송 후보 363 → 10 = 모두 중복 · 판정 호출 0). 받는 쪽 고칠 것 없음.

### 5-b 중독뉴스 `articles` (읽기만 · `article.entity.ts`)

id · title · original_title · teaser · summary · raw_body(select false) · category · region · source · source_url · google_url · origin · is_top · is_feature · is_rapha · is_issue · image_url · published_at(varchar · 날짜) · lang · is_foreign · source_type(`broadcast`…) · outlet_id · keywords(simple-array) · blocked · blocked_reason · judge_status · deleted_at · tier · published_ts · source_grade · url_resolve(jsonb) · cluster_id · cluster_size · created_at · updated_at.
격리 표 `rejected_articles`: title · original_title · summary · category · source · source_url · google_url · published_at · lang · source_type · domain · reject_reason · confidence ….

### 5-c Statory 카드 (CARD_V4_FIELDS 문서 기준 · 필수 열일곱)

title · authors · year · venue · doi_or_na(`doi` + `doi_na`) · design(`study_design`) · sample_n · sample_unit · sample_country(`findings_struct[].country`) · scale(`variable_roles[].level`) · result_table(`findings_struct[]` statistic + page 또는 char 범위) · claims(`findings` + `quotes[]`) · **field_id**(FIELD_TAXONOMY_V1) · **grade**(`evidence_level`) · licence(+`licence_source`) · summary_ko(`summary`) · summary_en. 그 밖: `card_kind`(full · lite) · `superseded_by`.

### 5-d 한 줄로 맞춘 칸

| 링크 줄 | 중독사회 | 중독뉴스 | Statory 카드 |
|---|---|---|---|
| title | research.title · documents.title · indicators.name_ko(+name_en) · broadcast_items.title | articles.title(+original_title) | title |
| date | research.year · documents.year · observations.period · broadcast_items.published_at | published_at(날짜) · published_ts | year |
| url | source_url(research·documents·observations) · broadcast_items.url | source_url(+google_url) | doi / URL |
| summary | research.summary · documents.description | summary · teaser | summary · summary_en |
| subtype | domains[] / domain(D0~D3) | category | (없음 → D8) |
| grade | §2 | source_type · source_grade | evidence_level(축 다름) |
| state | §3 | tier · blocked · deleted_at | (없음 → D6) |
| licence | (없음) | (없음) | licence |

## 6. 12월 「맞다」 카드 — 중독사회가 받는 꼴(읽기 전용 import 자리 · 구현 0)

중독사회는 Statory 의 카드를 **읽기만** 한다(쓰기·고치기 0 · 원문·PDF 0). 받는 꼴 제안:

```json
{
  "contract": "eco-link1/card-import-0",
  "field": "addiction",
  "cards": [
    {
      "slug": "statory:card:<id>",
      "subtype": ["gambling"],
      "grade": "paper",
      "state": "public",
      "title": "…",
      "year": 2024,
      "venue": "…",
      "doi": "10.…",
      "summary_ko": "…",
      "summary_en": "…",
      "claims": [{ "text": "…", "page": 12 }],
      "numbers": [{ "value": 4.3, "unit": "%", "n": 13368, "page": 23 }],
      "field_id": "public-health",
      "evidence_level": "fulltext",
      "licence": "cc-by",
      "url": "https://…"
    }
  ]
}
```

- 자리: 중독사회 `GET` 하나로 당겨 오는 길(받는 쪽 표는 덧붙임 migration 으로만 — 이 판 0).
- 거절 규약: 모르는 열쇠·꼴 틀림은 줄마다 사유와 함께(`unreceived_keys` 꼴 · Statory 받는 문과 같은 낱말).
- 화면: `licence` 가 「unknown」이면 요약·주장 노출 0(Statory licencePolicy 와 같은 물음 · D9).

## 7. CTO 결정 필요

| # | 빈칸·충돌 | 사실 | 이 초안의 제안 |
|---|---|---|---|
| D1 | 분야 id 축 | FIELD_TAXONOMY_V1 은 학문 분과 26 이고 `addiction` 이 없다. 지시서 「FIELD_TAXONOMY 「중독」」 과 다름 | 창 축 `field=addiction`(두 사이트 field_profile 값) 과 분과 축 `field_id` 를 따로 둔다. FIELD_TAXONOMY 에 `addiction` 을 넣을지는 Statory 오너 결정 |
| D2 | 하위 유형 영문 id | 오너 10-17 은 한글 열 개만 | §1 표의 열 id(alcohol · drugs · nicotine · gambling · gaming · shopping · work · smartphone · food · ai) |
| D3 | 주제형 분류 | 중독뉴스 「중독정책」·「중독사회와 회복」, 중독사회 D3 「관계」 는 유형이 아님 | subtype 빈 배열 = 분야 전체 · 주제는 따로 `topic` 칸(있으면) |
| D4 | 통계·법률의 등급 | 등급 넷에 공식 통계(지표)·법률 자리가 없다(Statory issue.source_kind 에는 `statistic` 있음) | 통계 = `report`로 접거나 다섯째 `statistic` — 결정 |
| D5 | 방송 등급 값 | 중독사회 broadcast_items.grade = '방송'(한글) | 링크 줄에서만 `broadcast` 로 바꿔 내보냄(행 변경 0) |
| D6 | 카드 한 장의 상태 | Statory 는 `complete/total`(수)만 · `reviewed` 낱말 문서에 없음 | 카드 줄에 `state` 칸을 Statory 가 더하거나, 「받은 카드 = public」 으로 약속 |
| D7 | slug | 저장소마다 꼴이 다름(§4) | `<repo>:<kind>:<원 id>` · 원 id 안 바꿈 |
| D8 | 카드의 하위 유형 | 카드에 중독 유형 칸 없음(EVIDENCE_EXPORT_V1 「칸 없다」 · 분류기는 데스크탑) | 올리는 문에 `subtype` 칸 하나(Statory 판) |
| D9 | 면허 없는 쪽 | 중독사회·중독뉴스에는 licence 칸이 없다 | 링크 줄 licence 는 선택 · 카드만 필수 |
