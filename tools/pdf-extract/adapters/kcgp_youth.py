"""kcgp 청소년 도박 실태조사 어댑터 (첫 어댑터, AS-M3-2a).

'도박문제 수준' 표(위험군/문제군/전체 × 구분[전체·성별·학교급])를 찾아
지표·관측치로 매핑한다.

⚠️ 골격 단계: 실제 kcgp PDF의 표 위치·라벨·페이지는 M3-2b에서 원본으로 확정한다.
   본 어댑터는 '문서화된 표 레이아웃'(헤더 [구분, 전체, …] + 위험군/문제군/도박문제 수준 행)
   기준으로 작성했으며, engine/extractor로 뽑은 fixtures 표에서 실제 동작을 검증한다.

분해 차원(성별·학교급) 처리: observation.qualifier에 담는다('total' 또는 'group=남학생').
   ※ M3-1 스키마의 observations 유니크 키는 (indicator_id, source_id, geo, period)로
     qualifier를 포함하지 않는다 → 분해 행이 같은 (지표·지역·기간)에서 충돌한다.
     M3-2b에서 유니크 키에 qualifier를 추가(또는 sentinel 'total')하는 additive 마이그레이션이
     선행되어야 한다. 자세한 근거는 docs/AS-M3-2a-PDF-RECON.md.
"""

from typing import List, Optional

from engine.adapter import SourceAdapter
from engine.extractor import ExtractedDoc

# 표의 행 라벨 → (지표 code, 지표명, 정의). 정의는 M3-2b에서 보고서 원문으로 교체(현재는 잠정).
LEVEL_ROWS = {
    "도박문제 수준": (
        "kcgp_youth_gambling_problem_rate",
        "청소년 도박문제 수준(위험군+문제군) 비율",
        "재학 중 청소년(초4~고3)을 도박문제 선별척도로 분류했을 때 위험군과 문제군을 합한 비율(%).",
    ),
    "위험군": (
        "kcgp_youth_gambling_atrisk_rate",
        "청소년 도박문제 위험군(YELLOW) 비율",
        "재학 중 청소년 중 도박문제 선별척도에서 위험군(중위험, YELLOW)으로 분류된 비율(%).",
    ),
    "문제군": (
        "kcgp_youth_gambling_problem_group_rate",
        "청소년 도박문제 문제군(RED) 비율",
        "재학 중 청소년 중 도박문제 선별척도에서 문제군(문제성, RED)으로 분류된 비율(%).",
    ),
}
TOTAL_COLS = {"전체", "계", "합계"}


def _clean(s: Optional[str]) -> str:
    return (s or "").replace("\n", " ").strip()


def _num(s: Optional[str]) -> Optional[str]:
    t = _clean(s).replace("%", "").replace(",", "")
    try:
        return str(float(t))
    except ValueError:
        return None


def _match_level(label: str) -> Optional[str]:
    # '도박문제 수준'을 '위험군'/'문제군'보다 먼저 검사(부분일치 우선순위).
    for key in ("도박문제 수준", "위험군", "문제군"):
        if key in label:
            return key
    return None


class KcgpYouthAdapter(SourceAdapter):
    source_id = "kcgp_youth"

    def map(self, doc: ExtractedDoc, meta: dict) -> List[dict]:
        year = str(meta["surveyYear"])
        url = meta["sourceUrl"]

        target = self._find_level_table(doc)
        if target is None:
            return []

        header = [_clean(c) for c in target.rows[0]]
        cols = header[1:]  # 첫 칸은 '구분'

        records = {}
        for row in target.rows[1:]:
            label = _clean(row[0])
            key = _match_level(label)
            if not key:
                continue
            code, name_ko, definition = LEVEL_ROWS[key]
            observations = []
            for ci, col in enumerate(cols, start=1):
                if ci >= len(row):
                    continue
                value = _num(row[ci])
                if value is None:
                    continue
                qualifier = "total" if col in TOTAL_COLS else f"group={col}"
                observations.append(
                    {
                        "geo": "KR",
                        "period": year,
                        "value": value,
                        "qualifier": qualifier,
                        "sourceUrl": url,
                    }
                )
            if observations:
                records[code] = {
                    "code": code,
                    "domain": "D1",
                    "nameKo": name_ko,
                    "nameEn": None,
                    "unit": "%",
                    "definitionKo": definition,
                    "methodNote": (
                        f"한국도박문제예방치유원 청소년 도박 실태조사 {year} · "
                        "'도박문제 수준' 표에서 추출."
                    ),
                    "sourceId": self.source_id,
                    "observations": observations,
                }
        return list(records.values())

    @staticmethod
    def _find_level_table(doc: ExtractedDoc):
        """위험군·문제군을 모두 담은 표를 도박문제 수준 표로 판단."""
        for table in doc.tables:
            flat = [_clean(c) for r in table.rows for c in r]
            if any("위험군" in c for c in flat) and any(
                "문제군" in c for c in flat
            ):
                return table
        return None
