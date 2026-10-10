import {
  academicQueryTerms,
  fieldProfileName,
  loadFieldProfile,
} from './field-profile';
import { buildGate } from '../research/relevance';

// SOC-R1 ■5 — 관문 사전이 분야 설정 파일로 옮겨졌는지.
describe('field profile', () => {
  const saved = process.env.FIELD_PROFILE;
  afterEach(() => {
    if (saved === undefined) delete process.env.FIELD_PROFILE;
    else process.env.FIELD_PROFILE = saved;
  });

  it('defaults to addiction and FIELD_PROFILE picks the file', () => {
    delete process.env.FIELD_PROFILE;
    expect(fieldProfileName()).toBe('addiction');
    process.env.FIELD_PROFILE = 'other';
    expect(fieldProfileName()).toBe('other');
  });

  it('uses the same key names as the addicted-news profile', () => {
    const p = loadFieldProfile('addiction');
    expect(p.field).toBe('addiction');
    expect(Object.keys(p)).toEqual(
      expect.arrayContaining([
        'field',
        'site_name',
        'keywords',
        'gate',
        'sources',
      ]),
    );
    expect(p.keywords.strong.ko.length).toBe(20);
    expect(
      p.keywords.strong.en_patterns.length +
        (p.keywords.strong.en_patterns_case_sensitive ?? []).length,
    ).toBe(22);
    expect(p.gate.research).toMatchObject({
      title_min: 1,
      keywords_min: 1,
      abstract_min: 3,
    });
    expect(p.sources.academic[0].grade).toBe('academic');
    expect(academicQueryTerms(p)).toHaveLength(11);
  });

  it('rejects path-like or missing profile names', () => {
    expect(() => loadFieldProfile('../etc')).toThrow(/올바르지 않음/);
    expect(() => loadFieldProfile('no-such-field')).toThrow(/없음/);
  });

  it('a different profile changes the gate (nothing field-specific in code)', () => {
    const p = loadFieldProfile('addiction');
    const g = buildGate({
      ...p,
      keywords: { strong: { ko: ['기후'], en_patterns: ['\\bclimate\\b'] } },
      gate: { research: { ...p.gate.research, abstract_min: 1 } },
    });
    expect(g.ko).toEqual(['기후']);
    expect(g.abstractMin).toBe(1);
    expect('Climate change'.match(g.counters[0])).toHaveLength(1);
  });
});
