import kcgp from './kcgp-youth.data.json';
import kdca from './kdca-knhanes.data.json';
import ngcc from './ngcc-adult-gambling.data.json';
import nia from './nia-smartphone.data.json';

interface DataFile {
  sourceId: string;
  indicators: Array<{
    code: string;
    observations: Array<{
      geo: string;
      period: string;
      qualifier: string | null;
    }>;
  }>;
}

describe('curated indicator catalogue', () => {
  it('keeps codes and database observation keys unique across every source', () => {
    const files = [kcgp, ngcc, nia, kdca] as unknown as DataFile[];
    const codes = files.flatMap((file) =>
      file.indicators.map((indicator) => indicator.code),
    );
    const observationKeys = files.flatMap((file) =>
      file.indicators.flatMap((indicator) =>
        indicator.observations.map((observation) =>
          [
            indicator.code,
            file.sourceId,
            observation.geo,
            observation.period,
            observation.qualifier ?? 'total',
          ].join('|'),
        ),
      ),
    );

    expect(codes).toHaveLength(18);
    expect(new Set(codes).size).toBe(codes.length);
    expect(observationKeys).toHaveLength(137);
    expect(new Set(observationKeys).size).toBe(observationKeys.length);
  });
});
