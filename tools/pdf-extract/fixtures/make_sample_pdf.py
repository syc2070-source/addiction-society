"""합성 fixture PDF 생성 (AS-M3-2a) — 엔진 검증 전용.

kcgp 청소년 도박 실태조사 '도박문제 수준' 표의 **문서화된 레이아웃**을 모사한다.
⚠️ 여기 숫자는 엔진 동작 검증용 더미이며 실제 조사값이 아니다(실값은 M3-2b에서 원본 PDF로).
   실제 발표 통계(2022 위험군 3.9/문제군 0.9)는 collect:indicators의 검증 데이터에 별도로 있다.
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# 한글 폰트 등록(있으면). 없으면 reportlab 기본으로도 표 구조 자체는 추출된다.
# (name, path, subfontIndex) — .ttc는 컬렉션이라 subfontIndex 필요.
_CANDIDATES = [
    ("KR", "/usr/share/fonts/truetype/nanum/NanumGothic.ttf", 0),
    ("KR", "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc", 0),  # WenQuanYi(한글 포함)
    ("KR", "/usr/share/fonts/opentype/unifont/unifont.otf", 0),
]
FONT = "Helvetica"
for name, path, idx in _CANDIDATES:
    if os.path.exists(path):
        try:
            pdfmetrics.registerFont(TTFont(name, path, subfontIndex=idx))
            FONT = name
            break
        except Exception:
            continue


def build(path: str, year: str = "2022", vals=("4.8", "3.9", "0.9")) -> None:
    doc = SimpleDocTemplate(path, pagesize=A4)
    styles = getSampleStyleSheet()
    title = styles["Title"]
    title.fontName = FONT
    body = styles["BodyText"]
    body.fontName = FONT

    story = [
        Paragraph(f"{year} 청소년 도박 실태조사 (합성 fixture)", title),
        Paragraph(
            "본 표는 도박문제 선별척도에 따른 도박문제 수준 분류 결과이다. "
            "위험군은 중위험, 문제군은 문제성 수준을 뜻한다. (fixture · 더미값)",
            body,
        ),
        Spacer(1, 12),
    ]

    total, atrisk, problem = vals

    def _scaled(v: str, factor: float) -> str:
        return f"{float(v) * factor:.1f}%"

    data = [
        ["구분", "전체", "남학생", "여학생"],
        ["도박문제 수준", f"{total}%", _scaled(total, 1.35), _scaled(total, 0.63)],
        ["위험군", f"{atrisk}%", _scaled(atrisk, 1.31), _scaled(atrisk, 0.67)],
        ["문제군", f"{problem}%", _scaled(problem, 1.55), _scaled(problem, 0.44)],
    ]
    t = Table(data, hAlign="LEFT")
    t.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), FONT),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
                ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ]
        )
    )
    story.append(t)
    doc.build(story)


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser(description="합성 fixture PDF 생성(엔진 검증 전용)")
    ap.add_argument("out", nargs="?", default="sample_kcgp.pdf")
    ap.add_argument("--year", default="2022")
    # 회차별 시계열 검증을 위해 값도 바꿀 수 있게 한다(전부 더미).
    ap.add_argument("--total", default="4.8")
    ap.add_argument("--atrisk", default="3.9")
    ap.add_argument("--problem", default="0.9")
    a = ap.parse_args()

    build(a.out, a.year, (a.total, a.atrisk, a.problem))
    print(f"wrote {a.out} (year={a.year})")
