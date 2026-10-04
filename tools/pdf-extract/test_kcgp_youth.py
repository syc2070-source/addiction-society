"""KCGP 청소년 도박 PDF 어댑터 회귀 테스트."""

import math
import os
import sys
import tempfile
import unittest
from unittest.mock import patch

import run as cli
from adapters.kcgp_youth import KcgpYouthAdapter, _num
from engine.extractor import ExtractedDoc, Table


class KcgpYouthAdapterTest(unittest.TestCase):
    def setUp(self) -> None:
        self.adapter = KcgpYouthAdapter()
        self.doc = ExtractedDoc(
            path="fixture.pdf",
            n_pages=1,
            text="도박문제 수준 위험군 문제군",
            tables=[
                Table(
                    page=1,
                    rows=[
                        ["구분", "전체", "남학생"],
                        ["도박문제 수준", "4.8%", "6.5%"],
                        ["위험군", "3.9%", "5.1%"],
                        ["문제군", "0.9%", "1.4%"],
                    ],
                )
            ],
        )

    def map_year(self, year: int):
        return self.adapter.map(
            self.doc,
            {
                "surveyYear": year,
                "sourceUrl": "https://www.kcgp.or.kr/source",
            },
        )

    def test_maps_supported_cagi_round(self) -> None:
        indicators = self.map_year(2022)

        self.assertEqual(3, len(indicators))
        self.assertEqual(
            ["4.8", "6.5"],
            [row["value"] for row in indicators[0]["observations"]],
        )
        self.assertEqual(
            ["total", "group=남학생"],
            [row["qualifier"] for row in indicators[0]["observations"]],
        )
        self.assertTrue(
            all(
                row["note"] and "초4~고3" in row["note"]
                for indicator in indicators
                for row in indicator["observations"]
            )
        )

    def test_rejects_redesigned_approved_survey(self) -> None:
        self.assertEqual([], self.map_year(2024))
        self.assertEqual([], self.map_year(2025))

    def test_cli_refuses_to_write_empty_output(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = os.path.join(directory, "empty.json")
            argv = [
                "run.py",
                "fixture.pdf",
                "--source",
                "kcgp_youth",
                "--year",
                "2024",
                "--url",
                "https://www.kcgp.or.kr/source",
                "-o",
                output,
            ]
            with patch.object(cli, "extract", return_value=self.doc), patch.object(
                sys, "argv", argv
            ):
                self.assertEqual(1, cli.main())
            self.assertFalse(os.path.exists(output))

    def test_rejects_invalid_percentages(self) -> None:
        for value in ("-0.1", "100.1", "NaN", "Infinity", "not-a-number"):
            with self.subTest(value=value):
                self.assertIsNone(_num(value))

        self.assertEqual("0.0", _num("0%"))
        self.assertEqual("100.0", _num("100%"))
        self.assertTrue(math.isfinite(float(_num("4.8") or "nan")))


if __name__ == "__main__":
    unittest.main()
