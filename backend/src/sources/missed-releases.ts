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
 * 발간이 확인되면(published/changed 사건) 이 줄에서 빠진다.
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

  // 발간이 확인된 시각(소스별 마지막 published/changed).
  const confirmedAt = new Map<string, number>();
  for (const e of events) {
    if (e.eventType !== 'published' && e.eventType !== 'changed') continue;
    const t = new Date(e.detectedAt).getTime();
    if (t > (confirmedAt.get(e.sourceId) ?? 0)) confirmedAt.set(e.sourceId, t);
  }

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
    });
  }

  return [...out.values()].sort(
    (a, b) =>
      b.expected.localeCompare(a.expected) ||
      a.sourceId.localeCompare(b.sourceId),
  );
}
