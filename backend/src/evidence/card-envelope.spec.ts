import {
  jobCountsLine,
  parseJobCountsLine,
  sumJobCounts,
} from '../common/job-counts';
import { envelopeJobCounts, readEnvelope } from './card-envelope';

/** Statory build-evidence-export.mjs 의 꼴(10-23 origin/main) — 옛 꼴은 card_version · missing 이 봉투 맨 위에 없다. */
const oldBody = () => ({
  schema: 'EVIDENCE_EXPORT_V1',
  generated_at: '2026-10-23T03:00:00.000Z',
  count: 2,
  skipped: {},
  items: [
    { card_id: 'c1', title: 'A', fields_missing: ['region', 'limitations'] },
    { card_id: 'c2', title: 'B', fields_missing: [] },
  ],
});
const v1Body = () => ({
  ...oldBody(),
  card_version: 'v4',
  missing: [{ id: 'c1', fields: ['region', 'limitations'] }],
});
const zero = { inserted: 0, updated: 0, skipped: 0, diff: 0 };

describe('Statory 카드 봉투 받기 (SOC-R12 ■3)', () => {
  it('both new fields present: card_version and missing[] are read and tied to the card', () => {
    const r = readEnvelope(v1Body());
    expect(r).toMatchObject({ ok: true, form: 'v1', cardVersion: 'v4' });
    expect([...r.missingByCard]).toEqual([['c1', ['region', 'limitations']]]);
    expect(r.missingRejected).toEqual([]);
    expect(r.items).toHaveLength(2);
    // 모두 찬 묶음 — missing [] 도 v1
    const full = readEnvelope({ ...v1Body(), missing: [] });
    expect(full).toMatchObject({ ok: true, form: 'v1' });
    expect(full.missingByCard.size).toBe(0);
  });

  it('both absent: the old envelope is received as before', () => {
    const r = readEnvelope(oldBody());
    expect(r).toMatchObject({
      ok: true,
      form: 'old',
      cardVersion: null,
      reject: null,
    });
    expect(r.missingByCard.size).toBe(0);
    expect(r.items).toHaveLength(2);
  });

  it('wrong form at the top rejects the whole envelope; a wrong missing line is set aside alone', () => {
    const reject = (body: unknown, prev?: string) =>
      readEnvelope(body, prev).reject;
    expect(reject({ ...v1Body(), card_version: '' })).toBe('envelope_invalid');
    expect(reject({ ...v1Body(), card_version: 4 })).toBe('envelope_invalid');
    // 공개 nightly 몸에 실리는 값 — 낱말·숫자·점·줄표 40 자만(리뷰 찾기 2)
    expect(reject({ ...v1Body(), card_version: 'v4 <script>' })).toBe(
      'envelope_invalid',
    );
    expect(reject({ ...v1Body(), card_version: 'v'.repeat(41) })).toBe(
      'envelope_invalid',
    );
    expect(
      readEnvelope({ ...v1Body(), card_version: 'v4.1' }).cardVersion,
    ).toBe('v4.1');
    expect(reject({ ...v1Body(), missing: { c1: ['region'] } })).toBe(
      'envelope_invalid',
    );
    expect(reject({ ...oldBody(), count: 3 })).toBe('envelope_count_mismatch');
    expect(reject({ ...oldBody(), generated_at: 'yesterday' })).toBe(
      'envelope_invalid',
    );
    expect(reject([])).toBe('envelope_invalid');
    expect(reject(null)).toBe('envelope_invalid');
    expect(reject(oldBody(), '2026-10-23T03:00:00.000Z')).toBe(
      'envelope_stale',
    );

    const r = readEnvelope({
      ...v1Body(),
      missing: [
        { id: 'c1', fields: ['region'] },
        { id: 'c1', fields: ['design'] }, // 같은 카드 두 번
        { id: 'zz', fields: ['region'] }, // 봉투에 없는 카드
        { id: 'c2', fields: [] }, // 빈 칸 없는 카드는 오면 안 됨
        { id: 'c2', fields: ['region', 3] }, // 글 아닌 칸 이름
        { fields: ['region'] }, // id 없음
        'c2',
      ],
    });
    expect(r.ok).toBe(true);
    expect([...r.missingByCard]).toEqual([['c1', ['region']]]);
    expect(r.missingRejected).toEqual([
      { index: 1, reason: 'missing_duplicate_id' },
      { index: 2, reason: 'missing_id_unknown' },
      { index: 3, reason: 'missing_entry_invalid' },
      { index: 4, reason: 'missing_entry_invalid' },
      { index: 5, reason: 'missing_entry_invalid' },
      { index: 6, reason: 'missing_entry_invalid' },
    ]);
  });

  it('nightly job_counts carry card_version and the missing count, and totals stay the four numbers', () => {
    const c = envelopeJobCounts(readEnvelope(v1Body()), { inserted: 2 });
    expect(c).toEqual({
      ...zero,
      inserted: 2,
      missing: 1,
      card_version: 'v4',
    });
    expect(parseJobCountsLine(jobCountsLine(c))).toEqual(c);
    // 옛 꼴 · 거절된 봉투는 missing 을 0 으로 적지 않는다 — 재지 않은 것(리뷰 찾기 2)
    const old = envelopeJobCounts(readEnvelope(oldBody()), { inserted: 2 });
    expect(old).toEqual({ ...zero, inserted: 2 });
    expect(envelopeJobCounts(readEnvelope({ ...v1Body(), count: 9 }))).toEqual(
      zero,
    );
    // card_version 만 왔으면 card_version 만
    const onlyVersion = { ...oldBody(), card_version: 'v4' };
    expect(envelopeJobCounts(readEnvelope(onlyVersion))).toEqual({
      ...zero,
      card_version: 'v4',
    });
    // 모두 찬 묶음(missing [])은 잰 0
    const full = readEnvelope({ ...v1Body(), missing: [] });
    expect(envelopeJobCounts(full).missing).toBe(0);
    expect(sumJobCounts([c, old])).toEqual({ ...zero, inserted: 4 });
    // 다른 단계의 줄은 그전 꼴 그대로(두 칸 없음)
    expect(
      parseJobCountsLine(
        '[job_counts] {"inserted":1,"updated":0,"skipped":2,"diff":0}',
      ),
    ).toEqual({ ...zero, inserted: 1, skipped: 2 });
  });
});
