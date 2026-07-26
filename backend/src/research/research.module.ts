import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Research } from './entities/research.entity';
import { Tag } from '../tags/entities/tag.entity';
import { ResearchService } from './research.service';
import { ResearchController } from './research.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Research, Tag])],
  controllers: [ResearchController],
  providers: [ResearchService],
  exports: [ResearchService],
})
export class ResearchModule {}
