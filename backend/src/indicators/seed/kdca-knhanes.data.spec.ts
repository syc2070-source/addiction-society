import data from './kdca-knhanes.data.json';

interface SeedObservation {
  geo: string;
  period: string;
  value: string;
  qualifier: string | null;
  sourceUrl?: string;
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
const indicator = indicators[0];
const periods = [
  '2005',
  '2007',
  '2008',
  '2009',
  '2010',
  '2011',
  '2012',
  '2013',
  '2014',
  '2015',
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

describe('KDCA KNHANES high-risk drinking curated indicator data', () => {
  it('keeps one verified series with 20 unique observations and no fabricated 2006 row', () => {
    expect(indicators).toHaveLength(1);
    expect(indicator.code).toBe('kdca_knhanes_high_risk_drinking_rate');
    expect(indicator.observations).toHaveLength(20);
    expect(indicator.observations.map((row) => row.period)).toEqual(periods);
    expect(indicator.observations.some((row) => row.period === '2006')).toBe(
      false,
    );

    const keys = indicator.observations.map((observation) =>
      [
        indicator.code,
        data.sourceId,
        observation.geo,
        observation.period,
        observation.qualifier ?? 'total',
      ].join('|'),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('preserves the official age-standardized series and exact KOSIS provenance', () => {
    expect(data.sourceId).toBe('kdca_knhanes');
    expect(data.sourceUrl).toBe(
      'https://kosis.kr/statHtml/statHtml.do?orgId=177&tblId=DT_11702_N018&conn_path=I2',
    );
    expect(new URL(data.sourceUrl).hostname).toBe('kosis.kr');
    expect(indicator.definitionKo).toContain('남자는 7잔 이상');
    expect(indicator.definitionKo).toContain('여자는 5잔 이상');
    expect(indicator.definitionKo).toContain('주 2회 이상');
    expect(indicator.definitionKo).toContain('2005년 추계인구');
    expect(indicator.methodNote).toContain('2006년에는 조사가 없었');
    expect(indicator.methodNote).toContain('2023년부터');
    expect(indicator.unit).toBe('%');

    expect(indicator.observations.map((row) => Number(row.value))).toEqual([
      11.6, 12.5, 15.4, 13.5, 13.8, 14.1, 13.9, 12.6, 13.5, 13.3, 13.8, 14.2,
      14.7, 12.6, 14.1, 13.4, 14.2, 13.8, 13.6, 12.6,
    ]);

    for (const observation of indicator.observations) {
      expect(observation.geo).toBe('KR');
      expect(observation.qualifier).toBe('total');
      expect(observation.value).toMatch(/^\d+(?:\.\d+)?$/);
      expect(Number(observation.value)).toBeGreaterThanOrEqual(0);
      expect(Number(observation.value)).toBeLessThanOrEqual(100);
      expect(observation.note?.trim()).toBeTruthy();
      expect(observation.note?.length ?? 0).toBeLessThanOrEqual(300);
    }

    const latest = indicator.observations.at(-1);
    expect(latest?.period).toBe('2025');
    expect(latest?.value).toBe('12.6');
    expect(latest?.sourceUrl).toBe(
      'https://www.kdca.go.kr/bbs/kdca/42/312791/artclView.do',
    );
    expect(latest?.note).toContain('잠정치');
  });
});
