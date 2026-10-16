import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import type { QueryRunner } from 'typeorm';
import { AddIndicatorBreakYears1788600000001 } from '../migrations/1788600000001-AddIndicatorBreakYears';
import { INDICATOR_BREAK_YEARS } from './break-years';
import type { IndicatorDataFile } from './seed/indicator-seed';

/** SOC-R6 ■2 — 조사 설계 변경 해: 데이터 파일 = migration 값 · 지표 메타만(관측치 0). */
describe('indicator break years (SOC-R6 ■2)', () => {
  it('seed data files and the migration carry the same break years, and touch indicators only', async () => {
    const dir = join(__dirname, 'seed');
    const fromFiles: Record<string, number[]> = {};
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.data.json'))) {
      const file = JSON.parse(
        readFileSync(join(dir, f), 'utf8'),
      ) as IndicatorDataFile;
      for (const ind of file.indicators) {
        if (ind.breakYears) fromFiles[ind.code] = ind.breakYears;
        // 설계 변경 해에는 실제 관측치가 있어야 한다(없는 해로 끊지 않음)
        for (const y of ind.breakYears ?? []) {
          expect(ind.observations.some((o) => o.period === String(y))).toBe(
            true,
          );
        }
      }
    }
    expect(fromFiles).toEqual(INDICATOR_BREAK_YEARS);
    expect(fromFiles.kocca_game_usage_rate).toEqual([2023]);
    expect(fromFiles.kcgp_youth_gambling_problem_rate).toEqual([2020, 2022]);

    const sql: { q: string; p?: unknown[] }[] = [];
    const runner = {
      query: (q: string, p?: unknown[]) => (
        sql.push({ q, p }),
        Promise.resolve([])
      ),
    } as unknown as QueryRunner;
    await new AddIndicatorBreakYears1788600000001().up(runner);
    expect(sql[0].q).toContain(
      'ADD COLUMN IF NOT EXISTS "break_years" integer[]',
    );
    const updates = sql.slice(1);
    expect(updates).toHaveLength(4);
    for (const u of updates) {
      expect(u.q).toMatch(/^UPDATE "indicators"/);
      expect(u.q).toContain('"break_years" IS NULL'); // 비어 있을 때만
      expect(u.q).not.toMatch(/observations/);
    }
    expect(updates.map((u) => u.p)).toContainEqual([
      'kocca_game_usage_rate',
      [2023],
    ]);
  });
});
