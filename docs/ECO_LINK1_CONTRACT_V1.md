# ECO-LINK1 계약 v1 — 중독사회 · 중독뉴스 · Statory (SOC-R10 ■3)

> 상태: **v1 · 2026-10-21 · 코드 0 · migration 0.** · **v1.1 · 2026-10-22(SOC-R11 ■1)**: 면허 철자 `licence` · 나가는 열쇠 `license` + `license_use`(Statory ASK-51 ⓑ) · §8 표 갱신. · **v1.2 · 2026-10-23(SOC-R12 ■3)**: §6-1 봉투 `card_version` · `missing[{id, fields}]` 선택 칸(없으면 옛 꼴) · §8 의 13·14 닫힘. · **v1.3 · 2026-10-24(SOC-R13 ■2)**: §6-1 `missing` 꼴을 Statory ASK-52 실물(main b6faee813 `envelopeMissingOf`) `{ id, fields }` 로 — `fields` = 필수 여섯 가운데 빈 것 · `id: null`(카드 id 가 빈 카드) 줄은 `missing_card_id_empty` · §8 의 15. 받는 문 구현은 **11월 1주 실행 판**이다 — 이 문서가 그 판의 정본이다.
> 앞 판: `docs/ECO_LINK1_CONTRACT_DRAFT.md`(SOC-R9 · 10-19 · D1~D9 를 처음 적은 곳 — 지우지 않고 남긴다).
>
> 받은 결정(이 문서가 옮긴 것 · 지어 넣은 결정 0):
> - **CTO D1~D9**(10-19 · 앞 판 §7 표 — CTO 가 결정으로 받음).
> - **CTO 답 여덟**(10-20 · Statory `docs/reports/202610/ASK-49_instruction.txt` ■3 — 하위 주제 10 · 등급 다섯 · 면허 · 점수 공급자 ·
>   card_state · 관문 둘 · 중독사회 §6 경로 · SQL 초안).
> - **SOC-R10 지시서**(10-21 · `docs/reports/202610/SOC-R10_instruction.txt` ■3 — 링크 줄 등급 다섯 / 카드 등급 넷 · 받는 문 §6 · 숨김 상속).
>
> 읽은 것(읽기 전용 · 10-21 실측): Statory `origin/main` 7a3f682 의 `docs/governance/TOPIC_TAXONOMY_V1.md` ·
> `CARD_V4_FIELDS_ADDENDUM_ECO1.md` · `EVIDENCE_EXPORT_V1.md` · 중독뉴스 `origin/main` d72f88b 의 `docs/EXPORT_V0.md` ·
> `backend/src/export/export.service.ts` · 운영 `GET /api/export/articles` = **404**(열쇠 env 없음 = 기본 꺼짐 · 10-21 09:0x KST).
> 결정이 닫지 않은 자리는 지어 메우지 않고 **안전한 쪽**(보이는 것이 줄어드는 쪽 · 행을 지우지 않는 쪽)을 v1 의 읽기로 적고
> §9 「CTO 판정 필요」에 남겼다.

## 0. 결정 대조 — D1~D9 가 어디로 갔나

| # | 물음 | v1 (결정) | 이 문서 |
|---|---|---|---|
| D1 | 분야 id 축 | **두 축.** 창·주제 축 = `field`(=`addiction` · Statory `topics[]` 꼭대기) · 학문 축 = Statory `field_id`(분과 26 · 그대로). Statory 분야 사전에 `addiction` 을 넣지 않는다(Statory `TOPIC_TAXONOMY_V1` §0 「빠뜨린 것이 아니라 원칙」) | §1 |
| D2 | 하위 유형 영문 id | **열 10** · 차례 그대로 · 별칭은 id 가 아니다 | §1 |
| D3 | 주제형 분류 | `subtype` 빈 배열 = 분야 전체 · 가로 주제는 **선택 칸 `topic`**(v1 어휘 = `recovery` 하나) | §1 |
| D4 | 통계·법률 등급 | **등급 다섯** — `statistic`(수만 · 주장 0) · `paper` · `report` · `broadcast` · `article` · 법률 = `report` + `kind=law` | §2 |
| D5 | 방송 등급 값 | 중독사회 `broadcast_items.grade='방송'` 은 **링크 줄에서만** `broadcast` 로 낸다(행 변경 0) | §2 |
| D6 | 카드 한 장의 상태 | Statory 가 `card_state`(`public`·`held`·`hidden`)를 더한다 · 기본 = 점수 ≥80 ∧ 면허 허용 → `public` · 그 밖 `held` · `hidden` = 사람만 | §3 |
| D7 | slug | **`<repo>:<kind>:<원 id>`** · 원 id 는 바꾸지 않는다 | §4 |
| D8 | 카드의 하위 유형 | Statory 올리는 문에 `subtype[]`(+`topics[]` · `topic`) · 분류는 데스크탑 · 서버는 사전 id 인지만 잰다 | §1 · §6 |
| D9 | 면허 | 철자 **`licence`**(v1.1 · 나가는 열쇠 이름은 Statory 가 정한 `license` · `license_use` 그대로) · 뜻 = **원문의** 면허 · 값 여섯 · **카드만 필수**(중독사회·중독뉴스 줄은 선택) | §5 |

## 1. 분야 · 하위 주제 · 가로 주제

- **`field` = `addiction`** — 중독사회·중독뉴스 `data/field_profiles/addiction.json` 의 `field` · 중독뉴스 export v0 의 `field` ·
  Statory `topics[]` 의 꼭대기 id 가 모두 이 낱말이다. 링크 줄의 `field` 는 **주제 축**이고 Statory 카드의 `field_id`(학문 축)와 섞지 않는다.
- **`subtype`** = 아래 열 id 의 배열(0~10 · 겹침은 하나로). **빈 배열 = 분야 전체**(「분류하지 않았다」가 아니다).
- **별칭은 받지 않는다** — 보내는 쪽이 id 로 바꿔 보낸다. 받는 문에 별칭이 오면 그 줄을 `subtype_unknown` 으로 거절한다
  (Statory 올리는 문과 같은 규약 · 조용히 바꾸지 않는다).

| # | id | ko | en | 갈래 | 별칭(id 아님) | 중독사회 DomainCode | 중독뉴스 category |
|---|---|---|---|---|---|---|---|
| 1 | `alcohol` | 알코올 | Alcohol | 물질 | — | D0 | 알코올·약물중독 |
| 2 | `drugs` | 약물 | Drugs | 물질 | — | D0 | 알코올·약물중독 |
| 3 | `nicotine` | 니코틴·담배 | Nicotine and tobacco | 물질 | `tobacco` | D0 | (중독정책 안) |
| 4 | `gambling` | 도박 | Gambling | 행동 | — | D1 | 도박중독 |
| 5 | `gaming` | 게임 | Gaming | 행동 | — | D1 | 게임·디지털중독 |
| 6 | `shopping` | 쇼핑 | Shopping | 행동 | — | (없음) | (없음) |
| 7 | `work` | 일 | Work | 행동 | — | D3 | (없음) |
| 8 | `smartphone` | 스마트폰 | Smartphone | 행동 | `internet` · `social-media` | D2 | 게임·디지털중독 |
| 9 | `food` | 음식 | Food | 행동 | — | (없음) | (없음) |
| 10 | `ai` | AI | AI | 행동 | `ai-dependence` | D2 | 게임·디지털중독(AI중독 별칭) |

- 열째 「recovery/other」 자리는 **없다**. 열 개가 끝이다(V1 안에서는 더하기만 · 이름 바꾸기·지우기 0).
- **`topic`**(선택 · 낱말 하나 · 배열 아님) — v1 어휘는 **`recovery` 하나**. 그 밖의 낱말은 `cross_topic_unknown` 으로 거절
  (Statory 와 같은 사유 낱말). 「도박 회복」 = `subtype=[gambling]` · `topic=recovery`.
- 하나 대 여럿 대응(DomainCode · category)은 **보내는 쪽이 줄마다 고른다**. 고를 수 없으면 빈 배열(= 분야 전체)로 보낸다 —
  둘을 다 적어 넘겨짚지 않는다(§7 의 중독뉴스 category 표가 그 읽기다).

## 2. 출처 등급 — 링크 줄 다섯 / 카드 넷

| 등급 | 정의(D4) | 차례 | 링크 줄 | Statory 카드 |
|---|---|---|---|---|
| `statistic` | **수만** 담은 출처 — 주장 0 | 차례 밖 | ✓ | ✗ (카드 등급 아님) |
| `paper` | 논문 | 1 | ✓ | ✓ |
| `report` | 보고서(법률 = `report` + `kind=law`) | 2 | ✓ | ✓ |
| `broadcast` | 방송 | 3 | ✓ | ✓ |
| `article` | 기사 | 4 | ✓ | ✓ |

- **링크 줄 = 다섯**, **카드 = 넷**(Statory `report_bundle.v0.json` 카드 등급 enum 그대로 — 수만 담은 것은 카드가 되지 않는다).
- 차례: **`paper` > `report` > `broadcast` > `article`** — 겉에 늘 보인다. `statistic` 은 주장이 없어 차례에 서지 않는다.

| 자리 | 지금 값 | → `grade` | → `kind` |
|---|---|---|---|
| 중독사회 `research` | (칸 없음 · OpenAlex 학술) | `paper` | `research` |
| 중독사회 `documents`(출처 대표 문서) | (칸 없음) | `report` | `document` |
| 중독사회 `documents`(법률 6) | (칸 없음) | `report` | **`law`** |
| 중독사회 `indicators` · `observations` | (칸 없음 · 공식 통계) | `statistic` | `indicator` · `observation` |
| 중독사회 `sources` | (등급 칸 없음 · `kind` 는 **주제** 낱말 — 10-21 실측 prevalence 11 · policy 5 · treatment 4 · enforcement 2 · market 2) | `kind='policy'` → `report` · 그 밖 넷 → `statistic`(C6) | `source` |
| 중독사회 `broadcast_items` | `grade='방송'`(한글 · 10-21 첫 행 1) | `broadcast`(D5 · 행 변경 0) | `broadcast` |
| 중독뉴스 articles · `source_type='broadcast'` | — | `broadcast` | `broadcast` |
| 중독뉴스 articles · 그 밖 | — | `article` | `article` |
| 중독뉴스 `source_grade`(institution · academic · press · aggregator) | 등급 아님 — **출처의 무게** | (그대로 `origin_grade`) | — |
| Statory 카드 | 내보내기 몸에 등급 칸 없음 | `paper`(받는 쪽이 붙임) | `card` |
| Statory `evidence_level`(fulltext · abstract · indirect · bib_only) | 등급 아님 — **카드가 얼마나 읽었나** | — | — |

- **`kind`** = 링크 줄이 가리키는 것의 **종류**(어휘: `research` · `document` · `law` · `indicator` · `observation` · `source` ·
  `broadcast` · `article` · `card`). slug 의 가운데 마디(§4)와 같은 낱말이다. 법률 = `grade=report` ∧ `kind=law`.

## 3. 공개 상태 — `public` · `held` · `hidden` 과 관문 둘

### 3-1. 링크 줄 `state`

| 저장소 | 실제 칸·값 | → `state` |
|---|---|---|
| 중독사회 research | `status='approved'` ∧ 관련성 관문 통과 · 또는 `review_decision='keep'` | `public` |
| 〃 | 관문 실패 ∧ `review_decision IS NULL`(「숨긴 44」 — 오너 몫 · 이 판 결정 0) · `status='pending'` | `held` |
| 〃 | `review_decision='hide'` | `hidden` |
| 중독사회 observations | `status='approved'` / 그 밖 | `public` / `held` |
| 중독사회 documents · broadcast_items · indicators · sources | 상태 칸 없음(모두 공개) | `public` |
| 중독뉴스 articles | `tier='publish'` ∧ `blocked=false` ∧ `deleted_at IS NULL` | `public` |
| 〃 | `tier='archive'` | `held` |
| 〃 | `blocked=true` · `deleted_at` 있음 | `hidden`(export v0 는 **내보내지 않는다** — 없음으로 온다) |
| 〃 | `rejected_articles` 표 | 링크 줄에 싣지 않음 |
| Statory 카드 | `card_state`(D6 · SQL 초안 · 적용 0) | 그대로 — 단 **`public` 만 나간다**(3-2) |

### 3-2. Statory 카드 — 기본값 · `hidden` · 관문 둘

- **기본값**(새 줄을 담을 때 한 번): `completeness ≥ 80 ∧ licence ∈ {cc-by, cc-by-sa, cc0, kogl-1}` → `public` · 그 밖 전부 → `held`.
  점수 공급자 = 데스크탑 `card_completeness.py` · 서버 계산 0(CTO 답 ④).
- **`hidden` = 사람만** — 기계(올리는 문)가 보내면 `card_state_human_only` 로 거절. 사람이 바꾸는 자리 = Statory 관리자 화면 `card_state` 칸(11월).
- **내보내기 관문 둘**(CTO 답 ⑥): **① Statory `card_state='public'`**(∧ 판정 거름 `verdict='ok'` 는 Statory v1 이 그대로 둠) →
  **② 중독사회 `keep`**. 받은 카드는 **중독사회가 `keep` 하기 전에는 손님 화면에 서지 않는다**(§6-3).

### 3-3. 숨김 상속

- Statory: `hidden`·`held` 카드에서 나간 것(**링크 줄 · 근거 지도 항목 · 내보내기**)은 전부 그 상태를 따른다 · 내부 학습·검색은 무관(CTO 답 ⑤).
- **중독사회 받는 쪽의 읽기**(이 문서가 정본 · 구현은 11월):
  1. 받는 길은 **전부 당기기**다 — 한 번 당기면 「지금 `public` 인 카드 전부」가 온다.
  2. 전에 받았는데 이번 전부 당기기에 **없는** 카드 = 위에서 `held`/`hidden` 이 된 것 → 받는 표 `upstream='withdrawn'` 로 적고
     **손님 화면에서 내린다**(우리 `keep` 이 있어도 · **행 삭제 0**).
  3. 다시 오면 `upstream='public'` 으로 돌리고, 우리 결정(`keep`/`hide`)은 **그대로** 따른다(사람 결정을 기계가 덮지 않는다).
  4. 우리 `hide` 는 같은 `card_id` 의 **새 `card_version` 에도 이어진다**(숨기는 쪽 상속 = 안전한 쪽). 우리 `keep` 은 이어지지 않는다 —
     새 판은 `review_decision=NULL`(보류)로 서고 사람이 다시 본다.
  5. 받은 카드에서 우리가 만든 것(근거 지도 붙임 · 지표 붙임 `related_indicators`)도 그 카드의 화면 상태를 따른다.
- 중독뉴스 export v0 의 숨김 상속도 같은 읽기다 — `blocked`/삭제는 「없음」으로만 오므로, 받은 적 있는 `id` 가 사라지면 `withdrawn`.

## 4. slug

**`<repo>:<kind>:<원 id>`** — `repo` ∈ `addiction-society` · `addicted-news` · `statory` · `kind` = §2 의 어휘 · 원 id = 그 저장소 원값 그대로.

| 예 | 뜻 |
|---|---|
| `addiction-society:indicator:who_alcohol_per_capita_kr` | 지표(code) |
| `addiction-society:source:hri_gshr` | 감시 출처 |
| `addiction-society:law:<documents.id>` | 법률 문서 |
| `addiction-society:broadcast:1` | 방송 행 |
| `addicted-news:article:5672` · `addicted-news:broadcast:<id>` | 중독뉴스 기사·방송(같은 id 열) |
| `statory:card:<card_id>` | Statory 카드(`card_version` 은 slug 에 넣지 않음 — 칸으로 따로) |

- 원 id 는 바꾸지 않는다(기존 행 변경 0). 새로 짓는 값은 분야·하위·가로 주제 id 뿐이고 꼴은 `^[a-z][a-z0-9-]*$`(Statory id 규칙과 같다).
- slug 는 **열쇠이지 주소가 아니다** — 화면 주소는 `url` 칸.

## 5. 면허 `licence`

- **철자 `licence`**(v1.1 · SOC-R11 ■1 · Statory 코드·문서의 철자와 같다 — 표 칸 `paper_cards.licence` · `licencePolicy.ts` ·
  ADDENDUM §8). v1(10-21)은 `license` 로 적었다 — 이 판에서 되돌렸다. **이 문서의 낱말은 `licence`** 이고,
  미국 철자 `license` 는 **이름이 그것인 자리**(Statory 내보내기의 나가는 열쇠)를 가리킬 때만 쓴다.
- **나가는 열쇠 이름은 Statory 가 정한 대로 읽는다** — `license`(낱말 하나 · 값 여섯) + `license_use`(쓰임 · Statory ASK-51 ⓑ).
  이름을 바꿔 받지 않는다(§6 머리 · 두 표가 따로 자라지 않게).
- **뜻 = 출처 원문의 면허** — 카드 글(소화한 문장)의 면허가 아니다.
- **값 여섯(소문자)**: `cc-by` · `cc-by-sa` · `cc0` · `kogl-1` · `index-only` · `unknown`.
  - 허용 넷 = `cc-by` · `cc-by-sa` · `cc0` · `kogl-1` · `index-only` = 면허를 알지만 원문을 쓸 수 없음 · `unknown` = 모름.
- **쓰임 `license_use`**(Statory 가 붙임 · 값 둘): `corpus`(허용 넷) · `index_only`(그 밖). **받는 쪽은 적어 두기만** 하고
  화면 규칙은 `license` 값으로 가른다(쓰임과 값이 어긋나면 값이 이긴다 — 좁은 쪽).
- **필수 = Statory 카드 줄만**(D9). 중독사회·중독뉴스 링크 줄은 선택 — 없으면 칸을 싣지 않는다(빈 글로 채우지 않는다).
- **중독사회 화면 규칙**(받은 카드): 허용 넷 → 제목 + 소화한 발견(`key_findings`) + 원문 링크 · `index-only`·`unknown`·값 집합 밖 → **제목 + 원문 링크만**.

## 6. 받는 문 — 중독사회가 Statory 카드를 받는 꼴 (§6 · 구현 11월 1주 · 이 판 0)

Statory `CARD_V4_FIELDS_ADDENDUM_ECO1.md` §6 이 **이 절을 경로로 가리킨다**(사본 0). 칸 이름은 Statory `EVIDENCE_EXPORT_V1` §2 /
`build-evidence-export.mjs` 의 **나가는 열쇠 그대로** 받는다(이름을 바꿔 받지 않는다 — 두 표가 따로 자라지 않게).

### 6-1. 몸(봉투)

`{ generated_at, count, items[], card_version?, missing?[] }` (+ Statory 의 그 밖 칸 `schema` · `skipped` · `fields_missing_counts` … 는 적어 두기만)

**v1.2(SOC-R12 ■3 · 10-23)** — Statory ASK-52 가 봉투 맨 위에 `card_version` · `missing[]` 를 더한다. 두 칸이 **없으면 옛 꼴**
그대로 받는다(거절 0). 받는 쪽 검사 = `backend/src/evidence/card-envelope.ts`(`readEnvelope` · 시험 card-envelope.spec).

| 열쇠 | 꼴 | 검사 | 거절 |
|---|---|---|---|
| `generated_at` | ISO 시각 | 있어야 함 · 앞 당기기보다 늦어야 함(같거나 이르면 그 회차를 건너뜀 · 바꾸지 않음) | 몸 전체 `envelope_invalid`(없음·시각 아님) · `envelope_stale`(늦지 않음) |
| `count` | 정수 | 있으면 `= items.length` | 몸 전체 `envelope_count_mismatch` |
| `items` | 배열 | 줄마다 6-2 | 몸 전체 `envelope_invalid`(배열 아님) · 줄마다 |
| `card_version` | 글(예 `v4`) | **선택** — 없으면 옛 꼴 · 있으면 빈 글이 아닌 글 | 몸 전체 `envelope_invalid`(빈 글 · 글 아님) |
| `missing` | `[{ id, fields }]` — `id` 글(또는 `null`) · `fields` 글 배열 | **선택** — 카드마다 「§6-2 필수 ✓ 여섯(`card_id` · `card_version` · `title` · `doi` · `source_url` · `license`) 가운데 빈 것」(빈 칸 없는 카드는 오지 않음 · 모두 차면 `[]`) · `id` = 그 봉투 `items` 의 `card_id` · 카드 id 자체가 빈 카드는 `id: null` + `fields` 에 `card_id`(v1.3 · Statory ASK-52 `envelopeMissingOf` 실물) · `license` 는 「못 채움」일 때 빈 칸(나가는 낱말 `unknown` 은 채운 값이 아님) | 배열 아님 → 몸 전체 `envelope_invalid` · 줄 하나가 틀리면 **그 줄만** 따로 적음: `missing_entry_invalid`(fields 꼴 · 빈 fields · id 꼴) · `missing_card_id_empty`(`id: null` + `card_id` 빈 칸 — 붙일 카드가 없음 · 그 줄은 §6-2 `card_id_missing`) · `missing_duplicate_id` · `missing_id_unknown`(봉투에 없는 카드) |

- 받은 `missing` 은 카드에 붙여 둔다(받는 표 §6-3 이 서면 그대로 담음). 「정보 부족」 같은 화면 표시는 지금 중독사회에 **없다** — 만들지 않는다(SOC-R12).
- 밤 단계(`import:cards` · 11월)의 `[job_counts]` 에 `card_version` · `missing`(카드 수)을 싣는다(`envelopeJobCounts`).
- **몸 전체 거절이면 숨김 상속(§3-3 의 2)을 돌리지 않는다** — 깨진 회차 하나로 받은 카드가 통째로 내려가지 않게.

### 6-2. 줄(카드 하나)

| 열쇠 | 꼴 | 필수 | 검사 · 받는 쪽 읽기 | 거절 사유 |
|---|---|---|---|---|
| `card_id` | 글 | ✓ | slug = `statory:card:<card_id>` | `card_id_missing` |
| `card_version` | 글 | ✓ | (`card_id`, `card_version`) 이 한 줄 · 같은 쌍이 다시 오면 담지 않음(멱등) | `card_version_missing` |
| `title` | 글 | ✓ | — | `title_missing` |
| `authors` | 글 배열 | — | — | `authors_not_array` |
| `year` | 정수 | — | 1900~올해 | `year_invalid` |
| `venue` | 글 | — | — | — |
| `doi` | 글 | ✓ | `10.` 으로 시작(Statory 는 DOI 없는 줄을 내보내지 않는다) | `doi_missing` |
| `source_url` | URL | ✓ | `https://` | `source_url_invalid` |
| `population` | 글 | — | — | — |
| `region` | 글 | — | — | — |
| `addiction_type` | 글 배열 | — | **링크 줄 `subtype`** 로 읽는다 · 낱말마다 §1 열 id · 빈 배열 = 분야 전체 · 별칭 거절 | `subtype_unknown` |
| `design` | 글 | — | — | — |
| `sample` | 글 또는 수 | — | — | — |
| `key_findings` | 글 또는 글 배열 | — | **소화한 문장만**(인용 0 · Statory 규칙 ④) · 화면 노출은 §5 의 면허 규칙 | — |
| `limitations` | 글 | — | — | — |
| `related_indicators` | — | — | **받지 않는다 — 우리가 채운다**(실려 오면 무시하고 `unreceived_keys` 에 적음) | — |
| `statory_page_url` | URL | — | 있으면 「Statory 에서 보기」 링크(공개 근거 페이지의 정본 = Statory) | `statory_page_url_invalid` |
| `license` | 낱말 | ✓(카드 · D9) | **`licence`**(§5) 값 여섯 · 없거나 밖 → **`unknown` 으로 읽고 담는다**(거절하지 않음 · 화면은 제목+링크만) · 옛 꼴 객체 `{value, use}`(ASK-51 전 · 10-22 실측 Statory main c7429a4)가 오면 `value` 를 값으로 · `use` 를 `license_use` 로 읽는다(거절 0 · 넘어가는 동안만) | — |
| `license_use` | 낱말 | — | `corpus` · `index_only` · 그 밖은 적어 두기만(`unreceived_keys` 아님 · 화면 규칙에 쓰지 않음) | — |
| `judged_at` | ISO 시각 | — | — | — |
| `fields_missing` | 글 배열 | — | 그대로 적음 | — |
| `topics` · `topic` · `field_id` | (Statory §7-4 미정 · 지금 안 옴) | — | 오면 받는다(add-only) · `topics` 는 `addiction` 만 · `topic` 은 `recovery` 만 | `topic_unknown` · `cross_topic_unknown` |

- **모르는 열쇠**는 버리지 않고 응답 기록 `unreceived_keys`(이름 · 까닭 · 줄 번호)에 적는다 — Statory 받는 문 규약과 같은 낱말.
- **줄 거절은 그 줄만** — 나머지 줄은 담는다(503 으로 묶음을 돌려보내지 않음).
- 받는 쪽은 **읽기만**이다 — Statory 표에 쓰는 길 0 · 원문·PDF·인용 0(Statory 규칙 ① ④).

### 6-3. 받는 표(제안 · 덧붙임 migration 만 · 이 판 실행 0)

| 칸 | 뜻 |
|---|---|
| `slug` · `card_id` · `card_version` | 열쇠 · 유일(`card_id`, `card_version`) |
| 6-2 의 칸 | 받은 값 그대로(`addiction_type` → `subtype`) |
| `upstream` | `public`(마지막 당기기에 있었다) · `withdrawn`(없었다 · §3-3) |
| `review_decision` · `reviewed_by` · `reviewed_at` | 관문 ② — `NULL`(보류) · `keep` · `hide` · research 의 검수 칸과 같은 낱말 |
| `fetched_at` · `last_seen_at` | 당긴 시각 · 마지막으로 본 시각 |

- **손님 화면 조건 = `upstream='public'` ∧ `review_decision='keep'`** — 관문 둘의 ② 와 숨김 상속을 한 줄로.
- 새 줄의 기본 = `review_decision=NULL`(보류 · 안 보임) — 같은 `card_id` 의 앞 판이 `hide` 면 `hide`(§3-3 의 4).

### 6-4. 당기는 길

- 꼴 = Statory `EVIDENCE_EXPORT_V1` §4 의 ⓐ(밤 정적 JSON) 또는 ⓑ(읽기 전용 GET) — **Statory 가 고른다**. 받는 쪽은 둘 다 같은 몸(6-1)으로 읽는다.
- 중독사회 밤 예약에 단계 하나(`import:cards` · 04:00 · 실패해도 다른 단계는 그대로) — 11월 실행 판.

## 7. 중독뉴스 export v0 ↔ 링크 줄

중독뉴스 `GET /api/export/articles`(v0 · `docs/EXPORT_V0.md`) — 운영 **404**(10-21 · 열쇠 env 없음 = 기본 꺼짐 · 오너가 11월에 넣음).
아래는 문서·코드의 응답 꼴과 링크 줄의 대조다(응답 실물은 미측).

| 링크 줄 | export v0 칸 | 맞음 | 받는 쪽 읽기(v0 그대로 · 중독뉴스 변경 0) |
|---|---|---|---|
| `field` | `field` (`addiction`) · 몸의 `field` | ✓ 같음 | 그대로 |
| `subtype` | `category`(**한국어 이름**) | ✗ id 아님 | 아래 대응표로 바꿈 · 고를 수 없으면 `[]` |
| `topic` | `category = 중독사회와 회복` | △ | `recovery` |
| `grade` | **없음**(`source_type` 을 싣지 않음) | ✗ | `?kind=article` · `?kind=broadcast` 를 **따로 당겨** 등급을 붙인다 |
| `kind` | (위와 같음) | ✗ | `article` · `broadcast` |
| `state` | `tier`(`publish`·`archive`) | △ | `publish` → `public` · `archive` → `held` · `blocked`·삭제는 안 옴 → 사라지면 `withdrawn`(§3-3) |
| `slug` | `id` | △ | `addicted-news:<kind>:<id>` |
| `origin` | `id` | ✓ | `{ repo: addicted-news, table: articles, id }` |
| `url` | `sourceUrl` | ✓ | 그대로 |
| `title` | `title`(외국어 기사는 한국어 번역 제목) | ✓ | 그대로(/en 화면에서는 한국어 제목을 그대로 내지 않는다 — SOC-R9 규칙) |
| `date` | `publishedAt` · `publishedTs` | ✓ | `publishedTs` 먼저 |
| `licence`(나가는 열쇠는 없음) | 없음 | — (선택 칸 · D9) | 싣지 않음 |
| (덧) `origin_grade` | `sourceGrade` | ✓ | 그대로 |
| (덧) 묶음 | `clusterId` | ✓ | 같은 소식 묶기 |
| — | `source`(매체) | 링크 줄에 칸 없음 | 화면용으로만 |

**`category` → `subtype`·`topic` 대응표**(v1 의 읽기 · 하나 대 여럿은 넘겨짚지 않음):

| category | `subtype` | `topic` | 까닭 |
|---|---|---|---|
| 도박중독 | `[gambling]` | — | 하나 대 하나 |
| 알코올·약물중독 | `[]` | — | 알코올인지 약물인지 category 로 가를 수 없다 — 분야 전체 |
| 게임·디지털중독 | `[]` | — | 게임·스마트폰·AI 셋이 섞인다 |
| 중독정책 | `[]` | — | 유형이 아니라 주제 |
| 중독사회와 회복 | `[]` | `recovery` | 가로 주제 |

- v0 에 더하면 받는 쪽이 넘겨짚지 않아도 되는 칸(중독뉴스 v0 의 「늘리기만」 규칙 안 · 제안만): `sourceType` · `subtype[]`(id).

## 8. Statory v1 문서와 어긋나는 칸 (실측 10-21 · **갱신 10-22 SOC-R11** · 고치는 것은 각 저장소 몫 · 코드 0)

10-22 다시 읽은 것: Statory `origin/main` c7429a4 — ASK-50 ■1(1a031a9) · ASK-50 덧 1(6e20cc8 · cf6b96f) · ASK-51 지시서(692b4c8).
ASK-51 의 ■1(나가는 `license` 꼴 ⓑ)은 **아직 main 에 없다**(내보내기 `build-evidence-export.mjs` 가 `license: { value, use }` 를 냄 · 10-22 실측).

| # | 자리 | Statory 문서(10-22) | 중독사회 v1.1 | 상태 |
|---|---|---|---|---|
| 1 | 중독사회 §6 경로 | ADDENDUM 머리·§6·§9 표 1 · TOPIC 머리가 `docs/ECO_LINK1_CONTRACT_V1.md` §6 을 가리킨다(ASK-50 덧 1) | 받는 문 정본 = 이 파일 §6 | **닫힘** |
| 2 | 면허 철자 | 안쪽 `licence` 하나(ASK-50 ■1) · 나가는 열쇠 `license` | 낱말 `licence` · 열쇠는 그쪽 이름 그대로 `license` · `license_use` | **닫힘**(v1.1 · SOC-R11 ■1) |
| 3 | 내보내기의 면허 값 | 생성기가 `licence` 칸을 읽고 글자 그대로(ASK-50 ■1) — 「늘 모름」 끝 | 값 여섯으로 읽음 | **닫힘**(값) |
| 4 | 허용 면허 목록 | 정본 하나 넷 = JSON(`kogl-1` 더함) = `licence_wire` = 내보내기 규칙(ASK-50 ■1) | 넷 | **닫힘** |
| 5 | 중독 유형 열쇠 이름 | 카드 칸 `subtype[]` · 나가는 열쇠 `addiction_type` | 받을 때 `addiction_type` → `subtype` | 그대로(받는 문이 바꿔 읽음 · 열쇠를 바꾸면 v1 이 깨진다) |
| 6 | `kind` 낱말 | `report_bundle.v0.json` 의 `kind` = 리뷰 종류 · 법률 `kind=law` 자리 미정(TOPIC §7-3) | 링크 줄 `kind` = 대상 종류(`law` 포함 · §2) | 그대로(같은 이름 · 다른 어휘) |
| 7 | 카드 등급 | 내보내기 몸에 등급 칸 없음 · 카드 enum 넷 | 받는 쪽이 `paper` 를 붙임 | 맞음 |
| 8 | 카드 상태 칸 | `card_state` 는 조건으로만 | 받은 줄 = 전부 `public` 으로 읽음 | 맞음 |
| 9 | 새 판의 `hidden` 상속 | 미정(ADDENDUM §7-3) | 우리 `hide` 는 새 판에 이어짐 · `keep` 은 안 이어짐 | 그대로(Statory 쪽은 Statory 판정) |
| 10 | `nicotine` 한국어 이름 | 「니코틴·담배」 | 「니코틴·담배」 | 맞춤 |
| 11 | D1~D9 원문 | ADDENDUM·TOPIC 머리가 이 저장소 `ECO_LINK1_CONTRACT_DRAFT.md` §7 을 가리킨다(ASK-50 덧 1) | 원문 = 앞 판 §7 | **닫힘** |
| 12 | 관문 ① 의 판정 거름 | `verdict='ok'` ∧ `card_state='public'` | 같음 | 맞음 |
| 13 | `license` 의 꼴(ASK-50 판정 6 · 새 줄) | ASK-51 ■1(1.6.48)이 낱말 + `license_use` 로 바꿈 — `licenseWireOf`(10-23 Statory main d837e95 실측) | 낱말 + `license_use`(§5 · §6-2) · 옛 객체 꼴도 넘어가는 동안 `value`·`use` 로 읽음 | **닫힘**(SOC-R12 · 10-23) |
| 14 | 봉투의 `card_version` · `missing[]`(새 줄 · SOC-R12) | 10-23 main 의 봉투에는 둘 다 없음(줄마다 `card_version` · `fields_missing` 만) · ASK-52 ■1 이 봉투 맨 위에 더함(`missing` = `[{id, fields}]`) | §6-1 v1.2 — 둘 다 선택 · 없으면 옛 꼴 · 꼴 검사 `readEnvelope` | **닫힘(받는 쪽)** — Statory 쪽은 ASK-52 push 뒤 실물 대조(다음 판) → **닫힘(양쪽 · SOC-R13 · 10-24)** §8 의 15 |
| 15 | `missing` 줄의 실물 꼴(새 줄 · SOC-R13 ■2) | ASK-52 ■1(판 1.6.49 · main b6faee813 · 10-23) `envelopeMissingOf` = `{ id: row.card_id, fields }` · `EXPORT_REQUIRED_KEYS` 여섯 · `EXPORT_CARD_VERSION = 'v4'` · 봉투 맨 끝 두 칸 | §6-1 v1.3 — 같은 꼴 · `id: null` 줄은 `missing_card_id_empty`(시험 card-envelope.spec 「real ASK-52 envelope」) | **닫힘**(SOC-R13 · 10-24 · 실물 봉투 파일은 Statory 저장소에 없음 — 생성기 코드로 대조) |

## 9. CTO 판정 필요 (v1 이 안전한 쪽으로 읽어 둔 것)

| # | 무엇 | v1 의 읽기 |
|---|---|---|
| C1 | ~~면허 철자~~ | **닫힘(v1.1 · SOC-R11)** — 낱말 `licence` · 나가는 열쇠 `license`·`license_use` 는 Statory 이름 그대로 |
| C2 | 중독뉴스 category 하나 대 여럿(알코올·약물 · 게임·디지털) | `[]`(분야 전체) — 중독뉴스가 `subtype[]` 을 v0 에 더하면 그 값을 씀 |
| C3 | 받은 카드의 새 판 — 우리 `keep` 을 이어받나 | 안 이어받음(다시 봄) · `hide` 는 이어받음 |
| C4 | 몸 전체가 깨진 회차의 숨김 상속 | 돌리지 않음(그 회차 건너뜀) |
| C5 | ~~Statory 내보내기 면허 값이 늘 「모름」~~ | **닫힘(ASK-50 ■1 · §8-3)** — 값은 글자 그대로 온다 · 꼴은 §8-13 |
| C6 | `sources` 의 등급 — `sources.kind` 는 주제 낱말(prevalence · policy · treatment · enforcement · market)이라 등급 칸이 아니다 | `policy` → `report` · 그 밖 → `statistic` 으로 읽음(행 변경 0 · 출처 하나하나의 등급 칸은 덧붙임 migration 후보) |
