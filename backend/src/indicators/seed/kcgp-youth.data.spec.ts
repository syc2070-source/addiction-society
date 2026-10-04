import data from './kcgp-youth.data.json';

interface SeedObservation {
  geo: string;
  period: string;
  value: string;
  qualifier: string | null;
  sourceUrl: string;
  note?: string | null;
}

interface SeedIndicator {
  code: string;
  definitionKo: string;
  methodNote: string | null;
  unit: string | null;
  observations: SeedObservation[];
}

const indicators = data.indicators as SeedIndicator[];
const byCode = new Map(
  indicators.map((indicator) => [indicator.code, indicator]),
);

describe('kcgp youth curated indicator data', () => {
  it('keeps every indicator and observation key unique', () => {
    expect(new Set(indicators.map((indicator) => indicator.code)).size).toBe(
      indicators.length,
    );

    const keys = indicators.flatMap((indicator) =>
      indicator.observations.map((observation) =>
        [
          indicator.code,
          data.sourceId,
          observation.geo,
          observation.period,
          observation.qualifier ?? 'total',
        ].join('|'),
      ),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('requires definitions, bounded percentages, provenance and interpretation notes', () => {
    const allowedHosts = new Set(['www.kcgp.or.kr']);
    const sourceByPeriod: Record<string, string> = {
      '2015':
        'https://www.kcgp.or.kr/portal/bbs/B0000031/view.do?menuNo=200021&nttId=36927',
      '2018':
        'https://www.kcgp.or.kr/portal/bbs/B0000031/view.do?menuNo=200021&nttId=36927',
      '2020':
        'https://www.kcgp.or.kr/portal/bbs/B0000031/view.do?menuNo=200021&nttId=38755',
      '2022':
        'https://www.kcgp.or.kr/portal/bbs/B0000041/view.do?menuNo=200186&nttId=40352',
      '2024':
        'https://www.kcgp.or.kr/portal/bbs/B0000063/view.do?menuNo=200240&nttId=315267',
      '2025':
        'https://www.kcgp.or.kr/portal/bbs/B0000063/view.do?menuNo=200240&nttId=776740',
    };

    for (const indicator of indicators) {
      expect(indicator.definitionKo.trim()).not.toBe('');
      expect(indicator.methodNote?.trim()).toBeTruthy();
      expect(indicator.unit).toBe('%');

      for (const observation of indicator.observations) {
        expect(observation.geo).toBe('KR');
        expect(observation.period).toMatch(/^20\d{2}$/);
        expect(observation.qualifier).toBe('total');

        expect(observation.value).toMatch(/^\d+(?:\.\d+)?$/);
        const value = Number(observation.value);
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);

        expect(observation.sourceUrl).toBe(sourceByPeriod[observation.period]);
        const sourceUrl = new URL(observation.sourceUrl);
        expect(sourceUrl.protocol).toBe('https:');
        expect(allowedHosts.has(sourceUrl.hostname)).toBe(true);
        expect(observation.note?.trim()).toBeTruthy();
        expect(observation.note?.length ?? 0).toBeLessThanOrEqual(300);
      }
    }
  });

  it('preserves the four verified CAGI rounds and their arithmetic', () => {
    const overall = byCode.get('kcgp_youth_gambling_problem_rate');
    const atRisk = byCode.get('kcgp_youth_gambling_atrisk_rate');
    const problem = byCode.get('kcgp_youth_gambling_problem_group_rate');
    expect(overall).toBeDefined();
    expect(atRisk).toBeDefined();
    expect(problem).toBeDefined();

    const expected = {
      '2015': [5.1, 4.0, 1.1],
      '2018': [6.4, 4.9, 1.5],
      '2020': [2.4, 1.7, 0.7],
      '2022': [4.8, 3.9, 0.9],
    } as const;

    expect(overall?.observations.map((row) => row.period)).toEqual(
      Object.keys(expected),
    );
    for (const [
      period,
      [expectedOverall, expectedAtRisk, expectedProblem],
    ] of Object.entries(expected)) {
      const value = (indicator: SeedIndicator | undefined) =>
        Number(
          indicator?.observations.find((row) => row.period === period)?.value,
        );
      expect(value(overall)).toBe(expectedOverall);
      expect(value(atRisk)).toBe(expectedAtRisk);
      expect(value(problem)).toBe(expectedProblem);
      expect(value(atRisk) + value(problem)).toBeCloseTo(value(overall), 10);
    }
  });

  it('keeps the redesigned approved survey in separate 2024-2025 indicators', () => {
    const expectedSeries: Record<string, [number, number]> = {
      kcgp_youth_gambling_lifetime_experience_rate: [4.3, 4.0],
      kcgp_youth_gambling_six_month_persistence_rate: [19.1, 19.4],
      kcgp_youth_gambling_prevention_education_lifetime_rate: [82.4, 82.8],
      kcgp_youth_peer_gambling_exposure_rate: [27.3, 27.3],
    };

    for (const [code, values] of Object.entries(expectedSeries)) {
      const indicator = byCode.get(code);
      expect(indicator?.observations.map((row) => row.period)).toEqual([
        '2024',
        '2025',
      ]);
      expect(indicator?.observations.map((row) => Number(row.value))).toEqual(
        values,
      );
    }

    expect(indicators).toHaveLength(7);
    expect(
      indicators.reduce(
        (count, indicator) => count + indicator.observations.length,
        0,
      ),
    ).toBe(20);
  });
});
