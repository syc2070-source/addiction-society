import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EcoInboxItem } from './entities/eco-inbox.entity';
import {
  EcoInboxPublicController,
  EcoInboxReviewController,
} from './eco-inbox.controller';
import { EcoInboxService } from './eco-inbox.service';

/** ECO-LINK1 받는 문 (SOC-R15 ■4) — 받는 표 · 검수 · 손님 응답(스위치 꺼짐 = 404) */
@Module({
  imports: [TypeOrmModule.forFeature([EcoInboxItem])],
  controllers: [EcoInboxReviewController, EcoInboxPublicController],
  providers: [EcoInboxService],
})
export class EvidenceModule {}
