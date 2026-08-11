import { Controller, Get, Post, Param, Body, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { IndicatorsService } from './indicators.service';
import { SourceEventsService } from '../sources/source-events.service';
import { SourcesNotifier } from '../sources/discord.notifier';
import { verifyReviewToken } from './review-token.util';
import { reviewSecret } from './review-secret.util';

/**
 * Discord 검수 페이지 (AS-PDF-RUN) — 관리자 로그인 없이 검수를 끝내기 위한 경로.
 *
 *   GET  /api/indicators/review/:token   확인 화면(읽기 전용). 추출값 표 + 버튼.
 *   POST /api/indicators/review/:token   실제 승인/폐기 처리 후 결과 화면.
 *
 * ⚠️ GET이 상태를 바꾸지 않는 것이 핵심이다. Discord는 링크 미리보기를 위해
 *    URL을 자동으로 GET 한다 — GET에서 승인해 버리면 사람이 보기도 전에
 *    자동 승인되는 사고가 난다. 그래서 GET은 화면만, 처리는 POST에서.
 *
 * 토큰의 권한 범위·서명·만료 근거는 review-token.util.ts 주석 참조(원칙 12 관계 포함).
 * 이 컨트롤러는 의도적으로 JwtAuthGuard를 걸지 않는다 — 서명 토큰 자체가 인가다.
 */
@Controller('api/indicators/review')
export class IndicatorReviewController {
  constructor(
    private readonly config: ConfigService,
    private readonly indicators: IndicatorsService,
    private readonly events: SourceEventsService,
    private readonly notifier: SourcesNotifier,
  ) {}

  private secret(): string {
    return reviewSecret(this.config);
  }

  @Get(':token')
  async page(@Param('token') token: string, @Res() res: Response) {
    const v = verifyReviewToken(token, this.secret());
    if (!v.ok) {
      return this.html(res, 400, '검수 링크를 쓸 수 없습니다', [
        `<p class="bad">${esc(v.reason)}</p>`,
        '<p>만료된 링크라면 다음 추출 알림의 새 링크를 사용하십시오.</p>',
      ]);
    }

    const rows = await this.indicators.pendingByBatch(v.batch);
    const pending = rows.filter((r) => r.status === 'pending');

    if (rows.length === 0) {
      return this.html(res, 404, '검수 대상이 없습니다', [
        `<p>배치 <code>${esc(v.batch)}</code>에 해당하는 관측치를 찾지 못했습니다.</p>`,
      ]);
    }
    if (pending.length === 0) {
      const done = rows[0].status;
      return this.html(res, 200, '이미 처리된 배치입니다', [
        `<p>배치 <code>${esc(v.batch)}</code>는 이미 <b>${done === 'approved' ? '승인' : '폐기'}</b>되었습니다.</p>`,
        this.table(rows),
      ]);
    }

    return this.html(res, 200, 'PDF 추출값 검수', [
      `<p>아래 <b>${pending.length}건</b>은 PDF 표에서 기계로 읽은 값입니다.
        <b>원본과 대조한 뒤</b> 승인하십시오. 승인 전에는 공개되지 않습니다.</p>`,
      this.table(pending),
      `<form method="post" action="/api/indicators/review/${encodeURIComponent(token)}">
         <button name="action" value="approve" class="ok">승인하고 공개</button>
         <button name="action" value="reject" class="bad">폐기(비공개 유지)</button>
       </form>`,
      '<p class="muted">폐기해도 값은 삭제되지 않고 비공개로 남습니다 — 파서 수정의 근거가 됩니다.</p>',
    ]);
  }

  @Post(':token')
  async submit(
    @Param('token') token: string,
    @Body() body: { action?: string },
    @Res() res: Response,
  ) {
    const v = verifyReviewToken(token, this.secret());
    if (!v.ok) {
      return this.html(res, 400, '검수 링크를 쓸 수 없습니다', [
        `<p class="bad">${esc(v.reason)}</p>`,
      ]);
    }
    const action = body?.action === 'reject' ? 'reject' : 'approve';

    const before = await this.indicators.pendingByBatch(v.batch);
    const { affected } = await this.indicators.reviewBatch(v.batch, action);

    // 원장에 남긴다(원칙 11) — 언제 누가(어느 배치를) 승인/폐기했는지.
    const sourceId = v.batch.split(':')[0] || 'unknown';
    await this.events.record({
      sourceId,
      eventType: action === 'approve' ? 'approved' : 'rejected',
      detail: { batch: v.batch, affected, via: 'discord-review-link' },
      notified: true,
    });

    // Discord 회신 — 알림에서 시작해 알림으로 끝난다.
    await this.notifier.notifyText(
      [
        action === 'approve'
          ? `✅ 지표 검수 승인 — ${affected}건 공개`
          : `🗑️ 지표 검수 폐기 — ${affected}건 비공개 유지`,
        `배치: ${v.batch}`,
        affected === 0 ? '(이미 처리된 배치였습니다)' : '',
      ]
        .filter(Boolean)
        .join('\n'),
      `review:${sourceId}`,
    );

    return this.html(
      res,
      200,
      action === 'approve' ? '승인 완료' : '폐기 완료',
      [
        `<p class="${action === 'approve' ? 'ok' : 'bad'}">
           ${affected}건을 ${action === 'approve' ? '승인했습니다. 이제 공개됩니다.' : '폐기했습니다. 공개되지 않습니다.'}
         </p>`,
        affected === 0
          ? '<p class="muted">이미 처리된 배치입니다(링크 재사용).</p>'
          : '',
        this.table(before),
      ].filter(Boolean),
    );
  }

  /** 값 표 — 지표명/기간/분류/값/단서/원본. 사람이 원본과 대조하는 용도. */
  private table(
    rows: Awaited<ReturnType<IndicatorsService['pendingByBatch']>>,
  ) {
    const body = rows
      .map(
        (r) => `<tr>
          <td>${esc(r.nameKo)}<br><span class="muted">${esc(r.code)}</span></td>
          <td>${esc(r.period)}</td>
          <td>${esc(r.qualifier === 'total' ? '전체' : r.qualifier.replace(/^group=/, ''))}</td>
          <td class="num"><b>${esc(r.value)}</b>${r.unit ? ` ${esc(r.unit)}` : ''}</td>
          <td class="muted">${esc(r.note ?? '')}</td>
          <td><a href="${esc(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">원본</a></td>
        </tr>`,
      )
      .join('');
    return `<table>
      <thead><tr><th>지표</th><th>기간</th><th>분류</th><th>값</th><th>단서</th><th>출처</th></tr></thead>
      <tbody>${body}</tbody></table>`;
  }

  /** 의존성 없는 최소 HTML. 별도 템플릿 엔진을 들이지 않는다. */
  private html(res: Response, status: number, title: string, parts: string[]) {
    res.status(status).type('html')
      .send(`<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(title)} · 중독사회</title>
<style>
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#fbf9f4;color:#28323a;
       line-height:1.7;margin:0;padding:24px}
  main{max-width:800px;margin:0 auto;background:#fff;border:1px solid #e2ddd1;border-radius:10px;padding:24px}
  h1{font-size:1.5rem;font-weight:500;line-height:1.35;margin:0 0 16px}
  table{width:100%;border-collapse:collapse;font-size:.875rem;margin:16px 0}
  th{text-align:left;background:#f5f1e8;font-weight:500;font-size:.8125rem;color:#575349}
  th,td{padding:8px;border-bottom:1px solid #e2ddd1;vertical-align:top}
  .num{white-space:nowrap}
  .muted{color:#575349;font-size:.8125rem}
  .ok{color:#2f6b46}.bad{color:#a33a3a}
  button{font:inherit;padding:8px 16px;margin-right:8px;border-radius:6px;border:1px solid #e2ddd1;
         background:#fff;cursor:pointer}
  button.ok{border-color:#2f6b46}button.bad{border-color:#a33a3a}
  a{color:#3f6480}
</style></head><body><main>
<h1>${esc(title)}</h1>
${parts.join('\n')}
<p class="muted">중독사회 데이터 관측소 · 이 페이지는 검색에 노출되지 않습니다.</p>
</main></body></html>`);
  }
}

/** HTML 이스케이프 — 값·지표명이 그대로 들어가므로 필수. */
function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
