#!/usr/bin/env bash
# PDF 파서용 Python 의존(pdfplumber) 빌드 고정 설치 (AS-M3-2c).
#
# 배경: 이전 render.yaml은 `pip install ... || true`라 실패를 삼켜, pdfplumber 없이
# 조용히 배포됐다(사용자 Render 셸 실측: ModuleNotFoundError). 셸에서 수동 pip은
# 재배포 시 소실되므로 금지. → 빌드 단계에서 **venv에** 설치해 배포 산출물에 고정한다.
#
# venv를 쓰는 이유:
#  - PEP 668(externally-managed-environment)로 시스템 pip 설치가 거부되는 환경 회피.
#  - --user($HOME) 설치는 런타임에 경로/영속성이 보장되지 않음. venv는 rootDir 안에 남는다.
#  - 서비스는 venv의 python 실행파일을 직접 쓰므로 PYTHONPATH 조작이 필요 없다.
#
# 실패하면 **비영(非0)으로 종료**해 배포를 중단시킨다(조용한 미설치 금지).
# PDF 크론을 쓰지 않는다면 SKIP_PDF_DEPS=true로 건너뛸 수 있다(명시적 선택).

set -euo pipefail

if [ "${SKIP_PDF_DEPS:-false}" = "true" ]; then
  echo "[pdf-deps] SKIP_PDF_DEPS=true — 설치 건너뜀(PDF 크론 사용 불가)"
  exit 0
fi

VENV_DIR="${PDF_VENV_DIR:-$(pwd)/pdf-venv}"
REQ="$(pwd)/../tools/pdf-extract/requirements-runtime.txt"

if [ ! -f "$REQ" ]; then
  echo "[pdf-deps] ❌ requirements 파일 없음: $REQ" >&2
  exit 1
fi

# python3 탐색 (Render Node 이미지에 python3가 있는지 확인)
PY=""
for cand in python3 python3.12 python3.11 python; do
  if command -v "$cand" >/dev/null 2>&1; then PY="$cand"; break; fi
done
if [ -z "$PY" ]; then
  echo "[pdf-deps] ❌ python3를 찾을 수 없음 — PDF 크론을 쓰려면 Python이 있는 런타임이 필요하다." >&2
  echo "[pdf-deps]    (임시로 SKIP_PDF_DEPS=true 로 두면 배포는 되지만 PDF 추출은 비활성)" >&2
  exit 1
fi
echo "[pdf-deps] python: $($PY --version 2>&1) ($(command -v $PY))"

# venv 생성 (ensurepip 없는 슬림 이미지 대비: --without-pip 폴백 + get-pip 없이 pip 모듈 확인)
if [ ! -x "$VENV_DIR/bin/python" ]; then
  echo "[pdf-deps] venv 생성: $VENV_DIR"
  "$PY" -m venv "$VENV_DIR"
fi

"$VENV_DIR/bin/python" -m pip install --upgrade pip >/dev/null
echo "[pdf-deps] 설치: $(cat "$REQ" | grep -v '^#' | tr '\n' ' ')"
"$VENV_DIR/bin/python" -m pip install --no-cache-dir -r "$REQ"

# 설치 검증 — import 되지 않으면 배포 실패
"$VENV_DIR/bin/python" - <<'PY'
import pdfplumber
print(f"[pdf-deps] ✅ pdfplumber {pdfplumber.__version__} import OK")
PY

echo "[pdf-deps] 완료 — 서비스는 PYTHON_BIN 미설정 시 이 venv를 자동 사용한다."
