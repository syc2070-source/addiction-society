# AS-M3-2a — PDF 추출 엔진 설계 + kcgp 실사

> 성격: **조사·설계**. 실수집·실 마이그레이션은 M3-2b.
> 상위 기준: AS-MASTER-BLUEPRINT (제2장 /indicators, 제8장 원칙3·4·8), AS-M3-1 스키마.
> 환경 제약: 조직 egress 정책이 **kcgp.or.kr·data.go.kr을 403(CONNECT)으로 차단** →
>  이 샌드박스에서 실제 gov PDF를 내려받을 수 없다. 회차·구조는 WebSearch로 확인하고,
>  **엔진 실현성은 합성 fixture PDF로 실제 추출을 돌려 증명**했다(아래 §5). 실 PDF 추출은 M3-2b.

---

## 1. PDF 라이브러리 권고안

| 방안 | 표 구조 | 설치부담 | Render(Node) | 판정 |
|---|---|---|---|---|
| Node `pdf-parse`/`pdfjs-dist` | 텍스트만(표 복원 약) | 가벼움 | 쉬움 | 표 통계엔 불충분 |
| Node `tabula-js` | 표 O | **JRE 필요** | 무거움 | 비권장 |
| **Python `pdfplumber`** | 표 O(좌표·괘선) | 보통(pdfminer/cffi/Pillow) | 런타임엔 부담 | **권고(오프라인)** |
| Python `camelot` | ruled table 강 | **Ghostscript+OpenCV** | 무거움 | 보조(필요 시) |
| OCR `tesseract`+`pytesseract` | 스캔본 | 시스템 패키지 | 무거움 | 스캔본만 |

**권고**: **pdfplumber를 오프라인 단계(로컬/CI)로 실행** → 검수된 JSON 산출 → 기존
`collect:indicators`가 upsert. 이유:
- PDF 추출은 요청 시점이 아니라 **주기 배치**(회차 발표 시). Render Node 서비스에 Python+
  네이티브 의존을 섞으면 빌드 취약.
- 이미 쓰는 **"검증 data.json → 시드" 패턴**(kcgp-youth.data.json)과 일치. 원칙8(검수 후 게시)에
  부합 — 오퍼레이터가 정의·값을 검수 후 커밋.
- `camelot`/OCR은 pdfplumber가 못 잡는 표·스캔본에만 조건부 도입.

## 2. 엔진 구조 (코드 골격 — 실동작은 fixture로 검증, 실 PDF는 2b)

```
tools/pdf-extract/
  engine/extractor.py    # 공통 추출: PDF → {text, tables[]}   (재사용 지점)
  engine/adapter.py      # SourceAdapter 인터페이스(추상)
  adapters/kcgp_youth.py # 첫 어댑터: 도박문제 수준 표 → indicators/observations
  run.py                 # CLI: PDF → 어댑터 → JSON(collect:indicators 형태)
  fixtures/              # 합성 PDF 생성 + 추출 샘플(실현성 증명)
```
- **공통 계층**(extractor): "픽셀 → 문자·행렬"만. 소스 불문 재사용.
- **어댑터**(SourceAdapter.map): 소스별 표 위치·라벨·단위 차이를 흡수 → 통일된 지표 레코드.
- 새 소스(대검 월간동향·NIA 스마트폰)는 **어댑터 파일만 추가**. 추출 계층 공유.
- 출력 = `collect:indicators`가 읽는 data.json 형태 → 백엔드 TS가 그대로 upsert.

### 통계 vs 논문 분기
- 통계 PDF: 표 → 어댑터 → **observations**.
- 논문 PDF: 본문 text 추출은 공유, 그러나 표가 아니라 **DeepSeek 요약(P4) → research 테이블**.
  이번 범위는 설계 언급만. 구현은 P4.

## 3. kcgp 회차 매트릭스 (연도 × URL × 확보여부)

조사 주기: **2015 1차 시범 → 2018 2차 → 2020 3차 → 2022 4차 시범 → 2024 정식**(약 2년 주기,
근거 사감위법 §14①7). ※ 회차 차수는 검색 기반이며 2b에서 보고서 표지로 확정.

| 회차/연도 | 랜딩·데이터셋(검색 검증) | 직접 PDF 파일 URL | 확보 |
|---|---|---|---|
| 2024(정식) | data.go.kr `/data/15142248/fileData.do` (결과보고서, 등록 2025-02-27) · kcgp `bbs/B0000063/view.do?nttId=315267&menuNo=200240` | 첨부 파일 URL 미확인 | 랜딩 O / **직접 PDF 미확보** |
| 2022(4차) | kcgp 결과보고서 목록 `bbs/B0000063/list.do?menuNo=200240` | 미확인 | 랜딩 O / **미확보** |
| 2020(3차) | 〃 | 미확인 | 랜딩 O / **미확보** |
| 2018(2차) | 〃 | 미확인 | 랜딩 O / **미확보** |
| 2015(1차) | 〃 | 미확인 | 랜딩 O / **미확보** |

부속 자료 게시판(검증): 조사원자료 `B0000064/menuNo=200241`, 코드북 `B0000066/menuNo=200242`,
조사개요 `contents.do?menuNo=200238`.

> **미확보 사유(추측 금지)**: egress가 kcgp·data.go.kr을 차단해 게시판을 열어 회차별 **첨부
> 파일(nttId·atchFileId) 직접 URL을 열거할 수 없었다.** 랜딩/데이터셋 페이지는 검색으로 확인됨.
> 직접 PDF URL 확보 + 실제 열람은 **M3-2b(운영/로컬, gov 접근)**에서 수행한다.

## 4. 추출 가능 지표 후보 + 정의 출처 + 시계열

문서화된 '도박문제 수준' 표(위험군/문제군/전체 × 구분) 기준:

| indicator code | 지표명 | 단위 | 분해 차원 | 시계열(가능) |
|---|---|---|---|---|
| `kcgp_youth_gambling_problem_rate` | 도박문제 수준(위험군+문제군) | % | 전체·성별·학교급 | 2015–2024(핵심, 척도 연속성 확인 필요) |
| `kcgp_youth_gambling_atrisk_rate` | 위험군(YELLOW) | % | 전체·성별·학교급 | 2015–2024 |
| `kcgp_youth_gambling_problem_group_rate` | 문제군(RED) | % | 전체·성별·학교급 | 2015–2024 |
| (후보) 돈내기 게임 경험률 / 온라인 도박 경험률 등 | | % | 회차별 유무 상이 | 2b에서 표 확인 후 |

- **정의(definition_ko) 출처**: 결과보고서의 **'조사 개요' + '도박문제 수준(분류)' 절**(도박문제
  선별척도[청소년용]에 따른 위험군·문제군 정의) 및 웹 조사개요(menuNo=200238). 2b에서 원문 문장을
  그대로 발췌해 확정(현재 어댑터의 정의는 잠정).
- kcgp 하나에서 **핵심 3지표(+세부 후보)**. 각 지표에 전체/성별/학교급 분해.

### 분해 처리 판단 (M3-1 스키마 기준) — 설계 발견
분해(성별·학교급)를 **indicator로 쪼개지 않고 observation의 `qualifier`에 담는다**(지표 폭발 방지).
그러나 M3-1 observations 유니크 키 `(indicator_id, source_id, geo, period)`는 **qualifier를
포함하지 않아** 같은 (지표·지역·기간)의 분해 행들이 **충돌**한다(실증: §5에서 지표당 3행 생성).
→ **M3-2b 선행 스키마 변경 권고**: 유니크 키에 `qualifier` 추가 + 전체 행은 sentinel
`qualifier='total'`(NULL 대신 — postgres에서 NULL은 유니크에서 서로 구별되어 중복 허용되므로).
additive 마이그레이션 1건. `geo`는 지역 의미 유지(전국 KR), 분해는 qualifier로.

## 5. 표 추출 실샘플 (엔진 실현성 증명)

> gov PDF 접근이 막혀, **문서화된 표 레이아웃을 모사한 합성 fixture PDF**(`fixtures/make_sample_pdf.py`)로
> `extractor → kcgp adapter`를 **실제로 실행**했다. 전체값(4.8/3.9/0.9)만 실제 2022 발표치와
> 일치시키고 **성별 분해값은 더미**(엔진 검증용). 실값·실표는 2b에서 원본으로.

**extractor 원시 추출**(pdfplumber, `pages=1 tables=1 text_layer=True`):
```
['구분', '전체', '남학생', '여학생']
['도박문제 수준', '4.8%', '6.5%', '3.0%']
['위험군', '3.9%', '5.1%', '2.6%']
['문제군', '0.9%', '1.4%', '0.4%']
```
**kcgp 어댑터 매핑 결과**(→ `fixtures/sample_extracted.json`): 지표 3개, 각 관측치 3행(total/남/여).
예:
```json
{ "code": "kcgp_youth_gambling_atrisk_rate", "unit": "%",
  "observations": [
    {"geo":"KR","period":"2022","value":"3.9","qualifier":"total"},
    {"geo":"KR","period":"2022","value":"5.1","qualifier":"group=남학생"},
    {"geo":"KR","period":"2022","value":"2.6","qualifier":"group=여학생"} ] }
```
→ 추출→매핑→시드 형태 산출까지 **코드 경로가 실제로 동작**함을 확인(엔진 실현성). 지표당 3행이
나오는 것이 §4의 유니크 키 충돌을 실증한다.

## 6. 추출 난이도·실패 예상 (M3-2b 리스크)
- **직접 PDF URL 미확보(egress)** → 2b에서 gov 접근으로 회차별 첨부 URL 확보(최우선).
- **회차별 포맷 불일치**: 초기 시범조사 vs 정식 조사 표 구조가 다를 수 있음 → 어댑터에 회차 분기.
- **병합셀 교차표**(학교급×성별): pdfplumber가 병합 상단을 None으로 반환 → 전진 채움 후처리 필요.
- **척도/분류 변경**: 회차 간 도박문제 수준 분류 기준이 바뀌면 시계열 연속성 주의 → method_note 각주.
- **스캔본 여부**: kcgp는 디지털 생성(텍스트레이어) 추정이나 2b에서 `has_text_layer`로 확인,
  False면 tesseract OCR 경로.
- **유니크 키 스키마 변경 선행**(§4).

## 7. M3-2b 실행 계획 초안
1. (gov 접근) kcgp 결과보고서 게시판에서 **회차별 PDF 직접 URL 확보**(연도×URL 확정, 미확보 0 목표).
2. observations **유니크 키에 qualifier 추가** additive 마이그레이션(sentinel 'total').
3. 실 PDF로 `run.py` 실행 → 정의 원문 발췌로 definition_ko 확정 → **사람 검수** →
   `backend/src/indicators/seed/kcgp-youth.data.json` 갱신 → `collect:indicators`.
4. 회차 5개(2015–2024) 시계열 적재. 프론트 `/indicators/[code]`에 연도별·분해 표시.
5. 다음 소스(대검 월간동향·NIA)는 **어댑터만 추가**.
