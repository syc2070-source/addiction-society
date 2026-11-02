# evidence_export_v1 — Statory 서재 → 중독사회 카드 묶음 계약

SOC-R20 ■5 · 2026-11-02 · 운반 = 파일(받는 문 eco inbox 는 꺼진 채)

## 자리

| 파일 | 뜻 |
|---|---|
| `frontend-next/data/statory/evidence_export_v1.json` | 실물(Statory 가 내보낸 판정 카드 · R21 에 들어옴) |
| `frontend-next/data/statory/evidence_export_v1.sample.json` | 견본(합성 18장 · 실명·실제 논문 제목 0 · 실제 연구 결과 아님) |

지시서의 `data/statory/` 는 프런트 뿌리(`frontend-next/`) 아래에 둔다 — Vercel 이 `frontend-next` 를 뿌리로 빌드하므로
그 밖의 파일은 서버 함수에 실리지 않는다. 요청 때 다시 그리는 쪽(ISR)에도 실리도록 `next.config.ts`
`outputFileTracingIncludes` 에 `./data/statory/*.json` 만 넣었다.

## 꼴

```json
{
  "version": "evidence_export_v1",
  "exported_at": "2026-11-02T00:00:00.000Z",
  "field": "addiction",
  "source": "statory",
  "cards": [
    {
      "card_id": "string · 묶음 안에서 하나",
      "type": "알코올 | 도박 | 마약 | 스마트폰 | 게임 | 담배 | 기타",
      "title": "string · 원 제목 그대로",
      "authors_short": "string · 예: 홍길동 외 / Smith et al.",
      "year": 2024,
      "country": "ISO 3166-1 alpha-2 · KR · US …",
      "sample_n": 1200,
      "design": "cross_sectional | cohort | panel | case_control | rct | qualitative | systematic_review | meta_analysis | other",
      "instrument": "string | null · 예: AUDIT",
      "findings_ko": "string | null · 판정된 한글 발췌",
      "findings_src": "string | null · 원문 발췌(원문 언어 그대로)",
      "implications_ko": "string | null",
      "source_grade": "string | null · 예: A",
      "license": "cc_by | cc_by_nc | open_access | quote_only | other",
      "doi": "string | null",
      "url": "string | null",
      "approved_at": "ISO 날짜 · 사람이 판정한 때"
    }
  ]
}
```

필수 칸: `card_id` · `type`(위 일곱 가운데) · `title` · `year`(정수) · `approved_at`. 없거나 틀리면 그 카드만 뺀다.
묶음 머리(`version` · `exported_at` · `cards` 배열)가 틀리면 묶음 전체를 없는 것으로 본다.
`design` 이 목록 밖이면 `other`, `license` 가 목록 밖이면 가장 좁게 `quote_only` 로 읽는다.

## 읽기 규칙 (`frontend-next/src/lib/statoryEvidence.ts`)

1. **분기 하나** — 실물 파일이 있으면 실물만 읽는다(견본은 읽지 않음). 실물이 있는데 꼴이 틀리면 견본으로 넘어가지 않고 없음.
   실물이 없을 때만, 부른 쪽이 허락하면(미리보기 `/preview/home` · `/evidence/<유형>`) 견본.
2. **파일 없으면 섹션 자체가 없다**(빈 칸 0).
3. 결과 문장: ko = `findings_ko` → 비면 `findings_src` + 「(원문)」. en = `findings_src` 가 영어면 그대로, 한글이면 글 없이
   「(Korean)」 꼬리표만(en 화면 한글 0 관문). 제목·저자명도 en 에서 한글이면 「(Korean title)」 「(Korean authors)」.
4. `license = quote_only` 면 발췌 0 — 제목·출처만.
5. 추정·요약·번역 생성 0 — 카드에 있는 문장 그대로. 모델 호출 0.
6. 유형 타일(카드가 한 장 이상인 유형만): 편 수 n · 한국 k편(`country = KR`) · 연도 범위 · 대표 결과 문장 하나 + 출처(저자 · 연도 · 나라).
   대표 = `findings_ko` 있음 · 발췌 허락 → 한국 우선 → `approved_at` 최신 → `card_id`.
7. `/evidence/<유형>` = 카드 목록(연도 내림 → `approved_at` 내림) · 머리 「Statory 서재에서 읽기 전용으로 가져옴 · 판정된 카드만 · 추정 0 · 가져온 날짜」.
   견본이면 noindex · 「견본 자료」 띠. sitemap 에 없음.
8. 현 대문(`/`)과 공개 API(backend)는 이 묶음을 읽지 않는다 — `src/lib/homeV3.test.mts` 가 지킨다.

## R21 에 할 것

- Statory 가 실물 `evidence_export_v1.json` 을 내보내 이 자리에 커밋(파일 운반) → 견본은 자동으로 읽히지 않음(지움 0).
- 받는 문(eco inbox)으로 옮길지는 따로 결정.
