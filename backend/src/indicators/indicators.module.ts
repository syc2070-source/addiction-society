import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Indicator } from './entities/indicator.entity';
import { Observation } from './entities/observation.entity';
import { Source } from '../sources/entities/source.entity';
import { IndicatorsService } from './indicators.service';
import { IndicatorsController } from './indicators.controller';
import { IndicatorPdfService } from './indicator-pdf.service';
import { IndicatorsScheduler } from './indicators.scheduler';
import { SourcesModule } from '../sources/sources.module';

@Module({
  imports: [
    // Source: PDF 추출 대상을 sources에서 읽는다(AS-M3-2d)
    TypeOrmModule.forFeature([Indicator, Observation, Source]),
    // SourceEventsService(LEDGER) + SourcesNotifier(Discord) 재사용
    SourcesModule,
  ],
  controllers: [IndicatorsController],
  providers: [IndicatorsService, IndicatorPdfService, IndicatorsScheduler],
  exports: [IndicatorsService],
})
export class IndicatorsModule {}
