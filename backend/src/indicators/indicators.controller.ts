import { Controller, Get, Param, Query } from '@nestjs/common';
import { IndicatorsService } from './indicators.service';
import { IndicatorQueryDto, ObservationQueryDto } from './dto/indicator.dto';

/**
 * 지표 API (읽기 전용 공개).
 *  - GET /api/indicators           목록(domain 필터)
 *  - GET /api/indicators/:idOrCode 상세 + 관측치 시계열
 *  - GET /api/observations         관측치 목록(indicator·geo 필터)
 * 쓰기(등록·수집)는 collect:indicators 스크립트(멱등 upsert)로만 한다.
 */
@Controller('api')
export class IndicatorsController {
  constructor(private readonly indicatorsService: IndicatorsService) {}

  @Get('indicators')
  findAll(@Query() query: IndicatorQueryDto) {
    return this.indicatorsService.findAll(query);
  }

  @Get('observations')
  findObservations(@Query() query: ObservationQueryDto) {
    return this.indicatorsService.findObservations(query);
  }

  @Get('indicators/:idOrCode')
  findOne(@Param('idOrCode') idOrCode: string) {
    return this.indicatorsService.findOne(idOrCode);
  }
}
