import { execFileSync, spawnSync } from 'child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DAILY_STEPS } from './scheduler/daily-jobs.scheduler';

/**
 * SOC-R3 ■2 — 빌드된 dist 로 시험한다.
 *
 * SOC-R2 결함: 매일 예약은 시드를 dist/*.js 로 돌리는데 data-source 가 .ts migration 을
 * 가리켜 initialize 가 실패했다(10-10~10-13 운영 쓰기 0). R1 시험은 ts-jest(src) 안에서만
 * 돌아 이 길을 보지 못했다. 여기서는 dist 를 node 자식 프로세스로 그대로 불러 본다.
 *
 * DB 연결 0: buildMetadatas() 는 entity·migration 을 불러 메타만 만든다(initialize 아님).
 * .env 읽기 0: 자식 프로세스는 빈 임시 폴더에서 돈다(dotenv 는 cwd 의 .env 만 읽는다).
 * dist 는 pretest(scripts/ensure-dist.js)가 없거나 낡았으면 빌드한다.
 */
const BACKEND = join(__dirname, '..');
const DIST = join(BACKEND, 'dist');
const js = (p: string) => JSON.stringify(p.replace(/\\/g, '/'));

function runNode(code: string): { status: number | null; out: string } {
  const r = spawnSync(process.execPath, ['-e', code], {
    cwd: mkdtempSync(join(tmpdir(), 'dist-run-')),
    encoding: 'utf8',
    timeout: 60_000,
  });
  return { status: r.status, out: `${r.stdout}\n${r.stderr}` };
}

function lastJson<T>(out: string): T {
  const line = out
    .split('\n')
    .filter((l) => l.startsWith('{'))
    .pop();
  if (!line) throw new Error(`자식 프로세스 출력에 JSON 없음:\n${out}`);
  return JSON.parse(line) as T;
}

const srcMigrations = readdirSync(join(__dirname, 'migrations')).filter((f) =>
  f.endsWith('.ts'),
);

function srcEntityFiles(dir: string): string[] {
  const found: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) found.push(...srcEntityFiles(p));
    else if (
      e.name.endsWith('.entity.ts') &&
      readFileSync(p, 'utf8').includes('@Entity(')
    ) {
      found.push(p);
    }
  }
  return found;
}

describe('dist (빌드 산출물) 실행 길', () => {
  beforeAll(() => {
    if (!existsSync(join(DIST, 'data-source.js'))) {
      throw new Error(
        'dist 없음 — npm test(pretest 가 빌드) 또는 npm run build',
      );
    }
  });

  it('dist/data-source.js builds metadata: migrations ≥ 14 and = src, entities = src, no DB', () => {
    const { status, out } = runNode(`
      const { AppDataSource: ds } = require(${js(join(DIST, 'data-source.js'))});
      ds.buildMetadatas().then(() => {
        console.log(JSON.stringify({
          migrations: ds.migrations.length,
          entities: ds.options.entities.length,
          metadatas: ds.entityMetadatas.length,
          initialized: ds.isInitialized,
          globs: ds.options.migrations,
        }));
      }, (e) => { console.error(String(e)); process.exit(2); });
    `);
    expect(status).toBe(0);
    const r = lastJson<{
      migrations: number;
      entities: number;
      metadatas: number;
      initialized: boolean;
      globs: string[];
    }>(out);
    expect(r.migrations).toBeGreaterThanOrEqual(14);
    expect(r.migrations).toBe(srcMigrations.length);
    expect(r.entities).toBe(srcEntityFiles(__dirname).length);
    expect(r.metadatas).toBeGreaterThanOrEqual(r.entities);
    expect(r.initialized).toBe(false);
    expect(r.globs.every((g) => g.endsWith('.js'))).toBe(true);
  });

  // SOC-R6 ■3: 8 → 9 단계(마지막 refresh:home)
  it('the daily runner loads from dist with the same 9 steps, each a real dist .js', () => {
    const { status, out } = runNode(`
      const m = require(${js(join(DIST, 'scheduler', 'daily-jobs.scheduler.js'))});
      const fs = require('fs');
      console.log(JSON.stringify(m.DAILY_STEPS.map((s) => {
        const c = m.commandFor(s.entry);
        const file = c.args[0];
        return { name: s.name, file, exists: fs.existsSync(file) };
      })));
    `);
    expect(status).toBe(0);
    const line = out.split('\n').find((l) => l.startsWith('['));
    const steps = JSON.parse(line ?? '[]') as {
      name: string;
      file: string;
      exists: boolean;
    }[];
    expect(steps.map((s) => s.name)).toEqual(DAILY_STEPS.map((s) => s.name));
    expect(steps).toHaveLength(9);
    for (const s of steps) {
      expect(s.file.replace(/\\/g, '/')).toContain('/dist/');
      expect(s.file.endsWith('.js')).toBe(true);
      expect(s.exists).toBe(true);
    }
  });

  it('regression (SOC-R2): pointing dist at src/migrations/*.ts fails', () => {
    const typeorm = require.resolve('typeorm');
    const { status, out } = runNode(`
      const { DataSource } = require(${js(typeorm)});
      const ds = new DataSource({
        type: 'postgres',
        migrations: [${js(join(BACKEND, 'src', 'migrations', '*.ts'))}],
      });
      ds.buildMetadatas().then(
        () => { console.log('loaded ' + ds.migrations.length); },
        (e) => { console.error(String(e)); process.exit(3); },
      );
    `);
    // 이 길이 다시 「성공」하면 node 가 .ts 를 직접 돌리게 된 것 — 그때 이 시험을 다시 본다.
    expect(status).toBe(3);
    expect(out).toMatch(/Error/);
  });

  it('dist migrationGlobs never names a .ts file', () => {
    const out = execFileSync(
      process.execPath,
      [
        '-e',
        `const m = require(${js(join(DIST, 'data-source.js'))});
         console.log(JSON.stringify(m.migrationGlobs(${js(join(DIST, 'data-source.js'))}, ${js(DIST)})));`,
      ],
      { cwd: mkdtempSync(join(tmpdir(), 'dist-run-')), encoding: 'utf8' },
    );
    const globs = JSON.parse(out.trim().split('\n').pop() ?? '[]') as string[];
    expect(globs).toHaveLength(1);
    expect(globs[0].endsWith('/migrations/*.js')).toBe(true);
  });
});
