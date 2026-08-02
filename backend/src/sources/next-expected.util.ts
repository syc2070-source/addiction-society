import { Source } from './entities/source.entity';

/** 발간 주기 한국어 라벨 */
export const CADENCE_KO: Record<string, string> = {
  monthly: '월간',
  quarterly: '분기',
  annual: '연간',
  biennial: '격년',
  quinquennial: '5년',
  irregular: '비정기',
};

/** 계산에 필요한 최소 필드만 받는 형태 */
type NextInput = Pick<
  Source,
  'cadence' | 'expectedMonth' | 'lastPublishedAt'
>;

/**
 * 이번 달 1일('YYYY-MM-01', UTC). 예정일 비교의 기준선.
 *
 * next_expected_at은 "예상 발간 **월**의 1일"로 저장되는 월 정밀도 값이고
 * 화면(홈 카드·발표 달력)도 YYYY-MM으로만 표시한다. 따라서 지남/안 지남 판정은
 * 반드시 월 단위여야 한다. 일 단위로 비교하면 8월 1일 예정이 8월 2일에 사라져
 * "이번 달 예정" 전체가 화면에서 통째로 빠진다.
 */
export function monthStartOf(today: Date = new Date()): string {
  const y = today.getUTCFullYear();
  const m = String(today.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

/**
 * 예정 월이 이미 지났는가(= 발간을 잡지 못한 채 예정일이 과거가 됐는가).
 * null(미정)은 과거가 아니다.
 */
export function isExpectedOverdue(
  nextExpectedAt: string | null | undefined,
  today: Date = new Date(),
): boolean {
  if (!nextExpectedAt) return false;
  return nextExpectedAt.slice(0, 10) < monthStartOf(today);
}

/**
 * 다음 예상 발간일(next_expected_at)을 계산한다.
 *
 * 규칙:
 *  - expectedMonth 없음 / lastPublishedAt 없음 / cadence='irregular' → null
 *  - monthly·quarterly: 연 스텝 1년, expectedMonth의 각 월이 후보
 *  - annual: +1년, biennial: +2년, quinquennial: +5년
 *  - lastPublishedAt 이후이면서 오늘 이후인 후보 중 최소값을 택한다.
 *    (계산 결과가 과거이면 다음 주기로 자동으로 넘어감)
 *
 * 반환값은 'YYYY-MM-DD' 문자열(해당 월 1일) 또는 null.
 */
export function computeNextExpected(
  src: NextInput,
  today: Date = new Date(),
): string | null {
  const months = src.expectedMonth;
  if (!months || months.length === 0) return null;
  if (src.cadence === 'irregular') return null;

  const fmt = (ms: number): string => {
    const d = new Date(ms);
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${d.getUTCFullYear()}-${mm}-${dd}`;
  };

  const curYear = today.getUTCFullYear();
  // 이번 달 1일: expectedMonth가 이번 달이면 아직 감시 대상으로 잡히도록 경계로 사용
  const curMonthStart = Date.UTC(curYear, today.getUTCMonth(), 1);

  // 폴백: 발표 이력이 없어도 예상 월이 검증된 사실이므로 그것만으로 계산한다.
  // 오늘 기준 다음(또는 이번 달) 도래 월 1일.
  if (!src.lastPublishedAt) {
    const cands: number[] = [];
    for (let k = 0; k <= 6; k++) {
      for (const m of months) cands.push(Date.UTC(curYear + k, m - 1, 1));
    }
    const pick = cands
      .filter((c) => c >= curMonthStart)
      .sort((a, b) => a - b)[0];
    return pick == null ? null : fmt(pick);
  }

  // 다년 주기의 연 스텝. 월/분기 주기는 연내 여러 월이므로 스텝 1년으로 두고
  // expectedMonth 후보로 처리한다.
  const yearStep =
    src.cadence === 'biennial'
      ? 2
      : src.cadence === 'quinquennial'
        ? 5
        : 1;

  const last = new Date(`${src.lastPublishedAt}T00:00:00Z`);
  const lastMs = last.getTime();
  const todayMs = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const startYear = last.getUTCFullYear();

  const candidates: number[] = [];
  for (let k = 0; k <= 20; k++) {
    const y = startYear + k * yearStep;
    for (const m of months) {
      candidates.push(Date.UTC(y, m - 1, 1));
    }
  }

  // lastPublishedAt 이후(중복 발간 방지) && 오늘 이후(과거 제외) 중 최소
  const pick = candidates
    .filter((c) => c > lastMs && c >= todayMs)
    .sort((a, b) => a - b)[0];

  return pick == null ? null : fmt(pick);
}
