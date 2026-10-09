import { Controller, Get } from '@nestjs/common';

const startedAt = new Date().toISOString();

/**
 * 배포 확인 길 (SOC-0). Render 가 주입하는 RENDER_GIT_COMMIT 으로 지금 떠 있는
 * 커밋을 돌려준다. DB 를 보지 않고 인증·비밀 값도 없다.
 * (Render 헬스체크는 기존대로 /api/sources/summary — DB 까지 확인.)
 */
@Controller('api/health')
export class HealthController {
  @Get()
  get() {
    return {
      ok: true,
      commit: process.env.RENDER_GIT_COMMIT ?? 'local',
      startedAt,
    };
  }
}
