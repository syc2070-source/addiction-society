import {
  IndicatorPdfService,
  PdfRound,
  SourceExtractionResult,
} from './indicator-pdf.service';
import { Source } from '../sources/entities/source.entity';

type PdfServiceHarness = {
  runParser: (
    pdfPath: string,
    adapter: string,
    period: string,
    sourceUrl: string,
  ) => Promise<{ sourceId: string; sourceUrl: string; indicators: [] }>;
  extractRound: (
    source: Source,
    adapter: string,
    round: PdfRound,
  ) => Promise<SourceExtractionResult>;
};

describe('IndicatorPdfService review notification', () => {
  afterEach(() => jest.restoreAllMocks());

  it('links the exact round source page instead of the generic source page', async () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'API_PUBLIC_URL') return 'https://api.example.test';
        if (key === 'REVIEW_TOKEN_SECRET') return 'review-secret-for-test';
        return undefined;
      }),
    };
    const notifyText = jest
      .fn<Promise<void>, [message: string, key: string]>()
      .mockResolvedValue(undefined);
    const notifier = { notifyText };
    const indicators = {
      pendingByBatch: jest.fn().mockResolvedValue([
        {
          nameKo: '청소년 도박 경험률',
          period: '2025',
          qualifier: 'total',
          value: '4.0',
          unit: '%',
        },
      ]),
    };
    const service = new IndicatorPdfService(
      config as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      notifier as never,
      indicators as never,
    );
    const source = {
      id: 'kcgp_youth',
      orgKo: '한국도박문제예방치유원',
      titleKo: '청소년 도박문제 실태조사',
      url: 'https://generic.example.test/source-list',
    } as Source;

    await service['notifyReview'](
      source,
      '2025',
      'kcgp_youth:2025:test',
      'https://exact.example.test/2025-report',
      {
        pendingInserted: 1,
        pendingUpdated: 0,
        skippedApproved: 0,
      },
    );

    expect(notifyText).toHaveBeenCalledWith(
      expect.stringContaining('원본: https://exact.example.test/2025-report'),
      'pdf:kcgp_youth',
    );
    expect(notifyText).not.toHaveBeenCalledWith(
      expect.stringContaining(source.url),
      expect.anything(),
    );
  });

  it('fails closed when a parser returns no observations', async () => {
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const events = { record: jest.fn().mockResolvedValue(undefined) };
    const notifier = { notifyText: jest.fn().mockResolvedValue(undefined) };
    const service = new IndicatorPdfService(
      config as never,
      {} as never,
      {} as never,
      {} as never,
      events as never,
      notifier as never,
      {} as never,
    );
    const source = {
      id: 'fixture_source',
      url: 'https://source.example.test/report',
    } as Source;
    const harness = service as unknown as PdfServiceHarness;

    jest.spyOn(service, 'resolveRoundUrl').mockResolvedValue({
      url: 'https://files.example.test/report.pdf',
      sourcePageUrl: source.url,
    });
    jest.spyOn(service, 'probeFile').mockResolvedValue({
      url: 'https://files.example.test/report.pdf',
      status: 200,
      contentType: 'application/pdf',
      bytes: 5,
      isPdf: true,
      isZip: false,
    });
    jest.spyOn(harness, 'runParser').mockResolvedValue({
      sourceId: source.id,
      sourceUrl: source.url,
      indicators: [],
    });
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(new Uint8Array([37, 80, 68, 70, 45])));

    const result = await harness.extractRound(source, 'fixture', {
      period: '2025',
    });

    expect(result.ran).toBe(false);
    expect(result.reason).toContain('파서 결과 없음');
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: source.id,
        eventType: 'failed',
      }),
    );
  });
});
