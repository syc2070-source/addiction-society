/**
 * npm test 앞(pretest) — dist 가 없거나 src 보다 오래됐으면 nest build (SOC-R3 ■2).
 *
 * src/dist-run.spec.ts 는 빌드된 dist 를 node 자식 프로세스로 돌려 매일 예약이 실제로
 * 쓰는 길(dist/*.js)을 시험한다. 낡은 dist 를 시험하면 의미가 없으므로 src 의 가장
 * 새 .ts(시험 파일 제외)가 dist/data-source.js 보다 새로우면 다시 빌드한다.
 * 걸린 시간을 한 줄로 남긴다.
 */
const { execSync } = require('child_process');
const { existsSync, readdirSync, statSync } = require('fs');
const { join } = require('path');

const root = join(__dirname, '..');
const marker = join(root, 'dist', 'data-source.js');

function newestSrc(dir) {
  let newest = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) newest = Math.max(newest, newestSrc(p));
    else if (/\.(ts|json)$/.test(e.name) && !e.name.endsWith('.spec.ts')) {
      newest = Math.max(newest, statSync(p).mtimeMs);
    }
  }
  return newest;
}

const reason = !existsSync(marker)
  ? 'dist 없음'
  : newestSrc(join(root, 'src')) > statSync(marker).mtimeMs
    ? 'src 가 dist 보다 새로움'
    : null;

if (!reason) {
  console.log('[pretest] dist 최신 — 빌드 건너뜀');
} else {
  const t0 = Date.now();
  execSync('npx nest build', { cwd: root, stdio: 'inherit' });
  console.log(
    `[pretest] ${reason} → nest build ${((Date.now() - t0) / 1000).toFixed(1)}s`,
  );
}
