import { type DataSource } from 'typeorm';
import { BroadcastItem } from './sources/entities/broadcast-item.entity';
import { EcoInboxItem } from './evidence/entities/eco-inbox.entity';
import { Research } from './research/entities/research.entity';
import {
  SOURCE_ARCHIVED,
  SOURCE_DELETED,
  SOURCE_UNLISTED,
} from './sources/broadcast.util';

/**
 * 숨김 · 보관 수 (SOC-R23 ■3 · 결정 16) — 공개 상태 줄(/api/health/nightly)에 열쇠 없이 읽는 수.
 * 세기만 한다(COUNT) — 행 · 제목 · 까닭 글 · 사람 칸은 내보내지 않는다. 쓰기 0.
 *
 *  research   : approved 가운데 검수 창 숨김(review_decision = 'hide')
 *  broadcasts : 한 번의 GROUP BY(한 스냅숏) —
 *               visible   = 까닭 없음
 *               archived  = 'source_archived'(중독뉴스 방송 목록에서 빠짐 · 보관)
 *               removed   = 'source_deleted' · 'source_unlisted'(원천이 지움 · 원천 목록에 없음 — 사람 숨김 아님)
 *               hidden    = 그 밖의 까닭(사람 · 다른 길의 숨김)
 *  eco        : 받는 표 — 숨김 = review_decision 'hide' · 거둠 = upstream 'withdrawn'
 * 한 칸이 실패하면(표 없음 등) 그 칸만 null.
 */
export interface BroadcastVisibility {
  total: number;
  visible: number;
  archived: number;
  removed: number;
  hidden: number;
}

export interface VisibilitySummary {
  research: { approved: number; hidden: number } | null;
  broadcasts: BroadcastVisibility | null;
  eco: { total: number; hidden: number; withdrawn: number } | null;
}

async function orNull<T>(f: () => Promise<T>): Promise<T | null> {
  try {
    return await f();
  } catch {
    return null;
  }
}

/** 까닭별 수(GROUP BY 결과) → 다섯 칸 */
export function broadcastBuckets(
  rows: Array<{ reason: string | null; n: string | number }>,
): BroadcastVisibility {
  const out: BroadcastVisibility = {
    total: 0,
    visible: 0,
    archived: 0,
    removed: 0,
    hidden: 0,
  };
  for (const { reason, n } of rows) {
    const k = Number(n);
    out.total += k;
    if (reason === null) out.visible += k;
    else if (reason === SOURCE_ARCHIVED) out.archived += k;
    else if (reason === SOURCE_DELETED || reason === SOURCE_UNLISTED)
      out.removed += k;
    else out.hidden += k;
  }
  return out;
}

export async function visibilityCounts(
  ds: DataSource,
): Promise<VisibilitySummary> {
  const [r, b, e] = await Promise.all([
    orNull(async () => {
      const research = ds.getRepository(Research);
      const [approved, hidden] = await Promise.all([
        research.count({ where: { status: 'approved' } }),
        research.count({
          where: { status: 'approved', reviewDecision: 'hide' },
        }),
      ]);
      return { approved, hidden };
    }),
    orNull(async () => {
      const rows = await ds
        .getRepository(BroadcastItem)
        .createQueryBuilder('b')
        .select('b.hiddenReason', 'reason')
        .addSelect('COUNT(*)', 'n')
        .groupBy('b.hiddenReason')
        .getRawMany<{ reason: string | null; n: string }>();
      return broadcastBuckets(rows);
    }),
    orNull(async () => {
      const eco = ds.getRepository(EcoInboxItem);
      const [total, hidden, withdrawn] = await Promise.all([
        eco.count(),
        eco.count({ where: { reviewDecision: 'hide' } }),
        eco.count({ where: { upstream: 'withdrawn' } }),
      ]);
      return { total, hidden, withdrawn };
    }),
  ]);
  return { research: r, broadcasts: b, eco: e };
}
