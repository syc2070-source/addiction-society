import { IsNull, type DataSource } from 'typeorm';
import { BroadcastItem } from './sources/entities/broadcast-item.entity';
import { EcoInboxItem } from './evidence/entities/eco-inbox.entity';
import { Research } from './research/entities/research.entity';

/**
 * 숨김 · 보관 수 (SOC-R23 ■3 · 결정 16) — 공개 상태 줄(/api/health/nightly)에 열쇠 없이 읽는 수.
 * 세기만 한다(COUNT) — 행 · 제목 · 까닭 글 · 사람 칸은 내보내지 않는다. 쓰기 0.
 *
 *  research   : approved 가운데 검수 창 숨김(review_decision = 'hide')
 *  broadcasts : 보관 = hidden_reason 'source_archived'(중독뉴스 방송 목록에서 빠짐) · 숨김 = 그 밖의 까닭 · 보임 = 까닭 없음
 *  eco        : 받는 표 — 숨김 = review_decision 'hide' · 거둠 = upstream 'withdrawn'
 * 한 칸이 실패하면(표 없음 등) 그 칸만 null.
 */
export interface VisibilitySummary {
  research: { approved: number; hidden: number } | null;
  broadcasts: {
    total: number;
    visible: number;
    archived: number;
    hidden: number;
  } | null;
  eco: { total: number; hidden: number; withdrawn: number } | null;
}

export const ARCHIVED_REASON = 'source_archived';

async function orNull<T>(f: () => Promise<T>): Promise<T | null> {
  try {
    return await f();
  } catch {
    return null;
  }
}

export async function visibilityCounts(
  ds: DataSource,
): Promise<VisibilitySummary> {
  const research = ds.getRepository(Research);
  const broadcasts = ds.getRepository(BroadcastItem);
  const eco = ds.getRepository(EcoInboxItem);
  const [r, b, e] = await Promise.all([
    orNull(async () => {
      const [approved, hidden] = await Promise.all([
        research.count({ where: { status: 'approved' } }),
        research.count({
          where: { status: 'approved', reviewDecision: 'hide' },
        }),
      ]);
      return { approved, hidden };
    }),
    orNull(async () => {
      const [total, visible, archived] = await Promise.all([
        broadcasts.count(),
        broadcasts.count({ where: { hiddenReason: IsNull() } }),
        broadcasts.count({ where: { hiddenReason: ARCHIVED_REASON } }),
      ]);
      return { total, visible, archived, hidden: total - visible - archived };
    }),
    orNull(async () => {
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
