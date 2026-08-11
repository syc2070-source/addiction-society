/**
 * PDF 추출 수동 1회 실행 (AS-PDF-RUN).
 *
 * 실행: npm run extract:pdf              (모든 대상 소스·회차)
 *       npm run extract:pdf -- kcgp_youth        (그 소스의 모든 회차)
 *       npm run extract:pdf -- kcgp_youth 2024   (그 소스의 특정 회차)
 *
 * 왜 필요한가: 크론은 매월 1일 04시라 지금 당장 첫 수집을 돌릴 수 없고,
 * API 트리거(POST /api/indicators/extract-pdf)는 admin 토큰이 필요하다.
 * 이 스크립트는 **Render Shell에서 토큰 없이** 즉시 1회 돌리기 위한 것이다.
 *
 * 상시 운용은 크론이 한다 — 이건 첫 완주·재시도용 부트스트랩이다.
 * 결과는 Discord 검수 알림으로 나가고, 값은 승인 전까지 공개되지 않는다(원칙 8).
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { IndicatorPdfService } from '../indicator-pdf.service';

async function run() {
  const [sourceId, period] = process.argv.slice(2);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  const pdf = app.get(IndicatorPdfService);

  // 환경 자가진단 먼저 — python·pdfplumber가 없으면 여기서 바로 드러난다.
  const health = await pdf.health();
  console.log('\n[extract] 환경 점검:', JSON.stringify(health, null, 2));
  if (!health.ok) {
    console.error(
      '\n[extract] ❌ python/pdfplumber 미비 — 추출을 중단합니다. ' +
        '빌드 로그의 install-pdf-deps.sh 결과를 확인하십시오.',
    );
    await app.close();
    process.exit(1);
  }

  console.log(
    `\n[extract] 시작 — ${sourceId ? `소스 ${sourceId}` : '대상 소스 전부'}` +
      `${period ? ` / 회차 ${period}` : ''}`,
  );
  const results = sourceId
    ? await pdf.extractOne(sourceId, period)
    : await pdf.extractAll();

  console.log('\n[extract] 회차별 결과:');
  for (const r of results) {
    const head = `  ${r.sourceId}${r.period ? `/${r.period}` : ''}`;
    if (!r.ran) {
      console.log(`${head} — 실행 안 됨: ${r.reason ?? '사유 없음'}`);
      continue;
    }
    console.log(
      `${head} — 지표 ${r.indicators}, pending 신규 ${r.pendingInserted} / 갱신 ${r.pendingUpdated}` +
        `${r.skippedApproved ? `, 승인분 보호 ${r.skippedApproved}` : ''}` +
        `${r.batch ? `\n${head}   검수배치 ${r.batch} → Discord 알림의 검수 링크로 승인/폐기` : ''}`,
    );
  }

  const ok = results.filter((r) => r.ran).length;
  const pending = results.reduce(
    (n, r) => n + r.pendingInserted + r.pendingUpdated,
    0,
  );
  console.log(
    `\n[extract] 완료 — 회차 ${ok}/${results.length} 성공, pending ${pending}건 (검수 대기)`,
  );

  await app.close();
  process.exit(0);
}

run().catch((e) => {
  console.error('[extract] 스크립트 오류:', e instanceof Error ? e.message : e);
  process.exit(1);
});
