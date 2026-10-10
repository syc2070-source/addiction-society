#!/usr/bin/env bash
# 배포 초기화 — 마이그레이션 + 멱등 시드만 (SOC-R1: 배포 = 데이터 쓰기 아님).
#
# Render의 preDeployCommand에서 호출된다. 실행 디렉터리(cwd)는 rootDir(backend)라고 가정.
#
# 단계(실패 시 배포 중단):
#   migration:run → seed:tags
#
#  - migration:run  : 이미 적용됐으면 "No migrations pending"으로 통과
#  - seed:tags      : name unique + orIgnore → 있는 행은 건드리지 않음(넣기만)
#
# SOC-R1 ■4: 아래 단계는 기존 행을 덮어써서(사람이 고친 값 포함) 배포에서 뺐다.
# 같은 스크립트를 앱 안 매일 예약(src/scheduler/daily-jobs.scheduler.ts, 04:00 KST)이
# 하루 한 번 그대로 돌린다 — 끈 것 없음, 배포 때의 중복 실행만 없앰.
#   seed:sources(id upsert · next_expected_at 비움) → backfill:next(다시 채움)
#   seed:recovery(name 기준 update) · collect:indicators(관측치 갱신·status 승인 덮음)
#   seed:documents(title/source_id 기준 update) · collect:research(DOI 기준 update)
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

echo "[deploy-init] 시작 — 마이그레이션 + 멱등 시드 (데이터 수집은 매일 예약)"

# ── 스키마와 태그(넣기만). 실패하면 배포 중단 ──
step "1/2 migration:run" npm run migration:run
step "2/2 seed:tags" npm run seed:tags

echo ""
echo "[deploy-init] 완료 — 스키마·태그 적용됨 (seed·collect·backfill 은 매일 04:00 KST 예약)"
