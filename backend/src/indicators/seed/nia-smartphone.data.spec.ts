import data from './nia-smartphone.data.json';

interface SeedObservation {
  geo: string;
  period: string;
  value: string;
  qualifier: string | null;
  note?: string | null;
}

interface SeedIndicator {
  code: string;
  domain: string;
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
  '2016',
  '2017',
  '2018',
  '2019',
  '2020',
  '2021',
  '2022',
  '2023',
  '2024',
  '2025',
];

describe('NIA smartphone overdependence curated indicator data', () => {
  it('keeps seven distinct series and 70 unique observations', () => {
    expect(indicators).toHaveLength(7);
    expect(new Set(indicators.map((indicator) => indicator.code)).size).toBe(7);

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
    expect(keys).toHaveLength(70);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('limits the series to the comparable 2016-2025 framework', () => {
    expect(data.sourceId).toBe('nia_smartphone');
    expect(data.sourceUrl).toBe(
      'https://kosis.kr/statHtml/statHtml.do?orgId=127&tblId=DT_120019N_2016_001',
    );
    expect(new URL(data.sourceUrl).hostname).toBe('kosis.kr');

    for (const indicator of indicators) {
      expect(indicator.domain).toBe('D2');
      expect(indicator.definitionKo.trim()).not.toBe('');
      expect(indicator.definitionKo).toContain('최근 1개월');
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

  it('preserves the national risk, high-risk and potential-risk series', () => {
    const overall = byCode.get('nia_smartphone_overdependence_risk_rate');
    const high = byCode.get('nia_smartphone_high_risk_rate');
    const potential = byCode.get('nia_smartphone_potential_risk_rate');

    expect(overall?.observations.map((row) => Number(row.value))).toEqual([
      17.8, 18.6, 19.1, 20.0, 23.3, 24.2, 23.6, 23.1, 22.9, 22.7,
    ]);
    expect(high?.observations.map((row) => Number(row.value))).toEqual([
      2.5, 2.7, 2.7, 2.9, 4.0, 4.5, 4.2, 4.2, 4.2, 4.1,
    ]);
    expect(potential?.observations.map((row) => Number(row.value))).toEqual([
      15.3, 15.9, 16.4, 17.1, 19.3, 19.7, 19.4, 18.9, 18.7, 18.6,
    ]);

    for (const period of periods) {
      const value = (indicator: SeedIndicator | undefined) =>
        Number(
          indicator?.observations.find((row) => row.period === period)?.value,
        );
      expect(value(high) + value(potential)).toBeCloseTo(value(overall), 10);
    }
  });

  it('preserves the official target-group series without mixing age ranges', () => {
    const expected: Record<string, number[]> = {
      nia_smartphone_child_overdependence_risk_rate: [
        17.9, 19.1, 20.7, 22.9, 27.3, 28.4, 26.7, 25.0, 25.9, 26.0,
      ],
      nia_smartphone_youth_overdependence_risk_rate: [
        30.6, 30.3, 29.3, 30.2, 35.8, 37.0, 40.1, 40.1, 42.6, 43.0,
      ],
      nia_smartphone_adult_overdependence_risk_rate: [
        16.1, 17.4, 18.1, 18.8, 22.2, 23.3, 22.8, 22.7, 22.4, 22.3,
      ],
      nia_smartphone_sixties_overdependence_risk_rate: [
        11.7, 12.9, 14.2, 14.9, 16.8, 17.5, 15.3, 13.5, 11.9, 11.5,
      ],
    };

    for (const [code, values] of Object.entries(expected)) {
      expect(
        byCode.get(code)?.observations.map((row) => Number(row.value)),
      ).toEqual(values);
    }
  });
});
