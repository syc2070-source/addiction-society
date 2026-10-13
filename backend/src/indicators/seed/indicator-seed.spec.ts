import { SeedInsertOnly } from '../../common/seed-insert-only';
import {
  IndicatorDataFile,
  isOfficialUrl,
  resolveObservation,
  SeedReport,
  seedIndicatorFile,
} from './indicator-seed';
import kcgp from './kcgp-youth.data.json';
import knhanes from './knhanes.data.json';

// SOC-R3 ■3ⓔ — 지표 관측치 넣기만 · 같은 값 중복 0 · 원본 URL 없는 관측치 거절.

/** where 의 열쇠가 모두 같은 행을 찾는 메모리 저장소. */
function memRepo<T extends Record<string, unknown>>(seed: T[] = []) {
  const rows: T[] = seed.map((r) => ({ ...r }));
  let id = rows.length;
  return {
    rows,
    findOne: jest.fn(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(
        rows.find((r) =>
          Object.entries(where).every(
            ([k, v]) => v === undefined || r[k] === v,
          ),
        ) ?? null,
      ),
    ),
    create: jest.fn((r: T) => r),
    save: jest.fn((r: T) => {
      const saved = { id: ++id, ...r };
      rows.push(saved);
      return Promise.resolve(saved);
    }),
    update: jest.fn(),
    upsert: jest.fn(),
  };
}

const report = (): SeedReport => ({
  indicators: new SeedInsertOnly('indicators'),
  observations: new SeedInsertOnly('observations'),
  rejected: [],
});

// 운영 10-13 실측: 지표 id 1 의 2022 행(4.8 · approved · 10-09 fetched_at).
const existing2022 = {
  id: 1,
  indicatorId: 1,
  sourceId: 'kcgp_youth',
  geo: 'KR',
  period: '2022',
  value: '4.8',
  qualifier: 'total',
  status: 'approved',
  fetchedAt: new Date('2026-10-09T07:22:15.487Z'),
  sourceUrl: 'https://www.data.go.kr/data/15142248/fileData.do',
  note: null,
};

const file = (obs: IndicatorDataFile['indicators'][0]['observations']) =>
  ({
    sourceId: 'kcgp_youth',
    sourceUrl: 'https://www.data.go.kr/data/15142248/fileData.do',
    indicators: [
      {
        code: 'kcgp_youth_gambling_problem_rate',
        domain: 'D1',
        nameKo: 'x',
        nameEn: null,
        unit: '%',
        definitionKo: '정의',
        methodNote: null,
        observations: obs,
      },
    ],
  }) as IndicatorDataFile;

describe('지표 관측치 넣기만', () => {
  it('adds new years and leaves the 2022 row untouched (value · status · fetched_at)', async () => {
    const indicators = memRepo([
      { id: 1, code: 'kcgp_youth_gambling_problem_rate' },
    ]);
    const observations = memRepo([existing2022]);
    const r = report();
    await seedIndicatorFile(
      file([
        { geo: 'KR', period: '2022', value: '4.8' },
        {
          geo: 'KR',
          period: '2020',
          value: '2.4',
          sourceUrl: 'https://www.kcgp.or.kr/a.pdf',
          page: 12,
        },
      ]),
      { indicators, observations } as never,
      r,
    );
    expect(observations.rows).toHaveLength(2);
    expect(observations.rows[0]).toEqual(existing2022);
    expect(observations.update).not.toHaveBeenCalled();
    expect(observations.upsert).not.toHaveBeenCalled();
    expect(observations.save).toHaveBeenCalledTimes(1);
    const added = observations.rows[1];
    expect(added).toMatchObject({
      period: '2020',
      value: '2.4',
      status: 'approved',
      sourceUrl: 'https://www.kcgp.or.kr/a.pdf#page=12',
    });
    expect(String(added.note)).toContain('p.12');
    expect(r.observations.diffs).toHaveLength(0);
  });

  it('a second run inserts nothing — same value twice never makes a second row', async () => {
    const indicators = memRepo([
      { id: 1, code: 'kcgp_youth_gambling_problem_rate' },
    ]);
    const observations = memRepo([existing2022]);
    const data = file([
      { geo: 'KR', period: '2022', value: '4.8' },
      { geo: 'KR', period: '2020', value: '2.4' },
      { geo: 'KR', period: '2020', value: '2.4' },
    ]);
    const first = report();
    await seedIndicatorFile(data, { indicators, observations } as never, first);
    const second = report();
    await seedIndicatorFile(
      data,
      { indicators, observations } as never,
      second,
    );
    expect(observations.rows).toHaveLength(2);
    expect(first.rejected).toEqual([
      {
        key: 'kcgp_youth_gambling_problem_rate KR 2020 total',
        reason: '파일 안 중복',
      },
    ]);
    expect(second.observations.inserted).toBe(0);
    expect(second.observations.skipped).toBe(2);
  });

  it('a different value for an existing year is only logged as seed_diff', async () => {
    const indicators = memRepo([
      { id: 1, code: 'kcgp_youth_gambling_problem_rate' },
    ]);
    const observations = memRepo([existing2022]);
    const r = report();
    await seedIndicatorFile(
      file([{ geo: 'KR', period: '2022', value: '5.0' }]),
      { indicators, observations } as never,
      r,
    );
    expect(observations.rows[0].value).toBe('4.8');
    expect(r.observations.diffs.map((d) => d.field)).toEqual(['value']);
  });

  it('rejects observations without a source URL or from a non-official domain', () => {
    const base = file([]);
    const ind = { ...base.indicators[0] };
    const noUrl = { ...base, sourceUrl: undefined };
    expect(
      resolveObservation(noUrl, ind, { geo: 'KR', period: '2020', value: '1' }),
    ).toMatchObject({ ok: false, reason: '원본 URL 없음' });
    expect(
      resolveObservation(base, ind, {
        geo: 'KR',
        period: '2020',
        value: '1',
        sourceUrl: 'https://blog.example.com/kcgp.pdf',
      }),
    ).toMatchObject({ ok: false });
    expect(
      resolveObservation(base, ind, {
        geo: 'KR',
        period: '2020',
        value: '약 2',
      }),
    ).toMatchObject({ ok: false });
    expect(isOfficialUrl('https://www.kcgp.or.kr/x.pdf')).toBe(true);
    expect(isOfficialUrl('https://kosis.kr/statHtml/statHtml.do')).toBe(true);
    expect(isOfficialUrl('https://www.index.go.kr/x')).toBe(true);
    expect(isOfficialUrl('https://kcgp.or.kr.evil.com/x')).toBe(false);
    expect(isOfficialUrl('not a url')).toBe(false);
  });

  // SOC-R4 ■1 — 10-14 04:00 첫 회차 실측: collect:indicators inserted 26(지표 2 + 관측치 24) ·
  // 2022 행 3개 fetched_at 10-09 그대로. 운영 10-13 상태(지표 3 · 2022 관측치 3)에서 다시 재현.
  const shipped = [kcgp, knhanes] as unknown as IndicatorDataFile[];
  const prod1013 = () => {
    const codes = [
      'kcgp_youth_gambling_problem_rate',
      'kcgp_youth_gambling_atrisk_rate',
      'kcgp_youth_gambling_problem_group_rate',
    ];
    const values = ['4.8', '3.9', '0.9'];
    return {
      indicators: memRepo(codes.map((code, i) => ({ id: i + 1, code }))),
      observations: memRepo(
        values.map((value, i) => ({
          ...existing2022,
          id: i + 1,
          indicatorId: i + 1,
          value,
        })),
      ),
    };
  };
  const runAll = async (repos: ReturnType<typeof prod1013>) => {
    const r = report();
    for (const f of shipped) await seedIndicatorFile(f, repos as never, r);
    return r;
  };

  it('first run on the 10-13 production state inserts only new indicators and years', async () => {
    const repos = prod1013();
    const before = repos.observations.rows.map((o) => ({ ...o }));
    const r = await runAll(repos);
    const shippedIndicators = shipped.flatMap((f) => f.indicators);
    const shippedObs = shippedIndicators.flatMap((i) => i.observations);
    expect(r.rejected).toEqual([]);
    expect(r.indicators.inserted).toBe(shippedIndicators.length - 3);
    expect(r.observations.inserted).toBe(shippedObs.length - 3);
    expect(r.observations.diffs).toEqual([]);
    expect(repos.observations.rows.slice(0, 3)).toEqual(before);
    expect(repos.observations.update).not.toHaveBeenCalled();
  });

  it('the next run (after 10-14) inserts nothing and changes no row', async () => {
    const repos = prod1013();
    await runAll(repos);
    const after = repos.observations.rows.map((o) => ({ ...o }));
    const r = await runAll(repos);
    expect(r.indicators.inserted).toBe(0);
    expect(r.observations.inserted).toBe(0);
    expect(r.observations.diffs).toEqual([]);
    expect(repos.observations.rows).toEqual(after);
    expect(repos.indicators.update).not.toHaveBeenCalled();
  });

  it('every shipped observation resolves (official URL, numeric value, no duplicate)', () => {
    for (const f of [kcgp, knhanes] as unknown as IndicatorDataFile[]) {
      const keys = new Set<string>();
      for (const ind of f.indicators) {
        expect(ind.definitionKo.trim()).not.toBe('');
        for (const o of ind.observations) {
          const r = resolveObservation(f, ind, o);
          expect(r).toMatchObject({ ok: true });
          expect(keys.has(r.key)).toBe(false);
          keys.add(r.key);
        }
      }
    }
  });
});
