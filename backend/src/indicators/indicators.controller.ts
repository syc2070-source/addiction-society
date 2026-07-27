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
 *  POST /api/indicators/extract-kcgp        [auth] kcgp PDF 추출 수동 트리거(→pending)
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

  @UseGuards(JwtAuthGuard)
  @Post('indicators/extract-kcgp')
  extractKcgp() {
    return this.pdfService.extractKcgpYouth();
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
