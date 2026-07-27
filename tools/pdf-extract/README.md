# PDF 추출 엔진 (AS-M3-2a)

관측소 원자료 대부분이 PDF(통계 보고서·논문)다. 소스마다 파서를 새로 짜지 않도록
**공통 추출 계층 + 소스별 어댑터** 구조로 둔다.

## 왜 Python(pdfplumber)인가 — 권고 근거
- **Node/TS**: `pdf-parse`·`pdfjs-dist`는 텍스트만. 병합셀 포함 **표 구조 복원이 약함**.
  `tabula-js`는 Java(JRE) 의존이라 Render Node 서비스에 얹기 무겁다.
- **Python**: `pdfplumber`(선/좌표 기반 표 추출, 대부분의 괘선 표 처리), 필요 시 `camelot`
  (ruled table 강함, 단 Ghostscript+OpenCV 의존). 성숙도·표 대응력이 앞선다.
- **배포 제약**: 추출은 요청 시점이 아니라 **주기적 배치**다. Render의 Node 서비스에
  Python+네이티브 의존(cffi/Pillow, camelot의 GS/OpenCV)을 섞으면 빌드가 취약해진다.
- **권고**: pdfplumber를 **오프라인 단계**(로컬/CI)로 돌려 검수된 JSON을 산출하고,
  기존 `npm run collect:indicators`가 그 JSON을 upsert한다. 이는 이미 쓰는
  "검증 data.json → 시드" 패턴(kcgp-youth.data.json)과 일치하고, 원칙8(검수 후 게시)과도 맞다.
  Render Node 서비스는 건드리지 않는다. camelot/OCR은 pdfplumber 실패 표·스캔본에만.

## 구조
```
tools/pdf-extract/
  engine/extractor.py   # 공통: PDF → {text, tables[]}  (pdfplumber)
  engine/adapter.py     # 소스별 어댑터 인터페이스(SourceAdapter)
  adapters/kcgp_youth.py# 첫 어댑터: 도박문제 수준 표 → indicators/observations
  run.py                # CLI: PDF → 어댑터 → JSON(collect:indicators 형태)
  fixtures/             # 합성 PDF 생성 + 추출 샘플(엔진 실현성 증명)
```
새 소스(대검 월간동향·NIA 스마트폰)는 **어댑터 파일만 추가**하면 된다(추출 계층 재사용).

## 통계 vs 논문 분기
- **통계 PDF**: 표 → 어댑터 → observations (이 도구).
- **논문 PDF**: 표가 아니라 본문 → 요약. 추출 계층(text)만 공유하고, 이후는
  DeepSeek 요약(P4) → **research 테이블**로 간다(observations 아님). 구현은 P4 범위.

## 새 PDF 소스 추가 절차 (AS-M3-2d — env 아님, sources 등록)

추출 대상·URL·회차는 **env가 아니라 `sources.access_detail`(DB)** 에 둔다.
소스가 늘어도 env가 증식하지 않고, 새 회차는 `period` 한 줄만 고치면 된다.

1. **어댑터 추가**: `adapters/<id>.py`에 `SourceAdapter` 구현(표 → 지표/관측치).
   `run.py`의 `ADAPTERS`에 등록. (kcgp_youth가 예시)
2. **sources에 힌트 등록** — `sources.seed.ts`의 해당 소스 `accessDetail`에:
   ```jsonc
   {
     "pdf": true,                     // 추출 대상 표시
     "parser_adapter": "kcgp_youth",  // 위 어댑터 id
     "period": "2024",                // 회차(연도) — 새 회차 발간 시 여기만 갱신
     // 아래 둘 중 하나:
     "pdf_url": "https://.../report.pdf",              // 직접 URL을 알면 최우선
     "pdf_finder": { "type": "datagokr_filedata",      // 모르면 서버가 찾는다
                     "datasetUrl": "https://www.data.go.kr/data/15142248/fileData.do" }
   }
   ```
   `npm run seed:sources`로 반영(멱등). 운영 DB에서 SQL로 직접 고쳐도 된다.
3. 끝. 크론(월 1회)이 `pdf:true`인 소스를 순회하며 추출 → **pending** 적재 → Discord 검수 요청.
   즉시 실행은 `POST /api/indicators/extract-pdf {"source":"<id>"}`.

`pdf_finder: datagokr_filedata`는 data.go.kr 데이터셋 페이지 HTML에서 `atchFileId(FILE_…)`를
찾아 `cmm/cmm/fileDownload.do` URL을 만들고, **실제로 받아 PDF 매직바이트까지 확인**한다
(추측 URL 금지). 새 회차로 첨부가 교체돼도 자동 추종.

## 사용
```
pip install -r requirements.txt
# (검증용) 합성 fixture로 엔진 동작 확인:
python fixtures/make_sample_pdf.py /tmp/sample_kcgp.pdf
python run.py /tmp/sample_kcgp.pdf --source kcgp_youth --year 2022 \
  --url https://www.data.go.kr/data/15142248/fileData.do -o fixtures/sample_extracted.json

# (M3-2b 실사용) 실제 kcgp PDF로:
python run.py <실제_결과보고서.pdf> --source kcgp_youth --year 2024 --url <원자료 딥링크> \
  -o ../../backend/src/indicators/seed/kcgp-youth.data.json
# → 사람이 정의·값 검수 후 커밋 → npm run collect:indicators
```

> ⚠️ `fixtures/sample_extracted.json`의 성별 분해 수치는 **엔진 검증용 더미**다(실값 아님).
> 전체(total) 값 4.8/3.9/0.9만 실제 2022 발표치와 일치. 실 분해값은 M3-2b에서 원본 PDF로.

## observations 유니크 키 — 해결됨(AS-M3-2)
분해(성별·학교급)를 `qualifier`에 담을 수 있도록, 유니크 키에 qualifier를 포함했다
(`(indicator_id, source_id, geo, period, qualifier)`, 전체 행은 sentinel `qualifier='total'`).
마이그레이션 `1785300000000-ObservationQualifierKey`. 어댑터는 전체값에 `qualifier='total'`,
분해값에 `group=…`을 emit하면 된다(이 kcgp 어댑터가 이미 그렇게 한다).
