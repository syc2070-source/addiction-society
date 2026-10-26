# ECO-LINK1 계약 v1 — 중독사회 · 중독뉴스 · Statory (SOC-R10 ■3)

> 상태: **v1 · 2026-10-21 · 코드 0 · migration 0.** · **v1.1 · 2026-10-22(SOC-R11 ■1)**: 면허 철자 `licence` · 나가는 열쇠 `license` + `license_use`(Statory ASK-51 ⓑ) · §8 표 갱신. · **v1.2 · 2026-10-23(SOC-R12 ■3)**: §6-1 봉투 `card_version` · `missing[{id, fields}]` 선택 칸(없으면 옛 꼴) · §8 의 13·14 닫힘. · **v1.3 · 2026-10-24(SOC-R13 ■2)**: §6-1 `missing` 꼴을 Statory ASK-52 실물(main b6faee813 `envelopeMissingOf`) `{ id, fields }` 로 — `fields` = 필수 여섯 가운데 빈 것 · `id: null`(카드 id 가 빈 카드) 줄은 `missing_card_id_empty` · §8 의 15. · **v1.4 · 2026-10-24(SOC-R14 ■2)**: 줄 `paper_id`(선택 · Statory `item_id` · 판이 바뀌어도 같음) — keep/hide 와 상속의 열쇠를 `card_id`(판마다 다른 줄 id) 대신 `paper_id` 로 · 새 판은 앞 판의 **keep 도** 이어받고 표식 `keep_from_version`(「전 판 keep」) · 없으면 옛 꼴(card_id 열쇠) · §8 의 16. · **v1.5 · 2026-10-25(SOC-R15)**: CTO 판정 C1(이어받은 keep 은 손님에게 그대로 · 관리자 화면에만 「이전 판 승인」 꼬리표) · C2(paper_id 를 달고 다시 온 줄은 같은 `card_id` 의 옛 card 열쇠 결정을 paper 열쇠로 한 번 옮겨 적음 · 기록 `key_moved_from` · `key_moved_at`) · **받는 문 구현**(표 `eco_inbox` · `import:eco` · **스위치 `ECO_LINK1_INBOX_ENABLED` 꺼짐**) · §8 의 17 · 18 · §9 C7. 받는 문을 **켜는 때**는 따로 정한다(11월 1주 예정) — 이 문서가 그 판의 정본이다. · **v1.6 · 2026-10-26(SOC-R16)**: §1-1 **받는 쪽 subtype 대응표**(`tobacco`→`nicotine` · `digital`→`smartphone` · 모르는 값은 거절 0 · `unknown_subtype` 표시 · §9 C7 닫힘) · §6-5 **KCI 유래 카드**(`source=kci` · 초록 저장 0 · 서지 + KCI 링크 + 짧은 인용 ≤2문장 · 바닥 출처 줄) · §6-4 **Statory 공개 자리 설정 칸**(`ECO_SOURCE_LATEST_URL` · `ECO_SOURCE_READ_KEY` · 켜는 순서 셋) · §3-3 연대기 방송 **목록 정본 v1 · 부재 추론 0**. · **v1.7 · 2026-10-26(SOC-R17)**: §6-4 Statory 읽기 열쇠 머리 **`x-eco-export-key`**(Statory `EVIDENCE_EXPORT_V1` §5-2 · ASK-58 과 같은 이름) · §6-5 **DOI 없는 KCI 카드** = `source_url` 이 있으면 받음(서지 링크 = `source_url`) · 링크가 없으면 받고 `missing` 표시(손님 0) · §1-1 **별칭 셋 더함**(`internet` · `social-media` → `smartphone` · `ai-dependence` → `ai` · §9 C8 닫힘) · §8 의 19 닫힘(받는 쪽).
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
- ~~별칭은 받지 않는다 — 받는 문에 별칭이 오면 그 줄을 `subtype_unknown` 으로 거절한다~~(v1.0~v1.5).
  **v1.6(SOC-R16 ■2)**: 보내는 쪽(중독뉴스 · Statory)은 **제 값을 그대로** 보낸다. 받는 쪽이 아래 §1-1 대응표로 열 id 로 읽고,
  대응표에도 열 id 에도 없는 값은 **줄을 거절하지 않고** 받은 줄의 `payload.unknown_subtype` 에 보낸 그대로 적어
  관리자 검수 화면에 보인다(`subtype` 에는 아는 id 만 · 모르는 값만 있으면 `[]` = 분야 전체). 원래 값은 `payload` 에 그대로 남는다.
  (Statory **올리는 문**의 별칭 거절 규약은 그쪽 몫 — 이 대응표는 중독사회 받는 문에만.)

### 1-1. 받는 쪽 subtype 대응표 (v1.6 · **v1.7** · `backend/src/evidence/eco-inbox.ts` `SUBTYPE_ALIASES`)

| 받은 값 | → 열 id | 누가 보냄 | 까닭 |
|---|---|---|---|
| `tobacco` | `nicotine` | 중독뉴스 export v0 `subtype[]` (NEWS-Q12) | §1 표의 별칭(니코틴·담배) |
| `digital` | `smartphone` | 중독뉴스 export v0 `subtype[]` (「게임·디지털」 = `gaming` · `digital`) | CTO 판정(SOC-R16 ■2) — 디지털 = 스마트폰 열 |
| `internet` | `smartphone` | (지금 보내는 곳 미측 · Statory `addiction_type` 에 올 수 있음) | **v1.7** §1 표의 별칭 · CTO R16 판정 |
| `social-media` | `smartphone` | (위와 같음) | **v1.7** §1 표의 별칭 · CTO R16 판정 |
| `ai-dependence` | `ai` | (위와 같음) | **v1.7** §1 표의 별칭 · CTO R16 판정(`ai` 는 §1 열째 id 그대로 · 더한 id 0) |
| (열 id 열 개) | 그대로 | 셋 다 | §1 |
| 그 밖 | — (`unknown_subtype` 표시 · 거절 0) | — | 넘겨짚지 않음 |

- 맞출 때만 대소문자 · 앞뒤 빈칸을 무시한다(`Gambling` = `gambling`). 배열이 아닌 글 하나도 한 낱말로 읽는다.
- v1.7 로 §1 표의 별칭 다섯이 모두 대응표에 있다(§9 C8 닫힘). 정본 열 id 는 그대로 열 개(오너 10-17 유형: 행동 도박·게임·쇼핑·일·스마트폰·음식·AI / 물질 알코올·약물·니코틴 = 아래 표와 같음).

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
  4. **v1.4(SOC-R14 · CTO 10-24)**: 열쇠 = **논문**(`paper:<paper_id>` · 없으면 옛 꼴 `card:<card_id>`). 같은 열쇠의 새 판은
     앞 판들 가운데 **사람이 마지막으로 정한 결정**을 이어받는다 — `hide` → `hide` · `keep` → `keep` + 표식 `keep_from_version`
     (= 사람이 keep 한 판 · 화면·관리자에 「전 판 keep」 · 물려받은 keep 은 사람 결정이 아니므로 다음 판도 같은 원래 판을 가리킴) · 결정 없음 → `NULL`(보류).
     사람이 새 판을 다시 정하면 표식을 지운다. 사람이 보류(`NULL`)로 되돌린 것도 결정이다(그 뒤 판은 보류) · 같은 때의 결정은 `hide` > 보류 > `keep`(안전한 쪽). 옛 꼴과 새 꼴은 서로 잇지 않는다(같은 논문이 옛 꼴로 먼저 왔으면 첫 paper 판은 보류).
     구현 = `backend/src/evidence/card-decisions.ts`(`cardKeyOf` · `cardKeysOf` · `inheritDecision` · 시험 card-decisions.spec).
     (v1.0~v1.3: `hide` 만 같은 `card_id` 의 새 판에 이어지고 `keep` 은 안 이어짐 — `card_id` 가 판마다 달라 실제로는 둘 다 끊겼다 · ASK-53 리뷰 F1.)
     앞 판 줄이 이번 당기기에 없으면(ASK-53 = 논문마다 최신 판 한 줄) 그 줄은 2 대로 `withdrawn` — 새 판 줄이 결정을 이어받아 선다.
     **v1.5 C1(CTO 10-25)**: 물려받은 `keep` 은 **손님 화면에 여느 승인과 똑같이** 선다(손님 응답에 표식 · 검수 칸 0) —
     `keep_from_version` 은 관리자 검수 화면에만 꼬리표 「이전 판 승인(keep_from_version <판>)」 로 보인다(`adminView` · `guestView`).
     **v1.5 C2(CTO 10-25)**: `paper_id` 를 가진 줄이 오면, 받는 표에서 열쇠가 `card:<그 줄의 card_id>` 인 옛 행의 열쇠를
     `paper:<paper_id>` 로 **한 번** 옮겨 적는다(행 지움 0 · `key_moved_from` = 옛 열쇠 · `key_moved_at` · 이미 옮긴 행은 다시 안 옮김).
     옮긴 뒤 상속을 잰다 — ASK-54 전에 card 열쇠로 받아 사람이 정한 결정이 그 논문의 새 판으로 이어진다(`planInbox`).
     `card_id` 가 같지 않은 옛 행(다른 판의 줄 id)은 짝을 알 수 없어 옮기지 않는다(넘겨짚지 않음).
  5. 받은 카드에서 우리가 만든 것(근거 지도 붙임 · 지표 붙임 `related_indicators`)도 그 카드의 화면 상태를 따른다.
- 중독뉴스 export v0 의 숨김 상속도 같은 읽기다 — `blocked`/삭제는 「없음」으로만 오므로, 받은 적 있는 `id` 가 사라지면 `withdrawn`.
- **연대기 방송(`broadcast_items`) = 목록 정본 v1 · 부재 추론 0(SOC-R16 ■1)** — 숨김은 중독뉴스 보관 목록(`GET /api/broadcast/archive?tier=all`)의 짝(`news_id` ∨ `videoId`)이 `archive`/`deleted` 일 때만 · 목록에 없으면 보임 · 목록이 비었거나 `truncated` 가 `false` 가 아니거나 못 읽으면 숨김 0(다시 보임만) · 구현 `archiveListDecision` · `feedOnlyDecision`(시험 broadcast-canonical.spec).

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
| `paper_id` | 글 또는 양의 정수 | — | **v1.4** 논문 열쇠(Statory `item_id` · ASK-54) — 있으면 keep/hide 상속의 열쇠 `paper:<paper_id>`(§3-3 의 4) · 없으면 옛 꼴(`card:<card_id>`) · 수 = 안전한 양의 정수(≤ 2^53−1) → 글로 · 숫자 글 = 0 으로 시작하지 않는 양의 정수만(`"123"` = `123` 같은 열쇠) · 숫자 꼴이 아닌 글 = 64 자까지 그대로(불투명) | `paper_id_invalid`(빈 글 · `0` · `"0"` · 음수 · `"0123"` · 소수 · 2^53 이상 · 65 자 이상 · 객체 — **줄 거절** · card_id 로 물러서지 않음) · `paper_id_duplicate`(같은 봉투에 둘 · 뒤 줄 · 다른 6-2 검사를 지난 줄끼리만 견줌) |
| `title` | 글 | ✓ | — | `title_missing` |
| `authors` | 글 배열 | — | — | `authors_not_array` |
| `year` | 정수 | — | 1900~올해 | `year_invalid` |
| `venue` | 글 | — | — | — |
| `doi` | 글 | ✓(KCI 유래 제외) | `10.` 으로 시작(Statory 는 DOI 없는 줄을 내보내지 않는다) · **v1.6**: `source=kci` 카드는 DOI 가 없어도 받는다(서지 + KCI 상세 링크 · §6-5) · 있으면 같은 검사 | `doi_missing` |
| `source_url` | URL | ✓(KCI 유래 제외) | `https://` · **v1.7**: `source=kci` 카드는 없어도 받는다(링크 없음 → `missing` 표시 · 손님 0 · §6-5) · 있으면 같은 검사 | `source_url_invalid` |
| `population` | 글 | — | — | — |
| `region` | 글 | — | — | — |
| `addiction_type` | 글 배열 | — | **링크 줄 `subtype`** 로 읽는다 · 낱말마다 §1 열 id · 빈 배열 = 분야 전체 · **v1.6**: §1-1 대응표로 읽고 모르는 값은 `payload.unknown_subtype` 표시(거절 0) | (v1.5 까지 `subtype_unknown`) |
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
| `source` | 낱말 | — | **v1.6** `kci` = KCI 유래 카드(Statory ASK-58 ■4 · §6-5) · 그 밖 값 · 없음 = 여느 카드 | — |
| `use_until` | 날짜 | — | **v1.6** KCI 만 · 이용 기간 끝(날짜만 오면 그날 끝까지) · 지나면 손님 화면 0 · 못 읽는 날짜 = 지난 것 | — |
| `quote` | 글 | — | **v1.6** KCI 만 · 짧은 인용 — 받는 쪽이 다시 두 문장 · 300 자로 줄여 담음 | — |

- **모르는 열쇠**는 버리지 않고 응답 기록 `unreceived_keys`(이름 · 까닭 · 줄 번호)에 적는다 — Statory 받는 문 규약과 같은 낱말.
- **줄 거절은 그 줄만** — 나머지 줄은 담는다(503 으로 묶음을 돌려보내지 않음).
- 받는 쪽은 **읽기만**이다 — Statory 표에 쓰는 길 0 · 원문·PDF·인용 0(Statory 규칙 ① ④).

### 6-3. 받는 표(**v1.5 = `eco_inbox` · migration 1789000000000-CreateEcoInbox · 덧붙임만**)

v1.5 구현: 한 표에 두 원천(`origin` = `statory` · `addicted-news`) · 유일 (`origin`, `slug`, `version`) — Statory `version` = `card_version` ·
중독뉴스는 판이 없어 `''` · 결정 상속 열쇠 칸 이름 `paper_key`(중독뉴스 = slug) · 받은 줄은 `payload`(아는 열쇠만) · 아래 칸 + `key_moved_from` · `key_moved_at`(C2).
읽기·계획 = `backend/src/evidence/eco-inbox.ts`(`readCardLines` · `readNewsLines` · `planInbox` · `guestView` · `adminView` · 시험 eco-inbox.spec · fixture 넷).

| 칸 | 뜻 |
|---|---|
| `slug` · `card_id` · `card_version` | 열쇠 · 유일(`card_id`, `card_version`) |
| `paper_key` | **v1.4** 결정 상속 열쇠 `paper:<paper_id>` 또는 `card:<card_id>`(`cardKeyOf`) · 찾기 색인(유일 아님 — 한 논문에 판 여럿) |
| 6-2 의 칸 | 받은 값 그대로(`addiction_type` → `subtype`) |
| `upstream` | `public`(마지막 당기기에 있었다) · `withdrawn`(없었다 · §3-3) |
| `review_decision` · `reviewed_by` · `reviewed_at` | 관문 ② — `NULL`(보류) · `keep` · `hide` · research 의 검수 칸과 같은 낱말 · 물려받은 결정은 `reviewed_at` 을 비움(사람 결정이 아님) |
| `keep_from_version` | **v1.4** 물려받은 keep 이면 사람이 keep 한 판(「전 판 keep」 표식) · 아니면 NULL |
| `fetched_at` · `last_seen_at` | 당긴 시각 · 마지막으로 본 시각 |

- **손님 화면 조건 = `upstream='public'` ∧ `review_decision='keep'`** — 관문 둘의 ② 와 숨김 상속을 한 줄로(물려받은 keep 도 선다 · 고친 판이 와도 승인된 근거가 내려가지 않음).
- 새 줄의 기본 = 같은 `paper_key` 의 사람 마지막 결정(§3-3 의 4 · `inheritDecision`) · 없으면 `review_decision=NULL`(보류 · 안 보임).

### 6-4. 당기는 길

- 꼴 = Statory `EVIDENCE_EXPORT_V1` §4 의 ⓐ(밤 정적 JSON) 또는 ⓑ(읽기 전용 GET) — **Statory 가 고른다**. 받는 쪽은 둘 다 같은 몸(6-1)으로 읽는다.
- 중독사회 밤 예약에 단계 하나(`import:cards` · 04:00 · 실패해도 다른 단계는 그대로) — 11월 실행 판.
  **v1.5**: 단계 이름 `import:eco`(Statory + 중독뉴스 둘 다) · 스위치가 꺼져 있으면 04:00 아홉 단계 그대로(`dailySteps`) · 켜면 `refresh:home` 앞에 선다.
  원천 주소 env 이름: Statory `ECO_STATORY_EXPORT_URL`(latest.json 을 내주는 주소) · 중독뉴스 `ADDICTION_NEWS_API_URL`(기본 운영 주소) + 열쇠 `ECO_NEWS_EXPORT_KEY`(요청 머리 `x-export-key`) — 없는 원천은 건너뜀.
  중독뉴스는 `kind=article` · `kind=broadcast` 를 따로 끝까지 당긴다(쪽 상한 100 · 넘으면 그 회차 `withdrawn` 안 돌림). 손님 응답 `GET /api/evidence/received`(꺼짐 = 404) · 관리자 `GET /api/admin/eco/review?tab=` · `PUT /api/admin/eco/:id/review` · 화면 `/admin/eco`.
- **켜는 법(한 줄)**: Render env 에 `ECO_LINK1_INBOX_ENABLED=true`(+ 위 원천 env)를 넣고 다시 띄운다 — 끄려면 그 값을 지우거나 `true` 가 아닌 값으로.
- **v1.6 Statory 공개 자리 설정 칸(SOC-R16 ■4 · Statory ASK-58 ■3)** — env 이름만(값은 코드·문서에 0 · `.env*` 읽기·쓰기 0):

  | env | 지금 | 뜻 |
  |---|---|---|
  | `ECO_SOURCE_LATEST_URL` | 빈 값 | Statory 공개 자리(읽기 전용 GET · 봉투 §6-1) 주소 · 비면 import:eco 가 「Statory 미설정」 한 줄만 적고 당기지 않음 · v1.5 의 옛 이름 `ECO_STATORY_EXPORT_URL` 은 **읽지 않음**(옛 주소로 새 열쇠가 나가지 않게) · 넘겨주기(redirect)는 실패로 |
  | `ECO_SOURCE_READ_KEY` | 빈 값(값은 11월 오너) | Statory 읽기 열쇠(그쪽 env `ECO_EXPORT_READ_KEY` 와 같은 값) · 요청 머리 **`x-eco-export-key`**(v1.7 · Statory `EVIDENCE_EXPORT_V1` §5-2 와 같은 이름 · `ECO_SOURCE_READ_HEADER` 한 곳 · v1.6 의 `x-export-key` 는 중독뉴스 열쇠 머리로만 남음) · 비면 머리 없이 당김 |
  | `ECO_LINK1_INBOX_ENABLED` | 꺼짐 | 받는 문 깃발(위 한 줄) — URL · 열쇠가 있어도 이것이 `true` 가 아니면 아무것도 당기지 않음 |

  **켜는 순서 셋**: ① `ECO_SOURCE_LATEST_URL`(Statory 가 깃발 `ECO_EXPORT_ENABLED` 를 켠 뒤 · 꺼진 동안은 그쪽이 404) →
  ② `ECO_SOURCE_READ_KEY`(Statory 쪽과 같은 값 · 틀리면 그쪽 401 → 「Statory 못 읽음」 · 건너뜀) → ③ `ECO_LINK1_INBOX_ENABLED=true`(다시 띄움 · 그날 04:00 부터 열 단계).

### 6-5. KCI 유래 카드 (v1.6 · SOC-R16 ■3 · Statory ASK-58 ■4)

- 알아보는 칸: 줄의 **`source` = `kci`**(칸 이름 · 값은 `KCI_SOURCE` 상수 한 곳 — Statory 가 이름을 바꾸면 그것만).
- **담는 것 = 서지 + KCI 상세 링크 + 짧은 인용만** — `card_id` · `card_version` · `paper_id` · `title` · `authors` · `year` · `venue` · `doi` · `source_url`(KCI 상세) ·
  `statory_page_url` · `license` · `license_use` · `judged_at` · `topics` · `topic` · `field_id` · `generated_at` · `addiction_type` · `source` · `use_until` +
  `quote`(카드의 `quote` · 없으면 `key_findings` 첫 글 → **두 문장 · 300 자까지**). **초록 본문 저장 0** — `abstract` · `key_findings` · `population` · `region` ·
  `design` · `sample` · `limitations` · `fields_missing` 는 받는 표에 담지 않는다.
- 손님 응답(`GET /api/evidence/received` · 깃발 꺼짐 = 404): 항목에 `source: 'kci'` · `quote` · 발견(`keyFindings`) 0 ·
  응답 `credit` = 바닥 출처 줄 `{ ko: 「KCI(한국학술지인용색인) 데이터 활용」, en: 「Uses data from KCI (Korea Citation Index)」 }` —
  **보이는 항목에 KCI 유래가 하나라도 있을 때만**(없으면 `null`). 화면은 그 줄을 바닥에 그대로 낸다.
- 인용의 문장 끝 = `.` `!` `?` `。` `！` `？` `…` 또는 줄바꿈(마침표 없는 줄 나열도 줄마다 한 문장).
- 이미 받은(결정이 있는) 행이라도 원천이 KCI 로 보내면 payload 를 KCI 꼴로 **줄인다**(좁히기만) · 같은 논문(`paper_key`)의 어느 판이 KCI 유래면 KCI 아닌 옛 판은 손님 응답에 내지 않는다.
- 이용 기간: `use_until` 이 지난 KCI 카드는 손님 응답에서 빠진다(행 지움 0 · 관리자 화면에는 남음) · 날짜만 오면 **한국 시각 그날 끝까지** · 날짜를 못 읽으면 지난 것으로.
- 관리자 화면 줄: `source`(`kci` · 그 밖 `null`) · `unknownSubtype`(§1-1).
- **v1.7 DOI 없는 KCI 카드(SOC-R17 ■1 · Statory ASK-58 = `doi` ∨ `source_url` 이면 내보냄)**: `source_url` 이 있으면 받고 서지 링크 = `source_url` ·
  `source_url` 이 없으면(DOI 만 · 둘 다 없음) **거절하지 않고** 받되 `url` 없음 + 받은 줄 `missing` 에 우리 표시(`source_url` · DOI 도 없으면 `doi` 도 · 봉투 `missing` 과 겹침 없이) —
  관리자 화면에 보이고, **손님에게는 링크가 생길 때까지 서지 않는다**(서지 + 링크 규칙). 꼴이 틀린 링크(`https` 아님)는 지금처럼 `source_url_invalid`.
  링크는 **링크를 단 새 판(새 행 · 결정 상속)** 으로 생긴다 — 이미 결정이 있는 행의 `url` · `missing` 은 같은 판이 다시 와도 채우지 않는다(기존 행 변경 0 · 리뷰 A1).
  링크 없는 KCI 판도 그 논문의 KCI 아닌 옛 판을 손님에게서 가린다(KCI 규칙을 비켜 서지 않는 쪽 · 리뷰 A2 · 보이는 것이 줄어드는 쪽).
- 지금 데이터 0(깃발 꺼짐) → 손님 화면 변화 0 · 확인은 fixture(`__fixtures__/statory-export-kci.json` · `statory-export-v17.json` · 시험 `eco-inbox-r16.spec` · `eco-inbox-r17.spec`).

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
| 16 | 판을 넘는 논문 열쇠(새 줄 · SOC-R14 ■2) | ASK-53 리뷰 F1 · CTO 판정 1(10-24): 나가는 `card_id` = 판마다 다른 줄 id · 같은 논문 = `item_id` · ASK-54 가 줄에 `paper_id` 를 더함(10-24 16:1x 실측 Statory main cd3fe04 = 아직 없음) | §6-2 `paper_id`(선택) · §3-3 의 4 · §6-3 `paper_key` · `keep_from_version` — keep/hide 상속 열쇠 = 논문 | **닫힘(받는 쪽 · 검사 · 규칙 · 시험)** — Statory 쪽은 ASK-54 push 뒤 실물 대조(꼴: 글/정수) → **닫힘(양쪽 · SOC-R15 · 10-25)** §8 의 17 |
| 17 | `paper_id` 실물 꼴(새 줄 · SOC-R15) | ASK-54 ■1(판 1.6.51 · main c807de585 · 10-24) `paper_id: text(card.item_id)` — **글**(빈 item_id 면 `null` → 옛 꼴) · `card_id: text(card.id) ?? text(card.item_id)` | §6-2 글 꼴 그대로 받음(fixture statory-export.json · `null` = card 열쇠) | **닫힘** |
| 18 | 중독뉴스 export v0 `subtype` 낱말(새 줄 · SOC-R15) | (중독뉴스 `docs/EXPORT_V0.md` · NEWS-Q12) 묶음 id 에 `tobacco`(§1 별칭) · `digital`(§1 에 없음)이 나옴 — 「게임·디지털」 = `gaming` · `digital` 둘 | ~~§1 대로 그 줄 거절~~ → **v1.6 §1-1 받는 쪽 대응표**(`tobacco`→`nicotine` · `digital`→`smartphone` · 중독뉴스 변경 0) | **닫힘**(SOC-R16 · 10-26) |
| 19 | KCI 유래 카드(새 줄 · SOC-R16) | Statory ASK-58 ■4(지시서 fd12ec071 · 10-26 · 코드 아직) — 줄에 `source: 'kci'` · `use_until` · 내보내기에서 초록 비움 | §6-5 — 같은 이름으로 받음 · 초록 저장 0 · 서지 + 링크 + 인용 ≤2문장 · 출처 줄 · **v1.7** 열쇠 머리 `x-eco-export-key` · DOI 없는 KCI = `source_url` 로 받음 | **닫힘(받는 쪽 · SOC-R17 · 10-26)** — 머리 이름 · 내보냄 조건(DOI ∨ source_url)은 SOC-R17 지시서 위치판(ASK-58 가지 · 1.6.56)으로 맞춤 · Statory main 실물 대조는 ASK-58 push 뒤 |

## 9. CTO 판정 필요 (v1 이 안전한 쪽으로 읽어 둔 것)

| # | 무엇 | v1 의 읽기 |
|---|---|---|
| C1 | ~~면허 철자~~ | **닫힘(v1.1 · SOC-R11)** — 낱말 `licence` · 나가는 열쇠 `license`·`license_use` 는 Statory 이름 그대로 |
| C2 | 중독뉴스 category 하나 대 여럿(알코올·약물 · 게임·디지털) | `[]`(분야 전체) — 중독뉴스가 `subtype[]` 을 v0 에 더하면 그 값을 씀 |
| C3 | ~~받은 카드의 새 판 — 우리 `keep` 을 이어받나~~ | **닫힘(v1.4 · CTO 10-24)** — 같은 `paper_id` 의 새 판은 keep · hide 모두 이어받음 · keep 은 표식 `keep_from_version` |
| C4 | 몸 전체가 깨진 회차의 숨김 상속 | 돌리지 않음(그 회차 건너뜀) |
| C5 | ~~Statory 내보내기 면허 값이 늘 「모름」~~ | **닫힘(ASK-50 ■1 · §8-3)** — 값은 글자 그대로 온다 · 꼴은 §8-13 |
| C7 | ~~중독뉴스 `subtype` 의 `tobacco` · `digital`~~ | **닫힘(v1.6 · SOC-R16 ■2)** — 받는 쪽 대응표 §1-1 · 보내는 쪽 값 그대로 · 모르는 값은 표시만 |
| C8 | ~~§1 표의 나머지 별칭(`internet` · `social-media` → `smartphone` · `ai-dependence` → `ai`)~~ | **닫힘(v1.7 · CTO R16 판정 · SOC-R17 ■2)** — 대응표 §1-1 에 셋 더함 |
| C6 | `sources` 의 등급 — `sources.kind` 는 주제 낱말(prevalence · policy · treatment · enforcement · market)이라 등급 칸이 아니다 | `policy` → `report` · 그 밖 → `statistic` 으로 읽음(행 변경 0 · 출처 하나하나의 등급 칸은 덧붙임 migration 후보) |
