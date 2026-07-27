import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IndicatorsService } from './indicators.service';
import { IndicatorPdfService } from './indicator-pdf.service';
import { IndicatorQueryDto, ObservationQueryDto } from './dto/indicator.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * 지표 API. 읽기는 공개(approved만), 쓰기(추출 트리거·승인)는 인증 필요.
 *  GET  /api/indicators            목록(domain 필터)
 *  GET  /api/observations          관측치 목록(indicator·geo 필터)
 *  GET  /api/indicators/:idOrCode  상세 + 관측치 시계열
 *  GET  /api/indicators/health              [auth] 환경 자가진단(python·pdfplumber·소스 URL)
 *  POST /api/indicators/extract-pdf         [auth] PDF 추출 트리거({source?}) → pending
 *  POST /api/indicators/observations/approve [auth] pending → approved(검수 승인)
 */
@Controller('api')
export class IndicatorsController {
  constructor(
    private readonly indicatorsService: IndicatorsService,
    private readonly pdfService: IndicatorPdfService,
  ) {}

  @Get('indicators')
  findAll(@Query() query: IndicatorQueryDto) {
    return this.indicatorsService.findAll(query);
  }

  @Get('observations')
  findObservations(@Query() query: ObservationQueryDto) {
    return this.indicatorsService.findObservations(query);
  }

  /**
   * 환경 자가진단(AS-M3-2c) — Render 셸 실측을 대체한다.
   * python·pdfplumber 존재 여부 + gov(kcgp/data.go.kr) fetch 가능 여부를 JSON으로.
   * 구체적 경로라 indicators/:idOrCode 보다 먼저 등록해야 한다.
   */
  @UseGuards(JwtAuthGuard)
  @Get('indicators/health')
  health() {
    return this.pdfService.health();
  }

  /**
   * PDF 추출 수동 트리거. 대상은 sources.access_detail.pdf=true (AS-M3-2d).
   * body.source 지정 시 그 소스만, 없으면 전부.
   */
  @UseGuards(JwtAuthGuard)
  @Post('indicators/extract-pdf')
  extractPdf(@Body() body: { source?: string }) {
    const id = body?.source?.trim();
    return id ? this.pdfService.extractOne(id) : this.pdfService.extractAll();
  }

  @UseGuards(JwtAuthGuard)
  @Post('indicators/observations/approve')
  approve(@Body() body: { code?: string }) {
    return this.indicatorsService.approvePending(body?.code);
  }

  @Get('indicators/:idOrCode')
  findOne(@Param('idOrCode') idOrCode: string) {
    return this.indicatorsService.findOne(idOrCode);
  }
}
