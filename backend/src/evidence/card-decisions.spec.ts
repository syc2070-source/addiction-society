import {
  cardKeyOf,
  cardKeysOf,
  inheritDecision,
  type StoredCard,
} from './card-decisions';

const at = (d: string) => new Date(`2026-11-0${d}T03:00:00Z`);

describe('Statory 카드 논문 열쇠 paper_id (SOC-R14 ■2 · 계약 v1.4)', () => {
  it('paper_id → paper key (text or positive integer); absent → old form, card_id key', () => {
    expect(cardKeyOf({ paper_id: 'p-41', card_id: 'u1' })).toEqual({
      key: 'paper:p-41',
      form: 'paper',
      reject: null,
    });
    expect(cardKeyOf({ paper_id: 41, card_id: 'u1' }).key).toBe('paper:41');
    expect(cardKeyOf({ card_id: 'u1' })).toEqual({
      key: 'card:u1',
      form: 'card',
      reject: null,
    });
    expect(cardKeyOf({ paper_id: null, card_id: 'u1' }).key).toBe('card:u1');
    expect(cardKeyOf({}).key).toBeNull();
  });

  it('a wrong paper_id rejects the line (never falls back to card_id — a wrong key would inherit someone else’s keep)', () => {
    for (const bad of ['', '  ', 0, -3, 1.5, { id: 1 }, ['41'], true]) {
      expect(cardKeyOf({ paper_id: bad, card_id: 'u1' })).toEqual({
        key: null,
        form: 'paper',
        reject: 'paper_id_invalid',
      });
    }
  });

  it('two lines with the same paper_id in one envelope: the later one is rejected (ASK-53 = one line per paper)', () => {
    const keys = cardKeysOf([
      { paper_id: 41, card_id: 'u1' },
      { paper_id: '41', card_id: 'u2' },
      { paper_id: 42, card_id: 'u3' },
      { card_id: 'u4' },
    ]);
    expect(keys.map((k) => k.key)).toEqual([
      'paper:41',
      null,
      'paper:42',
      'card:u4',
    ]);
    expect(keys[1].reject).toBe('paper_id_duplicate');
  });
});

describe('keep/hide 상속 — 같은 논문의 새 판 (SOC-R14 ■2 · §3-3 의 4)', () => {
  const v = (
    cardVersion: string,
    decision: StoredCard['decision'],
    reviewed: string | null,
    keepFromVersion: string | null = null,
  ): StoredCard => ({
    key: 'paper:41',
    cardVersion,
    decision,
    reviewedAt: reviewed ? at(reviewed) : null,
    keepFromVersion,
  });

  it('keep carries to the new version with the 「전 판 keep」 mark; hide carries; nothing decided → held', () => {
    expect(
      inheritDecision([v('v4.0', 'keep', '1')], 'paper:41', 'v4.1'),
    ).toEqual({
      decision: 'keep',
      keepFromVersion: 'v4.0',
      fromVersion: 'v4.0',
    });
    expect(
      inheritDecision([v('v4.0', 'hide', '1')], 'paper:41', 'v4.1'),
    ).toEqual({
      decision: 'hide',
      keepFromVersion: null,
      fromVersion: 'v4.0',
    });
    expect(
      inheritDecision([v('v4.0', null, null)], 'paper:41', 'v4.1'),
    ).toEqual({
      decision: null,
      keepFromVersion: null,
      fromVersion: null,
    });
    expect(inheritDecision([], 'paper:41', 'v4.0').decision).toBeNull();
  });

  it('the last human decision wins; an inherited keep is not a human decision and keeps pointing at the approved version', () => {
    // v4.0 keep(사람) → v4.1 이 물려받음(사람 결정 아님 · reviewedAt 없음) → v4.2 도 v4.0 을 가리킴
    const chain = [v('v4.0', 'keep', '1'), v('v4.1', 'keep', null, 'v4.0')];
    expect(inheritDecision(chain, 'paper:41', 'v4.2')).toMatchObject({
      decision: 'keep',
      keepFromVersion: 'v4.0',
    });
    // 사람이 v4.1 을 다시 보고 hide → v4.2 는 hide
    const rehid = [v('v4.0', 'keep', '1'), v('v4.1', 'hide', '2')];
    expect(inheritDecision(rehid, 'paper:41', 'v4.2').decision).toBe('hide');
    // 사람이 hide 뒤에 새 판을 keep → 그 keep 이 이김(표식은 그 판)
    const rekept = [v('v4.0', 'hide', '1'), v('v4.1', 'keep', '3')];
    expect(inheritDecision(rekept, 'paper:41', 'v4.2')).toMatchObject({
      decision: 'keep',
      keepFromVersion: 'v4.1',
    });
  });

  it('review 3 · 4: a human reset to pending counts as the last decision; a tie in time goes to the safe side', () => {
    const reset = [v('v4.0', 'keep', '1'), v('v4.1', null, '2')];
    expect(inheritDecision(reset, 'paper:41', 'v4.2').decision).toBeNull();
    const tie = [v('v4.0', 'keep', '1'), v('v4.1', 'hide', '1')];
    expect(inheritDecision(tie, 'paper:41', 'v4.2').decision).toBe('hide');
    const tie2 = [v('v4.1', 'hide', '1'), v('v4.0', 'keep', '1')];
    expect(inheritDecision(tie2, 'paper:41', 'v4.2').decision).toBe('hide');
  });

  it('review 5: paper_id forms — canonical digits only, safe integers only, opaque text kept', () => {
    const key = (p: unknown) => cardKeyOf({ paper_id: p, card_id: 'u' });
    expect(key('0123').reject).toBe('paper_id_invalid');
    expect(key('0').reject).toBe('paper_id_invalid');
    expect(key('-1').reject).toBe('paper_id_invalid');
    expect(key(2 ** 53).reject).toBe('paper_id_invalid');
    expect(key('123').key).toBe(key(123).key);
    expect(key('item-7f3a').key).toBe('paper:item-7f3a');
    expect(key('x'.repeat(65)).reject).toBe('paper_id_invalid');
  });

  it('the same version again is idempotent; other papers and the old card key never pass decisions across', () => {
    const stored = [v('v4.0', 'keep', '1')];
    expect(inheritDecision(stored, 'paper:41', 'v4.0')).toEqual({
      decision: 'keep',
      keepFromVersion: null,
      fromVersion: null,
    });
    expect(inheritDecision(stored, 'paper:42', 'v4.1').decision).toBeNull();
    // 옛 꼴(card 열쇠)로 받은 keep 은 paper 열쇠 새 판에 이어지지 않는다
    const old: StoredCard = { ...v('v4.0', 'keep', '1'), key: 'card:u1' };
    expect(inheritDecision([old], 'paper:41', 'v4.1').decision).toBeNull();
    // 옛 꼴끼리도 card_id 가 판마다 다르면 이어지지 않는다(v1.3 의 한계 그대로)
    expect(inheritDecision([old], 'card:u2', 'v4.1').decision).toBeNull();
  });
});
