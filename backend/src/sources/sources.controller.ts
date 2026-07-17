import { Controller, Get, Param, Query } from '@nestjs/common';
import { SourcesService } from './sources.service';
import { SourceQueryDto } from './dto/source.dto';

/**
 * 소스 레지스트리 API (공개, 읽기 전용).
 * 라우트 순서 주의: /calendar 가 /:id 보다 먼저 선언돼야 :id로 잡히지 않는다.
 */
@Controller('api/sources')
export class SourcesController {
  constructor(private readonly sourcesService: SourcesService) {}

  /** 목록 (필터: domain, scope, cadence, status, search) */
  @Get()
  findAll(@Query() query: SourceQueryDto) {
    return this.sourcesService.findAll(query);
  }

  /** 발간 캘린더 (nextExpectedAt 임박순) */
  @Get('calendar')
  findCalendar() {
    return this.sourcesService.findCalendar();
  }

  /** 히어로 카드 요약 (:id 보다 먼저 선언) */
  @Get('summary')
  getSummary() {
    return this.sourcesService.getSummary();
  }

  /** 단건 상세 */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sourcesService.findOne(id);
  }
}
