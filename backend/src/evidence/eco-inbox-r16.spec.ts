import { readFileSync } from 'fs';
import { join } from 'path';
import { readEnvelope } from './card-envelope';
import {
  adminView,
  guestResponse,
  guestView,
  isKciCard,
  kciCreditOf,
  kciExpired,
  kciNarrowPayload,
  KCI_CREDIT,
  KCI_SOURCE,
  readCardLines,
  readNewsLine,
  ECO_SOURCE_READ_HEADER,
  ecoInboxEnabled,
  shortQuote,
  statorySource,
  subtypesOf,
  SUBTYPE_ALIASES,
  UNKNOWN_SUBTYPE_KEY,
  type InboxLine,
  type InboxRowView,
} from './eco-inbox';

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, '__fixtures__', name), 'utf8'));

/** 받은 줄 → 저장된 행처럼(검수 keep · public) */
const rowOf = (
  l: InboxLine,
  id: number,
  extra: Partial<InboxRowView> = {},
): InboxRowView => ({
  id,
  origin: l.origin,
  slug: l.slug,
  version: l.version,
  paperKey: l.paperKey,
  title: l.title,
  url: l.url,
  grade: l.grade,
  kind: l.kind,
  subtype: l.subtype,
  topic: l.topic,
  licence: l.licence,
  missing: l.missing,
  upstream: 'public',
  reviewDecision: 'keep',
  reviewedBy: 'owner',
  reviewedAt: new Date('2026-11-04T00:00:00Z'),
  keepFromVersion: null,
  keyMovedFrom: null,
  payload: l.payload,
  ...extra,
});

describe('받는 쪽 subtype 대응표 (SOC-R16 ■2 · 계약 v1.6 §1-1)', () => {
  it('maps tobacco → nicotine and digital → smartphone; §1 ids pass; the sent value stays in payload', () => {
    // SOC-R17 ■2 가 셋을 더함(eco-inbox-r17.spec) — 여기서는 v1.6 의 둘만 잰다
    expect(SUBTYPE_ALIASES).toMatchObject({
      tobacco: 'nicotine',
      digital: 'smartphone',
    });
    expect(subtypesOf(['tobacco', 'digital', 'gambling', 'nicotine'])).toEqual({
      ids: ['nicotine', 'smartphone', 'gambling'],
      unknown: [],
    });
    const news = readNewsLine(
      {
        id: 7001,
        title: '전자담배 광고',
        sourceUrl: 'https://a.kr/1',
        sourceType: 'kr_press',
        subtype: ['tobacco'],
      },
      'article',
    );
    expect(news.reject).toBeNull();
    expect(news.line!.subtype).toEqual(['nicotine']);
    expect(news.line!.payload.subtype).toEqual(['tobacco']);
  });

  it('an unknown value is not refused: the line is received and the value is shown to the admin as unknown_subtype', () => {
    expect(subtypesOf(['vaping', ' Gambling ', 3, 'vaping'])).toEqual({
      ids: ['gambling'],
      unknown: ['vaping', '3'],
    });
    expect(subtypesOf('gaming')).toEqual({ ids: ['gaming'], unknown: [] });
    const env = readEnvelope(fixture('statory-export-kci.json'));
    expect(env.ok).toBe(true);
    const read = readCardLines(env);
    expect(read.rejected).toEqual([]);
    const card = read.lines[1];
    expect(card.subtype).toEqual(['nicotine', 'gambling']);
    expect(card.payload[UNKNOWN_SUBTYPE_KEY]).toEqual(['vaping']);
    const admin = adminView(rowOf(card, 2, { reviewDecision: null }));
    expect(admin.unknownSubtype).toEqual(['vaping']);
    expect(admin.source).toBeNull();
  });
});

describe('Statory 공개 자리 설정 칸 (SOC-R16 ■4)', () => {
  it('empty URL = not configured (no pull); the key rides in a header only when set; the switch stays off', () => {
    expect(statorySource({})).toBeNull();
    expect(
      statorySource({ ECO_SOURCE_LATEST_URL: '', ECO_SOURCE_READ_KEY: '' }),
    ).toBeNull();
    expect(
      statorySource({ ECO_SOURCE_LATEST_URL: ' https://s.kr/latest ' }),
    ).toEqual({ url: 'https://s.kr/latest', headers: {} });
    expect(
      statorySource({
        ECO_SOURCE_LATEST_URL: 'https://s.kr/latest',
        ECO_SOURCE_READ_KEY: 'k',
      }),
    ).toEqual({
      url: 'https://s.kr/latest',
      headers: { [ECO_SOURCE_READ_HEADER]: 'k' },
    });
    // 옛 이름(SOC-R15)은 읽지 않는다 — 새 이름이 비면 미설정(옛 주소로 새 열쇠가 나가지 않게)
    expect(
      statorySource({
        ECO_STATORY_EXPORT_URL: 'https://old',
        ECO_SOURCE_READ_KEY: 'k',
      }),
    ).toBeNull();
    // URL · 열쇠가 있어도 깃발은 따로(꺼짐 그대로)
    expect(
      ecoInboxEnabled({
        ECO_SOURCE_LATEST_URL: 'https://s.kr/latest',
        ECO_SOURCE_READ_KEY: 'k',
      }),
    ).toBe(false);
  });
});

describe('KCI 유래 카드 (SOC-R16 ■3 · Statory ASK-58 ■4)', () => {
  const env = readEnvelope(fixture('statory-export-kci.json'));
  const [kci, plain] = readCardLines(env).lines;
  /** key_findings 첫 글(세 문장)의 앞 두 문장 */
  const QUOTE =
    '과의존 집단은 수면 시간이 평균 40분 짧았다. 잠들기까지 걸린 시간도 길었다.';

  it('stores no abstract body: bibliography + KCI link + a quote of at most two sentences', () => {
    expect(KCI_SOURCE).toEqual({ field: 'source', value: 'kci' });
    expect(isKciCard(kci.payload)).toBe(true);
    expect(kci.url).toMatch(/^https:\/\/www\.kci\.go\.kr\//);
    // DOI 없는 국내 논문도 받음(서지 + 링크)
    expect(kci.payload.doi).toBeNull();
    for (const k of [
      'abstract',
      'key_findings',
      'population',
      'region',
      'design',
      'sample',
      'limitations',
      'fields_missing',
    ]) {
      expect(kci.payload).not.toHaveProperty(k);
    }
    expect(kci.payload).toMatchObject({
      title: '청소년 스마트폰 과의존과 수면의 관계',
      authors: ['김민지', '이서준'],
      year: 2024,
      venue: '한국심리학회지: 건강',
      source: 'kci',
      use_until: '2027-10-24',
      quote: QUOTE,
    });
    // 저장되는 글 어디에도 초록 문장이 없다
    expect(JSON.stringify(kci.payload)).not.toContain('본 연구는');
    // 대응표도 같은 길(digital → smartphone)
    expect(kci.subtype).toEqual(['smartphone']);
    // KCI 가 아닌 카드는 그대로(발견 · 표본 따위 담음 · source 칸 없음)
    expect(plain.payload).toHaveProperty('key_findings');
    expect(isKciCard(plain.payload)).toBe(false);
  });

  it('shortQuote keeps two sentences and caps the length', () => {
    expect(shortQuote('하나. 둘! 셋? 넷.')).toBe('하나. 둘!');
    expect(shortQuote('끝 없는 한 문장')).toBe('끝 없는 한 문장');
    expect(shortQuote('   ')).toBeNull();
    // 마침표 없는 줄 나열 · 전각 부호도 문장 끝(리뷰 B3)
    expect(shortQuote('짧았다\n길었다\n줄었다')).toBe('짧았다 길었다');
    expect(shortQuote('가！ 나？ 다。')).toBe('가！ 나？');
    const long = shortQuote(`${'가'.repeat(500)}.`)!;
    expect(long.length).toBeLessThanOrEqual(300);
    expect(long.endsWith('…')).toBe(true);
  });

  it('guest: KCI item shows source + quote, no findings; the credit line appears only when a KCI item is visible', () => {
    const now = new Date('2026-11-05T00:00:00Z');
    const both = guestResponse([rowOf(kci, 1), rowOf(plain, 2)], now);
    expect(both.items[0]).toMatchObject({
      source: 'kci',
      quote: QUOTE,
      keyFindings: null,
    });
    expect(both.items[1]).toMatchObject({ source: null, quote: null });
    expect(both.credit).toEqual(KCI_CREDIT);
    expect(KCI_CREDIT.ko).toBe('KCI(한국학술지인용색인) 데이터 활용');
    expect(KCI_CREDIT.en).not.toMatch(/[가-힣]/);
    // KCI 항목이 없으면 · 검수 안 된(보이지 않는) KCI 항목뿐이면 출처 줄 0
    expect(guestResponse([rowOf(plain, 2)], now).credit).toBeNull();
    expect(
      guestResponse([rowOf(kci, 1, { reviewDecision: null })], now).credit,
    ).toBeNull();
    expect(guestResponse([], now)).toEqual({ items: [], credit: null });
    expect(kciCreditOf([{ source: null }])).toBeNull();
  });

  it('a non-KCI older version of a paper that is now KCI is not shown next to it (review B2)', () => {
    const now = new Date('2026-11-05T00:00:00Z');
    const oldPlain = rowOf(
      { ...plain, paperKey: kci.paperKey, slug: 'statory:card:old' },
      3,
    );
    const items = guestView([rowOf(kci, 1), oldPlain], now);
    expect(items.map((i) => i.source)).toEqual(['kci']);
    // 반박 1: KCI 판이 손님 줄에 없어도(보류 · 숨김) 표 전체의 KCI 열쇠로 옛 판을 내림 · 다른 논문은 그대로
    expect(guestView([oldPlain], now, [kci.paperKey])).toEqual([]);
    expect(guestView([rowOf(plain, 2)], now, [kci.paperKey])).toHaveLength(1);
  });

  it('a decided KCI row is only narrowed when the line comes again: the reviewed quote stays, use_until takes the earlier end (rebuttal 2)', () => {
    const stored = { ...kci.payload, quote: 'A.', use_until: '2027-01-01' };
    const incoming = { ...kci.payload, quote: 'B.', use_until: '2030-01-01' };
    expect(kciNarrowPayload(stored, incoming)).toMatchObject({
      quote: 'A.',
      use_until: '2027-01-01',
    });
    // 새 쪽이 더 이르면 새 쪽 · 전에 인용이 없었으면 새 인용 없음
    const noQuote: Record<string, unknown> = {
      ...kci.payload,
      use_until: '2030-01-01',
    };
    delete noQuote.quote;
    const out = kciNarrowPayload(noQuote, {
      ...incoming,
      use_until: '2027-06-01',
    });
    expect(out.use_until).toBe('2027-06-01');
    expect(out).not.toHaveProperty('quote');
    // 옛 payload 의 발견 · 본문은 남지 않음(새 KCI 꼴만)
    expect(
      kciNarrowPayload({ key_findings: ['x'], quote: 'A.' }, incoming),
    ).not.toHaveProperty('key_findings');
  });

  it('after use_until the KCI item leaves the guest view (row kept), and an unreadable date counts as expired', () => {
    const row = rowOf(kci, 1);
    // 2027-10-24 = 한국 시각 그날 끝(= 10-24 15:00 UTC)까지(리뷰 B4)
    expect(guestView([row], new Date('2027-10-24T14:59:00Z'))).toHaveLength(1);
    expect(guestView([row], new Date('2027-10-24T15:00:00Z'))).toHaveLength(0);
    expect(kciExpired({ use_until: 'soon' })).toBe(true);
    // 없는 날 · 시간대 없는 시각 = 못 읽음 → 지남(반박 3)
    expect(
      kciExpired({ use_until: '2027-02-31' }, new Date('2026-11-05')),
    ).toBe(true);
    expect(
      kciExpired({ use_until: '2027-10-24T23:59' }, new Date('2026-11-05')),
    ).toBe(true);
    expect(
      kciExpired(
        { use_until: '2027-10-24T23:59+09:00' },
        new Date('2026-11-05'),
      ),
    ).toBe(false);
    expect(kciExpired({})).toBe(false);
    expect(adminView(row).source).toBe('kci');
  });
});
