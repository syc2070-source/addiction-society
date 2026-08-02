import {
  computeNextExpected,
  isExpectedOverdue,
  monthStartOf,
} from './next-expected.util';

/**
 * 예정일 계산·이월 규칙 테스트 (AS-M3-FIX-DATE).
 *
 * 증상: 2026-08-02에 홈 카드의 "다음 발표 예정"에 2026-07(SAMHSA)이 남아 있었다.
 * 원인: 값이 배포 시 1회 백필된 뒤 늙지 않았다.
 * 여기서는 "과거 날짜 → 다음 주기로 이월"이 계산 단계에서 확실히 일어나는지 고정한다.
 */

const at = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('monthStartOf / isExpectedOverdue', () => {
  it('이번 달 1일을 반환한다', () => {
    expect(monthStartOf(at('2026-08-02'))).toBe('2026-08-01');
    expect(monthStartOf(at('2026-12-31'))).toBe('2026-12-01');
  });

  it('지난 달 예정은 지난 것으로 본다', () => {
    expect(isExpectedOverdue('2026-07-01', at('2026-08-02'))).toBe(true);
  });

  it('이번 달 예정은 1일이 지났어도 지난 것이 아니다', () => {
    // 월 정밀도 값이라 8/1 예정을 8/2에 감추면 "이번 달 예정"이 통째로 사라진다
    expect(isExpectedOverdue('2026-08-01', at('2026-08-02'))).toBe(false);
    expect(isExpectedOverdue('2026-08-01', at('2026-08-31'))).toBe(false);
  });

  it('미정(null)은 지난 것이 아니다', () => {
    expect(isExpectedOverdue(null, at('2026-08-02'))).toBe(false);
  });
});

describe('computeNextExpected — 발표 이력이 없는 소스(samhsa_nsduh 형태)', () => {
  const nsduh = {
    cadence: 'annual',
    expectedMonth: [7],
    lastPublishedAt: null,
  };

  it('예정 월이 지나면 다음 해로 이월한다 (버그 재현 케이스)', () => {
    // 7월 중에 계산하면 2026-07 (아직 이번 달이므로 감시 대상)
    expect(computeNextExpected(nsduh, at('2026-07-15'))).toBe('2026-07-01');
    // 8월이 되면 더 이상 2026-07이 아니라 2027-07로 넘어가야 한다
    expect(computeNextExpected(nsduh, at('2026-08-02'))).toBe('2027-07-01');
  });

  it('재계산 결과는 결코 지난 달이 아니다', () => {
    for (const day of [
      '2026-01-05',
      '2026-06-30',
      '2026-08-02',
      '2026-11-20',
    ]) {
      const next = computeNextExpected(nsduh, at(day));
      expect(isExpectedOverdue(next, at(day))).toBe(false);
    }
  });

  it('expectedMonth가 없으면 null (미정 그룹)', () => {
    expect(
      computeNextExpected(
        { cadence: 'annual', expectedMonth: null, lastPublishedAt: null },
        at('2026-08-02'),
      ),
    ).toBeNull();
  });

  it('irregular은 null (주간 크론이 따로 감시)', () => {
    expect(
      computeNextExpected(
        { cadence: 'irregular', expectedMonth: [3], lastPublishedAt: null },
        at('2026-08-02'),
      ),
    ).toBeNull();
  });
});

describe('computeNextExpected — 발표 이력이 있는 소스', () => {
  it('annual: 발간 이후 && 오늘 이후의 가장 이른 예정 월', () => {
    expect(
      computeNextExpected(
        {
          cadence: 'annual',
          expectedMonth: [7],
          lastPublishedAt: '2025-07-10',
        },
        at('2026-08-02'),
      ),
    ).toBe('2027-07-01');
  });

  it('biennial: 2년 스텝으로 넘어간다', () => {
    expect(
      computeNextExpected(
        {
          cadence: 'biennial',
          expectedMonth: [5],
          lastPublishedAt: '2024-05-02',
        },
        at('2026-08-02'),
      ),
    ).toBe('2028-05-01');
  });

  it('quinquennial: 5년 스텝', () => {
    expect(
      computeNextExpected(
        {
          cadence: 'quinquennial',
          expectedMonth: [11],
          lastPublishedAt: '2021-11-08',
        },
        at('2026-08-02'),
      ),
    ).toBe('2026-11-01');
  });

  it('monthly: 다음 도래 월로 이월', () => {
    const M_ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    expect(
      computeNextExpected(
        {
          cadence: 'monthly',
          expectedMonth: M_ALL,
          lastPublishedAt: '2026-07-20',
        },
        at('2026-08-02'),
      ),
    ).toBe('2026-09-01');
  });

  it('발간 감지 직후 재계산 결과도 지난 달이 아니다', () => {
    const next = computeNextExpected(
      { cadence: 'annual', expectedMonth: [7], lastPublishedAt: '2026-07-30' },
      at('2026-08-02'),
    );
    expect(next).toBe('2027-07-01');
    expect(isExpectedOverdue(next, at('2026-08-02'))).toBe(false);
  });
});
