#!/usr/bin/env bash
# 배포 초기화 — 마이그레이션 + 시드 (전부 멱등: 매 배포마다 실행해도 안전).
#
# Render의 preDeployCommand에서 호출된다. 실행 디렉터리(cwd)는 rootDir(backend)라고 가정.
#
# 필수 단계(실패 시 배포 중단):
#   migration:run → seed:tags → seed:sources → backfill:next
# 선택 단계(실패 시 경고 후 계속, AS-FIX-1):
#   seed:recovery → collect:indicators → seed:documents → collect:research
#
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

# 실패해도 배포를 막지 않는 단계 (AS-FIX-1, 감사 문제 #5).
#
# 데이터 적재를 배포에 편입한 이유: 이전에는 documents·recovery·research·
# indicators가 "누가 언젠가 Render Shell에서 돌린" 결과로만 존재했다. DB를
# 잃으면 복구 절차가 아무의 기억에도 온전히 없었다. 블루프린트가 지목한
# 사망 원인이 '갱신 중단'인데, 재현 불가능한 수동 적재가 정확히 그것이다.
#
# 다만 hard step으로 두지 않는다:
#  - seed:documents / collect:research는 외부 네트워크에 의존한다. 정부·학술
#    사이트가 잠깐 죽었다고 배포가 막히면 안 된다(가용성이 데이터보다 우선).
#  - 전부 멱등이라 다음 배포에서 자연히 재시도된다.
# 그래서 실패는 경고로 남기고 계속 간다. 배포 로그에서 ⚠️만 grep 하면 된다.
#
# TIMEOUT: preDeployCommand가 무한정 붙들리지 않도록 단계별 상한을 둔다.
SOFT_TIMEOUT="${DEPLOY_SOFT_TIMEOUT:-420}"
SOFT_WARNED=0

soft_step() {
  local name="$1"
  shift
  echo ""
  echo "[deploy-init] ▶ $name 시작 (선택 단계 — 실패해도 배포 계속)"
  if timeout "$SOFT_TIMEOUT" "$@"; then
    echo "[deploy-init] ✅ $name 통과"
  else
    local code=$?
    SOFT_WARNED=$((SOFT_WARNED + 1))
    if [ "$code" -eq 124 ]; then
      echo "[deploy-init] ⚠️  $name 시간 초과(${SOFT_TIMEOUT}s) — 건너뜀. 다음 배포에서 재시도" >&2
    else
      echo "[deploy-init] ⚠️  $name 실패(exit $code) — 건너뜀. 다음 배포에서 재시도" >&2
    fi
  fi
}

echo "[deploy-init] 시작 — 마이그레이션·시딩 (멱등)"

# ── 필수: 스키마와 소스 레지스트리. 실패하면 배포 중단 ──
step "1/4 migration:run" npm run migration:run
step "2/4 seed:tags" npm run seed:tags
step "3/4 seed:sources" npm run seed:sources
step "4/4 backfill:next" npm run backfill:next

# ── 선택: 자료 적재. 실패해도 배포는 계속 ──
# 로컬 데이터만 쓰는 것을 먼저(빠르고 반드시 성공), 네트워크 의존을 나중에.
soft_step "5/8 seed:recovery (로컬 JSON 73건)" npm run seed:recovery
soft_step "6/8 collect:indicators (로컬 JSON)" npm run collect:indicators
soft_step "7/8 seed:documents (URL 실검증 — 네트워크)" npm run seed:documents
soft_step "8/8 collect:research (OpenAlex — 네트워크)" npm run collect:research

echo ""
if [ "$SOFT_WARNED" -gt 0 ]; then
  echo "[deploy-init] 완료 — 스키마·시드 적용됨 (선택 단계 ${SOFT_WARNED}건 건너뜀 ⚠️)"
else
  echo "[deploy-init] 완료 — 스키마·시드 전 단계 적용됨"
fi
