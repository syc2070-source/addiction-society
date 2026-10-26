import { readFileSync } from 'fs';
import { join } from 'path';
import { readEnvelope } from './card-envelope';
import {
  adminView,
  ECO_SOURCE_READ_HEADER,
  ecoInboxEnabled,
  guestResponse,
  isGuestVisible,
  planInbox,
  readCardLine,
  readCardLines,
  readNewsLine,
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

const kciCard = (over: Record<string, unknown>) => ({
  card_id: 'k1',
  card_version: 'paper-card-struct-v1',
  paper_id: 'kci-item-k1',
  title: '국내 논문',
  source: 'kci',
  ...over,
});

describe('Statory 읽기 열쇠 머리 (SOC-R17 ■1 · 계약 v1.7 §6-4)', () => {
  it('the key rides in x-eco-export-key (Statory EVIDENCE_EXPORT_V1 §5-2), not the addicted-news x-export-key', () => {
    expect(ECO_SOURCE_READ_HEADER).toBe('x-eco-export-key');
    const src = statorySource({
      ECO_SOURCE_LATEST_URL: 'https://s.kr/latest',
      ECO_SOURCE_READ_KEY: 'k',
    });
    expect(src!.headers).toEqual({ 'x-eco-export-key': 'k' });
    expect(src!.headers).not.toHaveProperty('x-export-key');
  });
});

describe('DOI 없는 KCI 카드 (SOC-R17 ■1 · 계약 v1.7 §6-5)', () => {
  it('KCI without DOI is received when source_url is there (link = source_url); with neither it is received and marked missing, never shown to guests', () => {
    const url =
      'https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?x=1';
    const withUrl = readCardLine(kciCard({ doi: null, source_url: url }));
    expect(withUrl.reject).toBeNull();
    expect(withUrl.line!.url).toBe(url);
    expect(withUrl.line!.missing).toBeNull();

    const none = readCardLine(kciCard({ doi: null }));
    expect(none.reject).toBeNull();
    expect(none.line!.url).toBeNull();
    expect(none.line!.missing).toEqual(['doi', 'source_url']);
    const row = rowOf(none.line!, 1);
    expect(isGuestVisible(row)).toBe(false);
    expect(adminView(row).missing).toEqual(['doi', 'source_url']);
    // 봉투 missing 과 겹치지 않게 더함
    const merged = readCardLine(
      kciCard({ doi: null }),
      new Map([['k1', ['doi', 'license']]]),
    );
    expect(merged.line!.missing).toEqual(['doi', 'license', 'source_url']);

    // DOI 만 있는 KCI(Statory = DOI ∨ source_url) — 받음 · 링크 없음 표시
    const doiOnly = readCardLine(kciCard({ doi: '10.1/kci' }));
    expect(doiOnly.reject).toBeNull();
    expect(doiOnly.line!.missing).toEqual(['source_url']);

    // 꼴이 틀린 링크 · KCI 아닌 카드의 빈 링크는 지금처럼 거절
    expect(
      readCardLine(kciCard({ doi: null, source_url: 'http://kci.go.kr' }))
        .reject,
    ).toBe('source_url_invalid');
    expect(
      readCardLine(kciCard({ source: undefined, doi: '10.1/x' })).reject,
    ).toBe('source_url_invalid');
  });
});

describe('나머지 별칭 셋 (SOC-R17 ■2 · 계약 v1.7 §1-1)', () => {
  it('internet · social-media → smartphone · ai-dependence → ai; unknown values are still shown, not refused', () => {
    expect(SUBTYPE_ALIASES).toEqual({
      tobacco: 'nicotine',
      digital: 'smartphone',
      internet: 'smartphone',
      'social-media': 'smartphone',
      'ai-dependence': 'ai',
    });
    expect(
      subtypesOf(['internet', 'Social-Media', 'ai-dependence', 'vaping']),
    ).toEqual({ ids: ['smartphone', 'ai'], unknown: ['vaping'] });
    const news = readNewsLine(
      {
        id: 7002,
        title: 'AI 챗봇 의존',
        sourceUrl: 'https://a.kr/2',
        sourceType: 'kr_press',
        subtype: ['ai-dependence'],
      },
      'article',
    );
    expect(news.line!.subtype).toEqual(['ai']);
    expect(news.line!.payload.subtype).toEqual(['ai-dependence']);
    expect(news.line!.payload).not.toHaveProperty(UNKNOWN_SUBTYPE_KEY);
  });
});

describe('11월 켜기 예행 (SOC-R17 ■4 · 깃발 꺼짐 · DB 쓰기 0)', () => {
  it('the v1.7 envelope goes through the import:eco reading path: 4 received · 0 refused · 1 unknown · 3 missing', () => {
    // 깃발은 꺼진 그대로 — 이 예행은 import:eco 의 순수 길(readEnvelope → readCardLines → planInbox)만 돈다
    expect(ecoInboxEnabled({})).toBe(false);
    const env = readEnvelope(fixture('statory-export-v17.json'));
    expect(env.ok).toBe(true);
    expect(env.missingRejected).toEqual([]);
    const read = readCardLines(env);
    const plan = planInbox([], read.lines, true, read.protect);
    const unknown = read.lines.filter((l) => l.payload[UNKNOWN_SUBTYPE_KEY]);
    const missing = read.lines.filter((l) => l.missing);
    expect({
      received: read.lines.length,
      refused: read.rejected.length,
      unknown: unknown.length,
      missing: missing.length,
      insert: plan.insert.length,
      withdraw: plan.withdraw.length,
    }).toEqual({
      received: 4,
      refused: 0,
      unknown: 1,
      missing: 3,
      insert: 4,
      withdraw: 0,
    });
    expect(read.lines.map((l) => [l.cardId, l.subtype, l.missing])).toEqual([
      ['v17-card-plain', ['smartphone'], null],
      ['v17-card-kci-url', ['ai'], ['doi']],
      ['v17-card-kci-doi', ['gambling'], ['source_url']],
      ['v17-card-kci-none', [], ['doi', 'source_url']],
    ]);
    expect(unknown[0].payload[UNKNOWN_SUBTYPE_KEY]).toEqual(['vaping']);
    // 모두 검수 대기로 들어감(결정 상속 0)
    expect(plan.insert.every((i) => i.reviewDecision === null)).toBe(true);
    // 사람이 넷 다 keep 해도 손님에게는 링크 있는 둘만 · KCI 출처 줄
    const guest = guestResponse(
      read.lines.map((l, i) => rowOf(l, i + 1)),
      new Date('2026-11-05T00:00:00Z'),
    );
    expect(guest.items.map((i) => i.slug)).toEqual([
      'statory:card:v17-card-plain',
      'statory:card:v17-card-kci-url',
    ]);
    expect(guest.credit).not.toBeNull();
  });
});
