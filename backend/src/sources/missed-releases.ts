import { Source } from './entities/source.entity';
import { computeNextExpected, isExpectedOverdue } from './next-expected.util';

/**
 * 「지난 예정 · 미확인」 (SOC-R3 ■4).
 *
 * 예정은 월 단위 값이다(그 달 1일로 저장 · 화면은 YYYY-MM). 그래서 「지남」은
 * 그 달이 끝났을 때다 — 10월 예정은 10월 31일까지는 지나지 않았다
 * (next-expected.util isExpectedOverdue · 일 단위로 보면 매달 2일에 「이번 달 예정」이
 * 통째로 사라진다).
 *
 * 지난 예정의 처리:
 *  - 주기 있음(cadence ≠ irregular · 예정 월 있음) → 주기만큼 앞으로(backfill:next·
 *    09:00 감시 크론이 next_expected_at 을 새로 계산하고 source_events 에 rescheduled 를 남김)
 *  - 주기 없음 → 「확인 필요」(다음 예정을 지어내지 않는다 · null)
 * 홈 「이번 달 발표 예정」은 이번 달 이후만, 지난 것은 달력 페이지의 이 줄에만 보인다.
 * 발간이 확인되면(published · 해시/게시판 changed 사건 — confirmsRelease) 이 줄에서 빠진다.
 */
export type OverdueAction = 'roll' | 'check';

export function overdueAction(
  src: Pick<Source, 'cadence' | 'expectedMonth'>,
): OverdueAction {
  return src.cadence !== 'irregular' && (src.expectedMonth?.length ?? 0) > 0
    ? 'roll'
    : 'check';
}

export interface MissedRelease {
  sourceId: string;
  titleKo: string;
  titleEn: string;
  orgKo: string;
  org: string;
  url: string;
  /** 지난 예정 월 YYYY-MM */
  expected: string;
  /** 새 예정 월 YYYY-MM · 확인 필요면 null */
  next: string | null;
  /** rolled = 주기만큼 앞으로 · check = 확인 필요(주기 없음) */
  action: 'rolled' | 'check';
  /** 감시가 그 달 뒤에 원본을 읽었나 (SOC-R4 ■2) — MonitorState 참고 */
  monitor: MonitorState;
}

/**
 * 「발표 없음」과 「감시가 못 읽음」을 가른다 (SOC-R4 ■2).
 *  - unreadable    읽지 못함: 소스가 stale(연속 실패 3회+)이거나 마지막 읽기가 실패·차단
 *  - manual        사람 확인: 감시가 HTTP 로 읽지 않는 소스(accessMethod manual)
 *  - unchecked     확인 전: 예정 달이 끝난 뒤 아직 한 번도 읽지 않음
 *  - not_published 발표 없음: 예정 달이 끝난 뒤 원본을 읽었고 발간을 보지 못함
 * 「발표 없음」은 읽기에 성공한 사실이 있을 때만 쓴다 — 못 읽은 것을 발표 없음으로 말하지 않는다.
 */
export type MonitorState =
  | 'unreadable'
  | 'manual'
  | 'unchecked'
  | 'not_published';

/**
 * changed 사건 중 「발간 확인」으로 치는 감지 방식 (SOC-R8 ■3).
 * 본문 해시·게시판 최신글만 — ETag·Last-Modified 는 발간과 무관하게 흔들리는
 * 출처가 있어(hri_gshr 10월 changed 6) 바뀌었다는 것만으로 발간을 말하지 않는다.
 * published(발간일을 잡음)는 방식과 무관하게 확인.
 */
export const RELEASE_CHANGE_METHODS = ['hash', 'board-latest'];

export function confirmsRelease(
  e: Pick<EventLike, 'eventType' | 'detail'>,
): boolean {
  if (e.eventType === 'published') return true;
  if (e.eventType !== 'changed') return false;
  if (e.detail?.notRelease) return false; // SOC-R9 ■2 「발간 아님」
  const method = e.detail?.method;
  return typeof method === 'string' && RELEASE_CHANGE_METHODS.includes(method);
}

/** 감시 결과 사건 — 마지막 것이 읽기 성공인지 실패인지 */
export const READ_OK_EVENTS = ['checked', 'changed', 'published'];
export const READ_FAIL_EVENTS = ['failed', 'stale', 'blocked'];

/** 'YYYY-MM' 달이 끝난 다음 순간(다음 달 1일 00:00 KST)의 epoch ms */
function monthEndMs(expected: string): number {
  const [y, m] = expected.split('-').map(Number);
  return Date.UTC(y, m, 1) - 9 * 3600 * 1000;
}

/**
 * 감시 건강 수 (SOC-R4 ■2 · /api/health/nightly monitor).
 *  - stale: 연속 실패 3회+ 로 stale 인 소스
 *  - unreachable: 마지막 읽기가 실패한 소스(fail_count > 0 · stale 포함)
 */
export function monitorCounts(
  sources: Pick<Source, 'status' | 'failCount'>[],
): { sources: number; stale: number; unreachable: number } {
  return {
    sources: sources.length,
    stale: sources.filter((s) => s.status === 'stale').length,
    unreachable: sources.filter((s) => (s.failCount ?? 0) > 0).length,
  };
}

/**
 * 09:00 이월 줄 (SOC-R18 ■3 · /api/health/nightly roll) — 이월은 09:00 감시 크론 한 곳(reconcileExpected)이라
 * 밤 기록(job_runs)에는 실리지 않는다. 그래서 같은 「지난 예정」 줄(missedReleases)과 마지막 이월 사건으로 센다(쓰기 0).
 * 이월이 없으면 lastRolledAt = null · 수 = 0(빈 칸이 아니라 0 — 「발표 없음」은 읽은 사실이 있을 때만 · monitorState).
 * 읽는 법(리뷰 A): lines · monitor = 달력 페이지와 같은 120일 창의 「지난 예정」 줄 전부(오늘 아침 이월만이 아님) ·
 * rolled = 다음 예정이 있는 줄(이미 이월 ∨ 09:00 에 이월할 미리 보기) — 이월이 실제로 돌았는지는 lastRolledAt 으로 본다.
 */
export interface RollSummary {
  /** 마지막 rescheduled(reason overdue) 시각 · 없으면 null */
  lastRolledAt: string | null;
  lines: number;
  rolled: number;
  check: number;
  monitor: Record<MonitorState, number>;
}

export function rollSummary(
  rows: Pick<MissedRelease, 'action' | 'monitor'>[],
  events: EventLike[],
): RollSummary {
  let last: number | null = null;
  for (const e of events) {
    if (e.eventType !== 'rescheduled' || e.detail?.reason !== 'overdue')
      continue;
    const t = new Date(e.detectedAt).getTime();
    if (Number.isFinite(t) && (last == null || t > last)) last = t;
  }
  const monitor: Record<MonitorState, number> = {
    unreadable: 0,
    manual: 0,
    unchecked: 0,
    not_published: 0,
  };
  for (const r of rows) monitor[r.monitor]++;
  return {
    lastRolledAt: last == null ? null : new Date(last).toISOString(),
    lines: rows.length,
    rolled: rows.filter((r) => r.action === 'rolled').length,
    check: rows.filter((r) => r.action === 'check').length,
    monitor,
  };
}

export function monitorState(
  s: Pick<Source, 'status' | 'accessMethod'>,
  expected: string,
  lastRead: { ok: boolean; at: number } | undefined,
): MonitorState {
  if (s.accessMethod === 'manual') return 'manual';
  if (s.status === 'stale' || (lastRead && !lastRead.ok)) return 'unreadable';
  if (!lastRead || lastRead.at < monthEndMs(expected)) return 'unchecked';
  return 'not_published';
}

export interface EventLike {
  sourceId: string;
  eventType: string;
  detectedAt: Date | string;
  detail: Record<string, unknown> | null;
}

const ym = (v: unknown) =>
  typeof v === 'string' && /^\d{4}-\d{2}/.test(v) ? v.slice(0, 7) : null;

export const MISSED_WINDOW_DAYS = 120;

export function missedReleases(
  sources: Source[],
  events: EventLike[],
  today: Date = new Date(),
  windowDays = MISSED_WINDOW_DAYS,
): MissedRelease[] {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const since = today.getTime() - windowDays * 24 * 3600 * 1000;
  const out = new Map<string, MissedRelease>();
  const base = (s: Source) => ({
    sourceId: s.id,
    titleKo: s.titleKo,
    titleEn: s.titleEn,
    orgKo: s.orgKo,
    org: s.org,
    url: s.url,
  });

  // 발간이 확인된 시각(소스별 마지막 published · 해시/게시판 changed — confirmsRelease).
  const confirmedAt = new Map<string, number>();
  for (const e of events) {
    if (!confirmsRelease(e)) continue;
    const t = new Date(e.detectedAt).getTime();
    if (t > (confirmedAt.get(e.sourceId) ?? 0)) confirmedAt.set(e.sourceId, t);
  }

  // 마지막 감시 결과(읽음/못 읽음) — SOC-R4 ■2
  const lastRead = new Map<string, { ok: boolean; at: number }>();
  for (const e of events) {
    const ok = READ_OK_EVENTS.includes(e.eventType);
    if (!ok && !READ_FAIL_EVENTS.includes(e.eventType)) continue;
    const t = new Date(e.detectedAt).getTime();
    if (t >= (lastRead.get(e.sourceId)?.at ?? -Infinity))
      lastRead.set(e.sourceId, { ok, at: t });
  }
  const tag = (s: Source, expected: string) =>
    monitorState(s, expected, lastRead.get(s.id));

  // 1) 이미 이월된 것 — rescheduled(reason overdue) 사건.
  for (const e of events) {
    if (e.eventType !== 'rescheduled') continue;
    const d = e.detail ?? {};
    if (d.reason !== 'overdue' || d.publicationConfirmed === true) continue;
    const t = new Date(e.detectedAt).getTime();
    if (t < since) continue;
    if ((confirmedAt.get(e.sourceId) ?? 0) > t) continue;
    const s = byId.get(e.sourceId);
    const expected = ym(d.from);
    if (!s || !expected) continue;
    const next = ym(d.to);
    out.set(`${s.id}|${expected}`, {
      ...base(s),
      expected,
      next,
      action: next ? 'rolled' : 'check',
      monitor: tag(s, expected),
    });
  }

  // 2) 아직 이월 전(그 달이 끝났는데 다음 계산이 아직 돌지 않음).
  for (const s of sources) {
    if (!isExpectedOverdue(s.nextExpectedAt, today)) continue;
    const expected = ym(s.nextExpectedAt);
    if (!expected) continue;
    const next =
      overdueAction(s) === 'roll' ? ym(computeNextExpected(s, today)) : null;
    out.set(`${s.id}|${expected}`, {
      ...base(s),
      expected,
      next,
      action: next ? 'rolled' : 'check',
      monitor: tag(s, expected),
    });
  }

  return [...out.values()].sort(
    (a, b) =>
      b.expected.localeCompare(a.expected) ||
      a.sourceId.localeCompare(b.sourceId),
  );
}
