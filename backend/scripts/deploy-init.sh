#!/usr/bin/env bash
# 배포 초기화 — 마이그레이션 + 시드 (전부 멱등: 매 배포마다 실행해도 안전).
#
# Render의 preDeployCommand에서 호출된다. 실행 디렉터리(cwd)는 rootDir(backend)라고 가정.
# 순서: migration:run → seed:tags → seed:sources → backfill:next
#  - migration:run  : 이미 적용됐으면 "No migrations pending"으로 통과
#  - seed:tags      : name unique + orIgnore → 재실행 안전
#  - seed:sources   : id 기준 upsert → 재실행 안전
#  - backfill:next  : next_expected_at 재계산(멱등). 지난 예정일은 다음 주기로 이월하고
#                     source_events에 rescheduled로 남긴다. 배포 즉시 교정되고,
#                     배포가 없어도 매일 09시 크론(reconcileExpected)이 같은 일을 한다.
# 한 단계라도 실패하면 명확한 로그를 남기고 배포를 중단(비정상 스키마로 기동 방지).

set -uo pipefail

if [ ! -f package.json ]; then
  echo "[deploy-init] ❌ package.json 없음 — backend 디렉터리에서 실행해야 함" >&2
  exit 1
fi

step() {
  local name="$1"
  shift
  echo ""
  echo "[deploy-init] ▶ $name 시작"
  if "$@"; then
    echo "[deploy-init] ✅ $name 통과"
  else
    echo "[deploy-init] ❌ $name 실패 — 배포 중단" >&2
    exit 1
  fi
}

echo "[deploy-init] 시작 — 마이그레이션·시딩 (멱등)"
step "1/4 migration:run" npm run migration:run
step "2/4 seed:tags" npm run seed:tags
step "3/4 seed:sources" npm run seed:sources
step "4/4 backfill:next" npm run backfill:next
echo ""
echo "[deploy-init] 완료 — 스키마·시드 적용됨"
