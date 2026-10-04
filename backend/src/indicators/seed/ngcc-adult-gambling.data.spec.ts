import data from './ngcc-adult-gambling.data.json';

interface SeedObservation {
  geo: string;
  period: string;
  value: string;
  qualifier: string | null;
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
const periods = [
  '2008',
  '2010',
  '2012',
  '2014',
  '2016',
  '2018',
  '2020',
  '2022',
  '2024',
];

describe('NGCC adult gambling curated indicator data', () => {
  it('keeps three distinct CPGI series and 27 unique observations', () => {
    expect(indicators).toHaveLength(3);
    expect(new Set(indicators.map((indicator) => indicator.code)).size).toBe(3);

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
    expect(keys).toHaveLength(27);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('requires bounded percentages, definitions, notes and exact official provenance', () => {
    expect(data.sourceId).toBe('ngcc_gambling');
    expect(data.sourceUrl).toBe(
      'https://www.ngcc.go.kr/data/pdsView.do?selectedNo=10332',
    );
    expect(new URL(data.sourceUrl).hostname).toBe('www.ngcc.go.kr');

    for (const indicator of indicators) {
      expect(indicator.definitionKo.trim()).not.toBe('');
      expect(indicator.methodNote?.trim()).toBeTruthy();
      expect(indicator.unit).toBe('%');
      expect(indicator.observations.map((row) => row.period)).toEqual(periods);

      for (const observation of indicator.observations) {
        expect(observation.geo).toBe('KR');
        expect(observation.qualifier).toBe('total');
        expect(observation.value).toMatch(/^\d+(?:\.\d+)?$/);
        expect(Number(observation.value)).toBeGreaterThanOrEqual(0);
        expect(Number(observation.value)).toBeLessThanOrEqual(100);
        expect(observation.note?.trim()).toBeTruthy();
        expect(observation.note?.length ?? 0).toBeLessThanOrEqual(300);
      }
    }
  });

  it('preserves the official 2008-2024 table and rounded component arithmetic', () => {
    const overall = byCode.get('ngcc_adult_gambling_problem_rate');
    const moderate = byCode.get('ngcc_adult_gambling_moderate_risk_rate');
    const problem = byCode.get('ngcc_adult_gambling_problem_gambler_rate');

    expect(overall?.observations.map((row) => Number(row.value))).toEqual([
      9.5, 6.1, 7.2, 5.4, 5.1, 5.3, 5.3, 5.5, 5.1,
    ]);
    expect(moderate?.observations.map((row) => Number(row.value))).toEqual([
      7.2, 4.4, 5.9, 3.9, 3.8, 4.2, 4.3, 3.4, 4.0,
    ]);
    expect(problem?.observations.map((row) => Number(row.value))).toEqual([
      2.3, 1.7, 1.3, 1.5, 1.3, 1.1, 1.1, 2.1, 1.2,
    ]);

    for (const period of periods) {
      const value = (indicator: SeedIndicator | undefined) =>
        Number(
          indicator?.observations.find((row) => row.period === period)?.value,
        );
      // 공표표는 각 구성값을 소수 첫째 자리로 반올림하므로 합계와 최대 0.1%p 차이날 수 있다.
      expect(
        Math.abs(value(moderate) + value(problem) - value(overall)),
      ).toBeLessThanOrEqual(0.11);
    }
  });

  it("does not encode the report's internally inconsistent 2024 interval as bounds", () => {
    const latest = byCode
      .get('ngcc_adult_gambling_problem_rate')
      ?.observations.find((row) => row.period === '2024');
    expect(latest?.value).toBe('5.1');
    expect(latest?.note).toContain('표기 상이');
    expect(latest).not.toHaveProperty('valueLow');
    expect(latest).not.toHaveProperty('valueHigh');
  });
});
