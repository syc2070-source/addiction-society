import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './entities/document.entity';
import { AssessmentCell } from './entities/assessment-cell.entity';
import { Tag } from '../tags/entities/tag.entity';
import { PolicyService } from './policy.service';
import { PolicyController } from './policy.controller';
import { GptAnalysisService } from './gpt-analysis.service';

@Module({
  imports: [TypeOrmModule.forFeature([Document, AssessmentCell, Tag])],
  controllers: [PolicyController],
  providers: [PolicyService, GptAnalysisService],
  exports: [PolicyService],
})
export class PolicyModule {}
