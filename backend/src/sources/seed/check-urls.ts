/**
 * 소스 URL 생존 확인 (일회성).
 *
 * 실행: npm run check:sources-urls
 *
 * 23개 URL에 HEAD 요청 1회.
 *  - 성공(res.ok) → status 유지, lastCheckedAt 갱신
 *  - 실패(비200/네트워크/타임아웃) → status='stale', lastCheckedAt 갱신
 *  - 요청 간 2초 간격, 타임아웃 30초, 실패해도 throw 하지 않음
 * 크론화(정기 실행)는 M2 범위.
 */
import 'reflect-metadata';
import { AppDataSource } from '../../data-source';
import { Source } from '../entities/source.entity';

const UA = 'AddictionSociety-Observatory/1.0 (+https://addictionsociety.net)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run() {
  // 공용 AppDataSource 재사용(synchronize:false).
  const ds = AppDataSource;
  await ds.initialize();
  const repo = ds.getRepository(Source);
  const sources = await repo.find();

  const ok: string[] = [];
  const failed: { id: string; reason: string }[] = [];

  const blocked: { id: string; reason: string }[] = [];

  for (const s of sources) {
    const now = new Date();
    let alive = false;
    let isBlocked = false; // 403/405 HEAD 차단 오탐 여부
    let reason = '';
    try {
      const res = await fetch(s.url, {
        method: 'HEAD',
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(30_000),
        redirect: 'follow',
      });
      alive = res.ok;
      if (!alive) {
        reason = `HTTP ${res.status}`;
        // 403/405는 HEAD 차단 오탐. M2에서 GET + Range 헤더 또는
        // 조건부 요청으로 판정 로직 개선 필요. 현재는 stale 판정 보류.
        if (res.status === 403 || res.status === 405) isBlocked = true;
      }
    } catch (e: any) {
      alive = false;
      reason = e?.name === 'TimeoutError' ? 'timeout' : e?.code || e?.message || 'error';
    }

    // 403/405 차단은 stale로 쓰지 않는다. last_checked_at만 갱신, status는 유지.
    if (alive || isBlocked) {
      await repo.update(s.id, { lastCheckedAt: now });
    } else {
      await repo.update(s.id, { lastCheckedAt: now, status: 'stale' });
    }

    if (alive) {
      ok.push(s.id);
      console.log(`[url] OK      ${s.id}`);
    } else if (isBlocked) {
      blocked.push({ id: s.id, reason });
      console.log(`[url] BLOCKED ${s.id} (${reason} · HEAD 차단 오탐, stale 판정 보류)`);
    } else {
      failed.push({ id: s.id, reason });
      console.log(`[url] STALE   ${s.id} (${reason})`);
    }

    await sleep(2000); // 요청 간 2초
  }

  console.log(
    `\n[url] 완료: 생존 ${ok.length} / 차단보류 ${blocked.length} / 실패(stale) ${failed.length}`,
  );
  if (blocked.length) console.log('[url] 차단보류(403/405):', JSON.stringify(blocked));
  if (failed.length) console.log('[url] stale 목록:', JSON.stringify(failed));

  await ds.destroy();
}

run().catch((e) => {
  // 스크립트 자체 오류라도 프로세스는 정상 종료(요구사항: throw 금지 성격)
  console.error('[url] 스크립트 오류:', e?.message || e);
  process.exit(0);
});
