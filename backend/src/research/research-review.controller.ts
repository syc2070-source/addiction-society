import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ResearchService } from './research.service';
import { ReviewQueueQueryDto, ReviewResearchDto } from './dto/research.dto';
import { Roles } from '../auth/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../common/enums';

/**
 * 연구자료 검수 창 API (SOC-R1). 관리자 JWT 필수 — 토큰 없음 401, 비관리자 403.
 *
 * 관문(relevance.ts)에 걸려 공개에서 숨은 승인분을 오너가 건별로
 * 살리거나(keep) 숨긴다(hide). status 칸은 건드리지 않는다.
 */
@Roles(UserRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/admin/research')
export class ResearchReviewController {
  constructor(private readonly researchService: ResearchService) {}

  @Get('review')
  queue(@Query() query: ReviewQueueQueryDto) {
    return this.researchService.findReviewQueue(query.tab ?? 'pending');
  }

  @Put(':id/review')
  review(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReviewResearchDto,
    @Request() req: { user: { id: number; email?: string } },
  ) {
    const reviewer = req.user.email || `user#${req.user.id}`;
    return this.researchService.review(id, body.decision, reviewer);
  }
}
