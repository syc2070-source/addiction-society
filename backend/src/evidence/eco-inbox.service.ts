import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min, ValidateIf } from 'class-validator';
import {
  IsNull,
  LessThan,
  Not,
  type FindOptionsWhere,
  type Repository,
} from 'typeorm';
import { EcoInboxItem } from './entities/eco-inbox.entity';
import {
  adminTabOf,
  adminView,
  guestView,
  type AdminTab,
  type InboxRowView,
} from './eco-inbox';

/**
 * 받은 것 검수 결정 (SOC-R15). null = 되돌리기(검토 대기로) — **칸은 꼭 있어야 한다**
 * (빈 몸 · 철자 틀린 열쇠가 「사람이 보류로 되돌림」으로 기록돼 다음 판 상속을 바꾸지 않게 · 리뷰 5).
 */
export class ReviewEcoDto {
  // null 이 실려 오면 되돌리기 · 열쇠가 없으면(undefined) IsIn 에 걸려 400
  @ValidateIf((o: { decision?: unknown }) => o.decision !== null)
  @IsIn(['keep', 'hide'])
  decision: 'keep' | 'hide' | null;
}

export class EcoQueueQueryDto {
  @IsOptional()
  @IsIn(['pending', 'keep', 'hide', 'withdrawn'])
  tab?: AdminTab;

  /** 앞 쪽의 마지막 id — 이보다 작은 id 부터(없으면 처음) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  before?: number;
}

/** 검수 창 한 쪽 줄 수 */
export const QUEUE_PAGE = 200;

const viewOf = (r: EcoInboxItem): InboxRowView => ({
  id: r.id,
  origin: r.origin,
  slug: r.slug,
  version: r.version,
  paperKey: r.paperKey,
  title: r.title,
  url: r.url,
  grade: r.grade,
  kind: r.kind,
  subtype: r.subtype ?? [],
  topic: r.topic,
  licence: r.licence,
  missing: r.missing,
  upstream: r.upstream,
  reviewDecision: r.reviewDecision,
  reviewedBy: r.reviewedBy,
  reviewedAt: r.reviewedAt,
  keepFromVersion: r.keepFromVersion,
  keyMovedFrom: r.keyMovedFrom,
  payload: r.payload ?? {},
});

/** 받은 것 읽기 · 검수 (SOC-R15 ■1 · ■4) */
@Injectable()
export class EcoInboxService {
  constructor(
    @InjectRepository(EcoInboxItem)
    private readonly repo: Repository<EcoInboxItem>,
  ) {}

  /**
   * 관리자 검수 화면 — 탭별(표에서 거름 · 리뷰 B2: 최근 N 줄만 읽고 거르면 옛 줄이 어느 탭에도 안 섬) ·
   * 한 쪽 200 · `before`(앞 쪽 마지막 id) 로 넘김 — 줄이 탭에서 빠져나가도 건너뛰는 줄 0(반박 4 · offset 아님) ·
   * 물려받은 keep 이면 꼬리표(C1).
   */
  async queue(tab: AdminTab = 'pending', before?: number) {
    const idCut = before && before > 0 ? { id: LessThan(before) } : {};
    const where: FindOptionsWhere<EcoInboxItem> =
      tab === 'withdrawn'
        ? { ...idCut, upstream: Not('public') }
        : {
            ...idCut,
            upstream: 'public',
            reviewDecision: tab === 'pending' ? IsNull() : tab,
          };
    const rows = await this.repo.find({
      where,
      order: { id: 'DESC' },
      take: QUEUE_PAGE,
    });
    // adminTabOf 와 같은 거름인지 한 번 더(표 조건과 화면 탭이 어긋나지 않게)
    return rows
      .map(viewOf)
      .filter((r) => adminTabOf(r) === tab)
      .map(adminView);
  }

  /** 손님 응답 — keep ∧ public 만 · 표식 없음(C1) */
  async guest() {
    const rows = await this.repo.find({
      where: { upstream: 'public', reviewDecision: 'keep' },
      order: { id: 'DESC' },
      take: 500,
    });
    return guestView(rows.map(viewOf));
  }

  /**
   * 사람 결정 — reviewed_* 를 적고 표식(keep_from_version)을 지운다(계약 §3-3 의 4 · 사람이 다시 정함).
   * 결정 칸만 쓴다(리뷰 1 — 행 전체 save 는 그사이 받는 문이 바꾼 paper_key · upstream 을 옛 값으로 덮음).
   * 이 결정이 그 열쇠의 「사람 마지막 결정」이 되므로, 같은 열쇠에서 **물려받은 값만 가진** 다른 판
   * (reviewed_at NULL)도 같은 결정으로 맞춘다 — keep 이면 표식 = 이 판(리뷰 2 · 한 트랜잭션).
   */
  async review(id: number, decision: 'keep' | 'hide' | null, by: string) {
    return this.repo.manager.transaction(async (m) => {
      const repo = m.getRepository(EcoInboxItem);
      const row = await repo.findOne({ where: { id } });
      if (!row) throw new NotFoundException(`eco_inbox #${id} 없음`);
      // 같은 열쇠의 행 전부를 id 차례로 먼저 잠근다 — 받는 문(origin 전체 · id 차례)과 다른 검수자와 잠금 차례가
      // 같아 서로 물고 기다리지 않는다(반박 2)
      await m.query(
        `SELECT "id" FROM "eco_inbox" WHERE "origin" = $1 AND "paper_key" = $2 ORDER BY "id" FOR UPDATE`,
        [row.origin, row.paperKey],
      );
      // 잠근 뒤 다시 읽는다(그사이 받는 문이 열쇠를 옮겼으면 새 열쇠로 맞춤)
      const locked = await repo.findOneOrFail({ where: { id } });
      await repo.update(id, {
        reviewDecision: decision,
        reviewedBy: by,
        reviewedAt: new Date(),
        keepFromVersion: null,
      });
      await m.query(
        `UPDATE "eco_inbox"
            SET "review_decision" = $3, "keep_from_version" = $4
          WHERE "origin" = $1 AND "paper_key" = $2 AND "id" <> $5 AND "reviewed_at" IS NULL`,
        [
          locked.origin,
          locked.paperKey,
          decision,
          decision === 'keep' ? locked.version : null,
          id,
        ],
      );
      const fresh = await repo.findOneOrFail({ where: { id } });
      return adminView(viewOf(fresh));
    });
  }
}
