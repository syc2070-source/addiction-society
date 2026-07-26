"""소스별 어댑터 인터페이스 (AS-M3-2a).

추출된 ExtractedDoc → indicators/observations 레코드로 매핑한다.
소스마다 표 위치·라벨·단위가 다르므로 '차이'는 전부 어댑터가 흡수하고,
출력은 collect:indicators가 읽는 data.json 형태로 통일한다(백엔드 TS가 그대로 upsert).

출력 레코드(지표 1개):
  {
    "code", "domain", "nameKo", "nameEn", "unit",
    "definitionKo",   # 원칙4: 비어 있으면 collect:indicators가 skip
    "methodNote", "sourceId",
    "observations": [ {"geo","period","value","qualifier","sourceUrl"} , ... ]
  }
"""

from abc import ABC, abstractmethod
from typing import List

from .extractor import ExtractedDoc


class SourceAdapter(ABC):
    """모든 소스 어댑터의 공통 계약."""

    #: sources 레지스트리 id (observations.source_id FK 대상)
    source_id: str = ""

    @abstractmethod
    def map(self, doc: ExtractedDoc, meta: dict) -> List[dict]:
        """doc + meta(surveyYear·sourceUrl 등) → 지표 레코드 리스트."""
        raise NotImplementedError
