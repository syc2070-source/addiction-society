/**
 * 감시 크론 수동 1회 실행 + 실패 주입 테스트 (M2-6).
 *
 * 실행: npm run monitor:once
 *
 * NestApplicationContext로 실제 DI(스케줄러·리포지토리·알림)를 그대로 띄워
 * scheduler.monitorSources()를 직접 호출한다(HTTP 서버는 안 띄움).
 *  - 존재하지 않는 URL 소스를 임시 삽입해 크론이 죽지 않고 소스별로 격리되는지 확인
 *  - 테스트 후 임시 소스 삭제(원복)
 *  - Discord 웹훅 미설정이어도 정상 동작(알림은 로그로만)
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { AppModule } from '../../app.module';
import { Source } from '../entities/source.entity';
import { SourcesScheduler } from '../sources.scheduler';

const BAD_ID = '__test_bad_url__';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  const scheduler = app.get(SourcesScheduler);
  const repo = app.get<Repository<Source>>(getRepositoryToken(Source));

  // 크론 등록 확인
  const registry = app.get(SchedulerRegistry);
  const cronNames = [...registry.getCronJobs().keys()];
  console.log('[monitor-test] 등록된 크론:', JSON.stringify(cronNames));

  // ── 실패 주입: 존재하지 않는 URL 소스 임시 삽입 ──
  await repo.delete(BAD_ID);
  await repo.save(
    repo.create({
      id: BAD_ID,
      org: 'TEST',
      orgKo: '테스트기관',
      domain: 'policy',
      scope: 'global',
      kind: 'policy',
      titleKo: '실패주입 테스트',
      titleEn: 'Failure Injection Test',
      url: 'https://nonexistent-observatory-test.invalid/',
      accessMethod: 'html',
      cadence: 'irregular',
      status: 'active',
      failCount: 0,
    } as Partial<Source>),
  );

  // 감시 대상: 실제 HTTP 소스 2 + manual 1 + 실패주입 1
  const picks = await repo.find({
    where: [
      { id: 'who_gho_alcohol' }, // api
      { id: 'gdpi' }, // pdf(HTTP)
      { id: 'lancet_gambling' }, // manual → HTTP 생략
      { id: BAD_ID }, // 실패 주입
    ],
  });

  console.log(`\n[monitor-test] 대상 ${picks.length}건 감시 시작\n`);
  const results = await scheduler.monitorSources(picks);
  console.log('\n[monitor-test] 소스별 결과:');
  console.log(JSON.stringify(results, null, 2));

  const survived = results.length === picks.length;
  const badResult = results.find((r) => r.id === BAD_ID);
  console.log(
    `\n[monitor-test] 격리 확인: 대상 ${picks.length}건 모두 결과 반환 = ${survived}, ` +
      `실패주입 소스 status = ${badResult?.status} (throw 없이 처리됨)`,
  );

  // ── 원복 ──
  await repo.delete(BAD_ID);
  console.log('[monitor-test] 임시 소스 삭제(원복) 완료');

  await app.close();
  process.exit(0);
}

run().catch((e) => {
  console.error('[monitor-test] 스크립트 오류:', e?.message || e);
  process.exit(1);
});
