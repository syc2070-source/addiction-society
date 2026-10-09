import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ResearchService } from './research.service';
import {
  CreateResearchDto,
  UpdateResearchDto,
  ResearchQueryDto,
} from './dto/research.dto';
import { Roles } from '../auth/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../common/enums';

@Controller('api/research')
export class ResearchController {
  constructor(private readonly researchService: ResearchService) {}

  /**
   * 목록·검색. 공개 조회는 항상 approved만 (AS-FIX-1, 감사 문제 #6).
   *
   * 이전에는 ?status=all 을 누구나 붙일 수 있어 미검수 자료가 그대로 노출됐다
   * (원칙 8 우회). 이제 status 파라미터는 admin 토큰이 있을 때만 적용되고,
   * 비인증·비관리자 요청에서는 조용히 무시된다(에러 대신 approved 강제 —
   * 공개 API가 인증 여부에 따라 에러를 뱉으면 캐시·크롤러가 깨진다).
   * SOC-0: 공개 길에는 관련성 관문(relevance.ts)도 건다. 관리자 길은 그대로.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  findAll(
    @Query() query: ResearchQueryDto,
    @Request() req: { user?: { role?: UserRole } },
  ) {
    const isAdmin = req.user?.role === UserRole.ADMIN;
    if (isAdmin) return this.researchService.findAll(query);
    return this.researchService.findPublic({ ...query, status: 'approved' });
  }

  @Get('featured')
  findFeatured() {
    return this.researchService.findFeatured();
  }

  @Get('stats')
  getStats() {
    return this.researchService.getStats();
  }

  /** 단건. 공개 조회는 승인 + 관문 통과만, 아니면 404 (SOC-0). */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user?: { role?: UserRole } },
  ) {
    const isAdmin = req.user?.role === UserRole.ADMIN;
    if (isAdmin) return this.researchService.findOne(id);
    return this.researchService.findPublicOne(id);
  }

  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  create(@Body() createDto: CreateResearchDto) {
    return this.researchService.create(createDto);
  }

  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateResearchDto,
  ) {
    return this.researchService.update(id, updateDto);
  }

  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.researchService.remove(id);
  }
}
