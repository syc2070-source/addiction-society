import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Research } from './entities/research.entity';
import { Tag } from '../tags/entities/tag.entity';
import { ResearchService } from './research.service';
import { ResearchController } from './research.controller';
import { ResearchAutoService } from './research-auto.service';

@Module({
  imports: [TypeOrmModule.forFeature([Research, Tag])],
  controllers: [ResearchController],
  providers: [ResearchService, ResearchAutoService],
  exports: [ResearchService, ResearchAutoService],
})
export class ResearchModule {}