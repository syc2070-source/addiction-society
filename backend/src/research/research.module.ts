import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Research } from './entities/research.entity';
import { Tag } from '../tags/entities/tag.entity';
import { ResearchService } from './research.service';
import { ResearchController } from './research.controller';
import { ResearchReviewController } from './research-review.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Research, Tag])],
  controllers: [ResearchController, ResearchReviewController],
  providers: [ResearchService],
  exports: [ResearchService],
})
export class ResearchModule {}
