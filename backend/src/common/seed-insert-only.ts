import type { FindOptionsWhere, ObjectLiteral, Repository } from 'typeorm';

/**
 * seed 넣기만 (SOC-R2 ■3).
 *
 * 매일 예약(04:00 KST)이 seed:sources · seed:recovery · seed:documents ·
 * collect:indicators 를 돌린다. 예전에는 기존 행을 덮어써서 관리자가 고친 값과
 * 감시 크론이 갱신한 값(last_published_at 등)이 매일 seed 값으로 되돌아갔다.
 *
 * 이제 규칙은 하나다: 없는 행만 넣는다. 있는 행은 쓰지 않는다(updated_at 도 그대로).
 * seed 값과 DB 값이 다르면 seed_diff 로 실행 로그에만 남긴다 — 고칠지는 사람이 정한다
 * (관리자 PUT). 모든 기존 행을 건너뛰므로 「관리자 수정 표시」 열 없이도 사람 손이 지켜진다.
 * seed_diff 는 표가 아니라 로그다(이 판 스키마 변경 0).
 */
export interface SeedDiffEntry {
  table: string;
  key: string;
  field: string;
  db: unknown;
  seed: unknown;
}

/** 비교용 정규화: undefined→null · Date→ISO · 객체는 열쇠 정렬 JSON. */
function norm(v: unknown): string {
  if (v === undefined || v === null) return 'null';
  if (v instanceof Date) return JSON.stringify(v.toISOString());
  if (typeof v === 'number' || typeof v === 'bigint') return String(v);
  if (typeof v === 'string') {
    // numeric 열은 문자열로 온다 — 수로 같으면 같은 값.
    return /^-?\d+(\.\d+)?$/.test(v) ? String(Number(v)) : JSON.stringify(v);
  }
  if (Array.isArray(v)) return `[${v.map(norm).join(',')}]`;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${norm(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

function sameValue(db: unknown, seed: unknown): boolean {
  if (norm(db) === norm(seed)) return true;
  // date 열: DB 가 Date, seed 가 'YYYY-MM-DD' 인 경우.
  if (db instanceof Date && typeof seed === 'string' && seed.length === 10) {
    return db.toISOString().slice(0, 10) === seed;
  }
  return false;
}

/** seed 가 가진 열쇠만 비교한다(DB 에만 있는 열은 seed 의 일이 아님). */
export function diffFields(
  existing: Record<string, unknown>,
  seed: Record<string, unknown>,
  ignore: readonly string[] = [],
): { field: string; db: unknown; seed: unknown }[] {
  return Object.keys(seed)
    .filter((f) => !ignore.includes(f) && seed[f] !== undefined)
    .filter((f) => !sameValue(existing[f], seed[f]))
    .map((f) => ({ field: f, db: existing[f] ?? null, seed: seed[f] }));
}

export class SeedInsertOnly {
  readonly diffs: SeedDiffEntry[] = [];
  inserted = 0;
  skipped = 0;

  constructor(readonly table: string) {}

  /**
   * where 로 찾아 없으면 넣고 'inserted', 있으면 건드리지 않고 다른 값만 기록하고 'skipped'.
   */
  async insertOnly<T extends ObjectLiteral>(
    repo: Repository<T>,
    where: FindOptionsWhere<T>,
    row: Partial<T>,
    key: string,
    ignore: readonly string[] = [],
  ): Promise<{ result: 'inserted' | 'skipped'; entity: T }> {
    const existing = await repo.findOne({ where });
    if (!existing) {
      const entity = await repo.save(repo.create(row as T));
      this.inserted++;
      return { result: 'inserted', entity };
    }
    this.skipped++;
    for (const d of diffFields(
      existing as Record<string, unknown>,
      row as Record<string, unknown>,
      ignore,
    )) {
      this.diffs.push({ table: this.table, key, ...d });
    }
    return { result: 'skipped', entity: existing };
  }

  /** 기존 행에 대한 seed_diff 를 직접 남긴다(관측치처럼 비교 규칙이 따로 있는 경우). */
  record(key: string, field: string, db: unknown, seed: unknown): void {
    this.diffs.push({ table: this.table, key, field, db, seed });
  }

  lines(): string[] {
    const head = `[seed_diff] ${this.table}: 신규 ${this.inserted} · 기존 건너뜀 ${this.skipped} · 다른 값 ${this.diffs.length}건(기록만, 덮지 않음)`;
    const short = (v: unknown) => {
      const s = v instanceof Date ? v.toISOString() : JSON.stringify(v);
      return s.length > 80 ? `${s.slice(0, 77)}...` : s;
    };
    return [
      head,
      ...this.diffs.map(
        (d) =>
          `[seed_diff]   ${d.table} ${d.key} ${d.field}: db=${short(d.db)} seed=${short(d.seed)}`,
      ),
    ];
  }

  print(): void {
    for (const l of this.lines()) console.log(l);
  }
}
