import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Indicator } from './entities/indicator.entity';
import { Observation } from './entities/observation.entity';
import { IndicatorsService } from './indicators.service';
import { IndicatorsController } from './indicators.controller';
import { IndicatorPdfService } from './indicator-pdf.service';
import { IndicatorsScheduler } from './indicators.scheduler';
import { SourcesModule } from '../sources/sources.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Indicator, Observation]),
    // SourceEventsService(LEDGER) + SourcesNotifier(Discord) 재사용
    SourcesModule,
  ],
  controllers: [IndicatorsController],
  providers: [IndicatorsService, IndicatorPdfService, IndicatorsScheduler],
  exports: [IndicatorsService],
})
export class IndicatorsModule {}
