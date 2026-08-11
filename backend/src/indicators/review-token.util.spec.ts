import {
  issueReviewToken,
  verifyReviewToken,
  newBatchId,
} from './review-token.util';

/**
 * 검수 토큰 테스트 (AS-PDF-RUN).
 * 이 토큰은 로그인 없이 승인을 허용하므로, 위조·만료·타 배치 침범이
 * 확실히 막히는지가 보안의 전부다.
 */

const SECRET = 'test-secret-0123456789';
const at = (iso: string) => new Date(iso);

describe('issueReviewToken / verifyReviewToken', () => {
  it('정상 토큰은 배치를 그대로 복원한다', () => {
    const t = issueReviewToken('kcgp_youth:2024:abc', SECRET);
    const v = verifyReviewToken(t, SECRET);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.batch).toBe('kcgp_youth:2024:abc');
  });

  it('서명을 한 글자만 바꿔도 거부한다', () => {
    const t = issueReviewToken('b1', SECRET);
    const tampered = t.slice(0, -1) + (t.endsWith('A') ? 'B' : 'A');
    expect(verifyReviewToken(tampered, SECRET)).toEqual({
      ok: false,
      reason: '서명 불일치',
    });
  });

  it('페이로드를 바꿔 다른 배치를 승인할 수 없다', () => {
    // 공격 시나리오: 내 배치 토큰의 batch만 남의 배치로 갈아끼우기
    const t = issueReviewToken('mine:2024:aaa', SECRET);
    const [, sig] = t.split('.');
    const forgedBody = Buffer.from(
      JSON.stringify({
        batch: 'other:2024:bbb',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
      'utf8',
    )
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(verifyReviewToken(`${forgedBody}.${sig}`, SECRET)).toEqual({
      ok: false,
      reason: '서명 불일치',
    });
  });

  it('다른 비밀키로는 검증되지 않는다', () => {
    const t = issueReviewToken('b1', SECRET);
    expect(verifyReviewToken(t, 'another-secret')).toEqual({
      ok: false,
      reason: '서명 불일치',
    });
  });

  it('만료되면 거부한다 (기본 14일)', () => {
    const issued = at('2026-08-01T00:00:00Z');
    const t = issueReviewToken('b1', SECRET, 14, issued);
    expect(verifyReviewToken(t, SECRET, at('2026-08-14T00:00:00Z')).ok).toBe(
      true,
    );
    expect(verifyReviewToken(t, SECRET, at('2026-08-16T00:00:00Z'))).toEqual({
      ok: false,
      reason: '만료됨',
    });
  });

  it('형식이 깨진 토큰은 형식 오류', () => {
    for (const bad of ['', 'nodot', 'a.b.c', '.sig', 'body.']) {
      expect(verifyReviewToken(bad, SECRET).ok).toBe(false);
    }
  });

  it('URL에 그대로 넣을 수 있는 문자만 쓴다', () => {
    const t = issueReviewToken('kcgp_youth:2024:abc', SECRET);
    expect(t).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(encodeURIComponent(t)).toBe(t);
  });
});

describe('newBatchId', () => {
  it('소스·회차를 알아볼 수 있는 형태', () => {
    const id = newBatchId('kcgp_youth', '2024', at('2026-08-11T00:00:00Z'));
    expect(id.startsWith('kcgp_youth:2024:')).toBe(true);
    // 컨트롤러가 배치 id 앞부분에서 sourceId를 복원한다
    expect(id.split(':')[0]).toBe('kcgp_youth');
  });
});
