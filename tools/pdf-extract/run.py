"""CLI: PDF → 소스 어댑터 → JSON(collect:indicators 형태) (AS-M3-2a).

사용:
  python run.py <pdf> --source kcgp_youth --year 2022 --url <원자료 딥링크> [-o out.json]

출력 JSON을 backend/src/indicators/seed/의 데이터 파일로 저장하면,
검수 후 `npm run collect:indicators`가 그대로 upsert한다(오프라인 추출 → 검수 → 시드).

⚠️ 실제 kcgp PDF 수집·검증은 M3-2b. 본 CLI는 골격 + fixtures 검증용.
"""

import argparse
import json
import sys

from engine.extractor import extract
from adapters.kcgp_youth import KcgpYouthAdapter

ADAPTERS = {a.source_id: a for a in [KcgpYouthAdapter()]}


def main() -> int:
    ap = argparse.ArgumentParser(description="PDF → indicators/observations JSON")
    ap.add_argument("pdf", help="입력 PDF 경로")
    ap.add_argument("--source", required=True, help=f"어댑터: {', '.join(ADAPTERS)}")
    ap.add_argument("--year", type=int, required=True, help="조사 연도(period)")
    ap.add_argument("--url", required=True, help="원자료 딥링크(source_url)")
    ap.add_argument("-o", "--out", help="출력 파일(미지정 시 stdout)")
    args = ap.parse_args()

    adapter = ADAPTERS.get(args.source)
    if adapter is None:
        print(f"unknown source: {args.source}", file=sys.stderr)
        return 2

    doc = extract(args.pdf)
    print(
        f"[extract] pages={doc.n_pages} tables={len(doc.tables)} "
        f"text_layer={doc.has_text_layer}",
        file=sys.stderr,
    )

    indicators = adapter.map(doc, {"surveyYear": args.year, "sourceUrl": args.url})
    payload = {
        "sourceId": adapter.source_id,
        "sourceUrl": args.url,
        "indicators": indicators,
    }
    text = json.dumps(payload, ensure_ascii=False, indent=2)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text + "\n")
        print(f"[write] {args.out} ({len(indicators)} indicators)", file=sys.stderr)
    else:
        print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
