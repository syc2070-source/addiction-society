/**
 * Statory 카드의 논문 열쇠 · keep/hide 상속 (SOC-R14 ■2 · 계약 v1.4 §3-3 · §6-2 · §6-3) — 순수 함수.
 * 받는 문 구현(11월)이 이것을 쓴다.
 *
 * 왜: Statory 내보내기의 card_id 는 판마다 다른 줄 id(uuid)다(ASK-53 리뷰 F1). card_id 로 잇으면 고친 판이
 * 다른 카드로 와서 앞 판의 keep 이 끊기고(손님 화면에서 내려감) hide 도 판을 넘지 못한다.
 * ASK-54 가 줄마다 paper_id(= Statory item_id · 논문 하나에 하나 · 판이 바뀌어도 같음)를 내보낸다.
 *
 *  - 열쇠: paper_id 가 있으면 `paper:<paper_id>` · 없으면 옛 꼴 `card:<card_id>`(v1.3 그대로 · 판을 넘어 잇지 못함).
 *    paper_id 꼴 = 빈 글 아닌 글 또는 양의 정수(Statory sqlite id) → 글로 맞춤 · 그 밖(빈 글 · 객체 · 0 · 음수) = 줄 거절
 *    `paper_id_invalid`(틀린 열쇠로 남의 keep 을 물려받지 않게). 같은 봉투에 같은 paper_id 가 둘이면 뒤 줄 거절
 *    `paper_id_duplicate`(ASK-53 = 논문마다 한 줄).
 *  - 상속: 같은 열쇠의 앞 판 가운데 **사람이 마지막으로 정한 결정**을 새 판이 이어받는다 —
 *    hide → hide · keep → keep + 표식 keep_from_version(= 그 keep 을 받은 판 · 화면·관리자 표시 「전 판 keep」) ·
 *    결정 없음 → NULL(보류). 표식은 사람이 새 판을 다시 보면(keep/hide 를 새로 정하면) 지운다.
 *  - 옛 꼴(card 열쇠)과 새 꼴(paper 열쇠)은 서로 잇지 않는다 — 같은 논문이 옛 꼴로 먼저 왔으면 첫 paper 판은 보류로 선다(넘겨짚지 않음).
 */

export type ReviewDecision = 'keep' | 'hide' | null;

export type PaperKeyReject = 'paper_id_invalid' | 'paper_id_duplicate';

export interface CardKey {
  /** `paper:<id>` 또는 `card:<id>` · 거절이면 null */
  key: string | null;
  form: 'paper' | 'card';
  reject: PaperKeyReject | null;
}

const text = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;

/**
 * paper_id → 열쇠 글. 수 = 안전한 양의 정수만(2^53 넘으면 다른 논문과 겹칠 수 있음) ·
 * 숫자 글 = 0 으로 시작하지 않는 양의 정수만(「0123」 과 123 이 두 열쇠가 되지 않게 · 「0」 · 「-1」 거절) ·
 * 그 밖의 글 = 숫자 꼴이 아닌 64 자 이하 글을 그대로(불투명 열쇠) · 나머지 null(리뷰 찾기 5).
 */
function paperIdOf(p: unknown): string | null {
  if (typeof p === 'number') {
    return Number.isSafeInteger(p) && p > 0 ? String(p) : null;
  }
  const s = text(p);
  if (!s || s.length > 64) return null;
  if (/^[+-]?\d+$/.test(s)) return /^[1-9]\d{0,14}$/.test(s) ? s : null;
  return s;
}

/** 줄 하나의 열쇠 — paper_id(있으면) → card_id(옛 꼴) */
export function cardKeyOf(item: unknown): CardKey {
  const row = (item ?? {}) as { paper_id?: unknown; card_id?: unknown };
  if (row.paper_id !== undefined && row.paper_id !== null) {
    const id = paperIdOf(row.paper_id);
    return id
      ? { key: `paper:${id}`, form: 'paper', reject: null }
      : { key: null, form: 'paper', reject: 'paper_id_invalid' };
  }
  const card = text(row.card_id);
  // card_id 가 없는 줄은 §6-2 card_id_missing 이 거절한다 — 여기서는 열쇠 없음
  return { key: card ? `card:${card}` : null, form: 'card', reject: null };
}

/**
 * 봉투의 줄들 → 줄마다 열쇠 · 같은 paper_id 가 둘이면 뒤 줄 거절.
 * 받는 문은 §6-2 의 다른 검사(title_missing 따위)를 통과한 줄만 넘긴다 — 거절될 줄이 paper_id 를 먼저 차지해
 * 바른 뒤 줄까지 잃지 않게(리뷰 6).
 */
export function cardKeysOf(items: unknown[]): CardKey[] {
  const seen = new Set<string>();
  return items.map((item) => {
    const k = cardKeyOf(item);
    if (k.form === 'paper' && k.key) {
      if (seen.has(k.key)) {
        return { key: null, form: 'paper', reject: 'paper_id_duplicate' };
      }
      seen.add(k.key);
    }
    return k;
  });
}

/** 받는 표에 이미 있는 판 하나(§6-3) */
export interface StoredCard {
  key: string;
  cardVersion: string;
  decision: ReviewDecision;
  /** 사람이 결정을 정한 때 — 「마지막 결정」을 고르는 잣대 */
  reviewedAt: Date | null;
  /** 그 판의 keep 이 물려받은 것이면 원래 판 */
  keepFromVersion?: string | null;
}

export interface Inherited {
  decision: ReviewDecision;
  /** keep 을 물려받았으면 그 keep 을 받은 판(「전 판 keep」) · 아니면 null */
  keepFromVersion: string | null;
  /** 물려준 판 · 없으면 null */
  fromVersion: string | null;
}

/**
 * 새 판(열쇠 key · 판 cardVersion)이 설 때의 결정 — 같은 열쇠의 다른 판 가운데 사람이 마지막으로 정한 것.
 * 같은 판이 다시 오면(멱등) 그 판의 결정을 그대로 돌려준다.
 */
export function inheritDecision(
  stored: StoredCard[],
  key: string,
  cardVersion: string,
): Inherited {
  const same = stored.find(
    (s) => s.key === key && s.cardVersion === cardVersion,
  );
  if (same) {
    return {
      decision: same.decision,
      keepFromVersion: same.keepFromVersion ?? null,
      fromVersion: null,
    };
  }
  // 사람 결정 = reviewedAt 이 있는 판(보류로 되돌린 것 NULL 도 결정 · 리뷰 찾기 3) · 같은 때면 hide > NULL > keep(안전한 쪽 · 리뷰 찾기 4)
  const rank = (d: ReviewDecision) => (d === 'hide' ? 2 : d === null ? 1 : 0);
  const decided = stored
    .filter((s) => s.key === key && s.reviewedAt)
    .sort(
      (a, b) =>
        b.reviewedAt!.getTime() - a.reviewedAt!.getTime() ||
        rank(b.decision) - rank(a.decision),
    );
  const last = decided[0];
  if (!last || last.decision === null) {
    return { decision: null, keepFromVersion: null, fromVersion: null };
  }
  return {
    decision: last.decision,
    // 사람이 정한 판의 keep 이 곧 승인 — 그 판 이름(옛 표식을 끌고 오지 않음 · 리뷰)
    keepFromVersion: last.decision === 'keep' ? last.cardVersion : null,
    fromVersion: last.cardVersion,
  };
}
