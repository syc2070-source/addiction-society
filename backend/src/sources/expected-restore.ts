/**
 * 사건 없이 밀린 이번 달 예정 되돌리기 (SOC-R8 ■2 ⓓ).
 *
 * backfill:next 가 매일 「오늘 이후 첫 달」로 다시 계산하던 동안(SOC-R8 앞), 발간 이력이
 * 있는 월간 출처 둘의 2026-10 예정이 10월 초에 사건 없이 2026-11 로 넘어갔다.
 *  - drugfree_stats: 10-01 rescheduled 09 → 10(ev 195) 뒤 → 11-01
 *  - spo_drug_monthly: 10-01 published(09-30 발간 · newExpectedAt 2026-10-01 · ev 193) 뒤 → 11-01
 * 10월 예정을 되돌려 10월이 끝나면(11-01 09:00) 감시 → 이월(rescheduled) → 「지난 예정 ·
 * 발표 없음」 줄이 서게 한다. 되돌린 행마다 rescheduled{reason:'restore'} 를 남긴다
 * (missed 계산은 reason 'overdue' 만 줄로 세므로 이 사건은 줄이 되지 않는다).
 * 조건: 아직 2026-11-01 이고 10월 이후 발간이 없을 때만(멱등 · 10월에 발간을 잡았으면 그대로).
 */
export interface ExpectedRestore {
  id: string;
  from: string;
  to: string;
  evidence: string;
}

export const EXPECTED_RESTORES_R8: ExpectedRestore[] = [
  {
    id: 'drugfree_stats',
    from: '2026-11-01',
    to: '2026-10-01',
    evidence: '10-01 rescheduled 2026-09 → 2026-10 (ev 195) 뒤 사건 없이 11-01',
  },
  {
    id: 'spo_drug_monthly',
    from: '2026-11-01',
    to: '2026-10-01',
    evidence:
      '10-01 published 2026-09-30 · newExpectedAt 2026-10-01 (ev 193) 뒤 사건 없이 11-01',
  },
];

/** 예정 되돌리기 SQL 1건(멱등). [sql, params] */
export function restoreSql(r: ExpectedRestore): [string, unknown[]] {
  return [
    `UPDATE sources SET next_expected_at = $2 WHERE id = $1 AND next_expected_at = $3 AND (last_published_at IS NULL OR last_published_at < $2) RETURNING id`,
    [r.id, r.to, r.from],
  ];
}

/** rescheduled{reason:'restore'} 사건 1건 SQL. */
export function restoreEventSql(r: ExpectedRestore): [string, unknown[]] {
  const detail = {
    from: r.from,
    to: r.to,
    reason: 'restore',
    publicationConfirmed: false,
    evidence: r.evidence,
    by: 'SOC-R8',
  };
  return [
    `INSERT INTO source_events (source_id, event_type, detail, notified) VALUES ($1, 'rescheduled', $2::jsonb, false)`,
    [r.id, JSON.stringify(detail)],
  ];
}
