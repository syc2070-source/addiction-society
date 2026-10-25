import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../common/enums';
import { ecoInboxEnabled } from './eco-inbox';
import {
  EcoInboxService,
  EcoQueueQueryDto,
  ReviewEcoDto,
} from './eco-inbox.service';

/**
 * 받은 것 검수 창 API (SOC-R15 ■1 · ■4). 관리자 JWT 필수 — research 검수 창과 같은 틀.
 * 스위치가 꺼져 있어도 열린다(표가 비어 있을 뿐) — 켜기 전 화면 확인용.
 */
@Roles(UserRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/admin/eco')
export class EcoInboxReviewController {
  constructor(private readonly inbox: EcoInboxService) {}

  @Get('review')
  queue(@Query() query: EcoQueueQueryDto) {
    return this.inbox.queue(query.tab ?? 'pending', query.before);
  }

  @Put(':id/review')
  review(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReviewEcoDto,
    @Request() req: { user: { id: number; email?: string } },
  ) {
    const reviewer = req.user.email || `user#${req.user.id}`;
    return this.inbox.review(id, body.decision, reviewer);
  }
}

/**
 * 손님 응답 (SOC-R15 ■4) — 스위치가 꺼져 있으면 404(문이 없는 것과 같음 · 중독뉴스 export v0 와 같은 읽기).
 * 켜져 있으면 keep ∧ public 만 · 검수 칸 · 「이전 판 승인」 표식 0(C1).
 */
@Controller('api/evidence')
export class EcoInboxPublicController {
  constructor(private readonly inbox: EcoInboxService) {}

  @Get('received')
  received() {
    if (!ecoInboxEnabled()) throw new NotFoundException();
    return this.inbox.guest();
  }
}
