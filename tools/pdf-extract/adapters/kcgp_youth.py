"""kcgp 청소년 도박 실태조사 어댑터 (첫 어댑터, AS-M3-2a).

'도박문제 수준' 표(위험군/문제군/전체 × 구분[전체·성별·학교급])를 찾아
지표·관측치로 매핑한다.

⚠️ 표 레이아웃은 '문서화된 형태'(헤더 [구분, 전체, …] + 위험군/문제군/도박문제 수준 행)
   기준으로 작성했고 fixtures 표에서 동작을 검증했다. 실제 회차 PDF에서 표를 못 찾으면
   빈 배열을 돌려주고(추측 금지) 서버가 '지표 0건'으로 보고한다 — 그때 이 파일의
   LEVEL_ROWS·_find_level_table을 원본에 맞춰 고친다.

분해 차원(성별·학교급) 처리: observation.qualifier에 담는다('total' 또는 'group=남학생').
   유니크 키에 qualifier가 포함되는 마이그레이션은 AS-M3-2에서 적용 완료 →
   분해 행이 충돌 없이 저장된다.
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

# 회차별 조사대상(모집단). AS-PDF-RUN.
#
# ⚠️ 이 조사는 회차마다 모집단이 바뀌었다. 그대로 한 줄로 이으면 실제로는
#    존재하지 않는 급감·급증이 그려진다(예: 2018 위험군 6.4% → 2020 1.7%은
#    수치 변화가 아니라 조사대상·척도 변경의 결과일 수 있다).
#    kcgp 자신도 "연도별 비교 시 주의"를 명시한다.
#    → 값과 함께 모집단을 note로 실어보내 화면이 경고할 수 있게 한다.
#    확정되지 않은 회차는 여기 넣지 않는다(추측 금지). 서버 쪽
#    access_detail.pdf_rounds[].population이 지정되면 그 값이 우선한다.
POPULATION_BY_YEAR = {
    "2015": "조사대상: 중·고 재학생 (고3 제외) — 1차 시범조사",
    "2018": "조사대상: 중·고 재학생 (고3 제외) — 2차 시범조사",
    "2020": "조사대상: 중·고 재학생 (고3 포함) — 3차 시범조사",
    "2022": "조사대상: 초4~고3 재학생 — 4차 시범조사",
    "2024": "조사대상: 초4~고3 재학생 — 국가승인통계(제469001호) 최초 회차",
}


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
                        # 모집단 단서 — 회차 간 직접 비교 오독 방지(AS-PDF-RUN)
                        "note": POPULATION_BY_YEAR.get(year),
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
                        "'도박문제 수준' 표에서 추출. "
                        "회차마다 조사대상이 달라 연도 간 직접 비교에는 주의가 필요하다"
                        "(관측치별 '조사대상' 단서 참조)."
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
