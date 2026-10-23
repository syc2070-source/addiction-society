/**
 * Statory 카드 봉투 받기 (SOC-R12 ■3 · 계약 v1.2 §6-1) — 순수 함수. 받는 문 구현(11월)이 이것을 쓴다.
 *
 * 봉투 꼴(Statory build-evidence-export.mjs · ASK-52 가 두 칸을 더함 · 계약 v1.3 = 그 실물 꼴):
 *   { generated_at, count, items[], card_version?, missing?: [{ id, fields }], ...그 밖 칸(schema · skipped …) }
 *  - card_version · missing 이 **없으면 옛 꼴** 그대로 받는다(form 'old' · 거절 0).
 *  - 있는데 꼴이 틀리면: card_version(빈 글 · 글 아님) · missing(배열 아님) → 봉투 전체 envelope_invalid.
 *    missing 의 줄 하나가 틀리면 그 줄만 따로 적는다(missingRejected) — 나머지 봉투는 받는다.
 *  - missing 줄 = 「그 카드의 필수 칸 가운데 빈 것」(ASK-52 ■1). 빈 칸 없는 카드는 오지 않는다.
 * 「정보 부족」 같은 화면 표시는 지금 중독사회에 없다 → 만들지 않는다(SOC-R12 ■3 · 보고서). 받은 값은
 * missingByCard 로 카드에 붙여 둔다(받는 표 §6-3 이 서면 그대로 담음).
 */
import { jobCounts, type JobCounts } from '../common/job-counts';

export type EnvelopeReject =
  | 'envelope_invalid'
  | 'envelope_count_mismatch'
  | 'envelope_stale';

export type MissingReject =
  | 'missing_entry_invalid'
  | 'missing_duplicate_id'
  | 'missing_id_unknown'
  | 'missing_card_id_empty';

/**
 * Statory envelopeMissingOf(ASK-52 · origin/main b6faee813) 의 꼴 그대로 — `{ id: row.card_id, fields }`.
 * fields = EXPORT_REQUIRED_KEYS(card_id · card_version · title · doi · source_url · license) 가운데 빈 것.
 * 카드 id 자체가 빈 카드는 `id: null` + fields 에 `card_id` 로 온다 → 붙일 카드가 없어 따로 적는다
 * (missing_card_id_empty · 그 줄은 §6-2 card_id_missing 으로 거절).
 */
export interface MissingEntry {
  id: string | null;
  fields: string[];
}

export interface EnvelopeRead {
  ok: boolean;
  reject: EnvelopeReject | null;
  /** 'v1' = card_version 또는 missing 이 실려 옴 · 'old' = 둘 다 없음 */
  form: 'v1' | 'old';
  cardVersion: string | null;
  /** 봉투가 missing 칸을 실어 보냈나 — 없으면 「잼 0」이 아니라 「안 옴」(리뷰 찾기 2) */
  missingSent: boolean;
  items: unknown[];
  missingByCard: Map<string, string[]>;
  missingRejected: { index: number; reason: MissingReject }[];
}

const isText = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

/** card_version 꼴 — 예 v4 · v4.1 · 2026-10 */
const CARD_VERSION = /^[\w.-]{1,40}$/;

function cardIdOf(item: unknown): string | null {
  const id = (item as { card_id?: unknown } | null)?.card_id;
  return isText(id) ? id.trim() : null;
}

function fail(reject: EnvelopeReject): EnvelopeRead {
  return {
    ok: false,
    reject,
    form: 'old',
    cardVersion: null,
    missingSent: false,
    items: [],
    missingByCard: new Map(),
    missingRejected: [],
  };
}

/**
 * 봉투 하나를 잰다. previousGeneratedAt 이 있으면 그보다 늦어야 한다(같거나 이르면 envelope_stale ·
 * 그 회차를 건너뜀 · 계약 §6-1).
 */
export function readEnvelope(
  body: unknown,
  previousGeneratedAt?: string | null,
): EnvelopeRead {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('envelope_invalid');
  }
  const b = body as Record<string, unknown>;
  const at = isText(b.generated_at) ? Date.parse(b.generated_at) : NaN;
  if (!Number.isFinite(at) || !Array.isArray(b.items)) {
    return fail('envelope_invalid');
  }
  if (b.count !== undefined && b.count !== b.items.length) {
    return fail('envelope_count_mismatch');
  }
  if (previousGeneratedAt) {
    const prev = Date.parse(previousGeneratedAt);
    if (Number.isFinite(prev) && at <= prev) return fail('envelope_stale');
  }

  const hasVersion = b.card_version !== undefined;
  const hasMissing = b.missing !== undefined;
  // 공개 nightly 몸에 실리는 값이라 꼴을 좁힌다(리뷰 찾기 2 · 낱말·숫자·점·줄표 40 자까지)
  if (
    hasVersion &&
    !(typeof b.card_version === 'string' && CARD_VERSION.test(b.card_version))
  ) {
    return fail('envelope_invalid');
  }
  if (hasMissing && !Array.isArray(b.missing)) return fail('envelope_invalid');

  const items = b.items as unknown[];
  const known = new Set(items.map(cardIdOf).filter((x): x is string => !!x));
  const missingByCard = new Map<string, string[]>();
  const missingRejected: EnvelopeRead['missingRejected'] = [];
  ((b.missing as unknown[] | undefined) ?? []).forEach((m, index) => {
    const e = m as Partial<MissingEntry> | null;
    const fields = Array.isArray(e?.fields)
      ? e.fields.filter(isText).map((f) => f.trim())
      : [];
    if (
      !e ||
      !Array.isArray(e.fields) ||
      fields.length === 0 ||
      fields.length !== e.fields.length
    ) {
      missingRejected.push({ index, reason: 'missing_entry_invalid' });
      return;
    }
    if (!isText(e.id)) {
      const rawId: unknown = e.id;
      missingRejected.push({
        index,
        reason:
          (rawId == null || (typeof rawId === 'string' && !rawId.trim())) &&
          fields.includes('card_id')
            ? 'missing_card_id_empty'
            : 'missing_entry_invalid',
      });
      return;
    }
    const id = e.id.trim();
    if (missingByCard.has(id)) {
      missingRejected.push({ index, reason: 'missing_duplicate_id' });
      return;
    }
    if (!known.has(id)) {
      missingRejected.push({ index, reason: 'missing_id_unknown' });
      return;
    }
    missingByCard.set(id, [...new Set(fields)]);
  });

  return {
    ok: true,
    reject: null,
    form: hasVersion || hasMissing ? 'v1' : 'old',
    cardVersion: hasVersion ? (b.card_version as string) : null,
    missingSent: hasMissing,
    items,
    missingByCard,
    missingRejected,
  };
}

/**
 * 밤 단계(import:cards · 11월)의 [job_counts] — card_version · missing 수를 싣는다.
 * 봉투가 그 칸을 보내지 않았거나(옛 꼴) 거절됐으면 싣지 않는다 — 재지 않은 것을 0 으로 적지 않음(리뷰 찾기 2).
 */
export function envelopeJobCounts(
  r: EnvelopeRead,
  counts: Partial<JobCounts> = {},
): JobCounts {
  return jobCounts({
    ...counts,
    ...(r.ok && r.missingSent ? { missing: r.missingByCard.size } : {}),
    ...(r.ok && r.cardVersion ? { card_version: r.cardVersion } : {}),
  });
}
