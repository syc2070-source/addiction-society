"""공통 PDF 추출 계층 (AS-M3-2a) — 소스 불문 재사용.

PDF(경로) → { text, tables[] } 표준 형태로 추출한다. pdfplumber 기반.
소스별 '의미' 매핑(어떤 표의 어느 행이 어떤 지표인가)은 여기서 하지 않는다 — adapter의 몫.
이 계층은 "픽셀을 문자·행렬로" 바꾸는 일만 한다(재사용 지점).

텍스트 레이어가 없으면(스캔 PDF) has_text_layer=False → 호출측이 OCR 경로로 분기.
"""

from dataclasses import dataclass, field
from typing import List, Optional

import pdfplumber


@dataclass
class Table:
    """추출된 표 하나. rows[r][c] = 셀 문자열(빈 셀/병합 상단은 None)."""

    page: int
    rows: List[List[Optional[str]]]


@dataclass
class ExtractedDoc:
    path: str
    n_pages: int
    text: str
    tables: List[Table] = field(default_factory=list)
    has_text_layer: bool = True


def extract(path: str) -> ExtractedDoc:
    """PDF 전체에서 텍스트 + 모든 표를 뽑는다."""
    texts: List[str] = []
    tables: List[Table] = []
    with pdfplumber.open(path) as pdf:
        n_pages = len(pdf.pages)
        for i, page in enumerate(pdf.pages, start=1):
            texts.append(page.extract_text() or "")
            for raw in page.extract_tables() or []:
                tables.append(Table(page=i, rows=raw))
    full = "\n".join(texts).strip()
    return ExtractedDoc(
        path=path,
        n_pages=n_pages,
        text=full,
        tables=tables,
        has_text_layer=bool(full),
    )
