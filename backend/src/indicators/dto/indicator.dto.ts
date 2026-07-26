import { IsOptional, IsString } from 'class-validator';

/** 지표 목록 질의. domain 필터(선택). */
export class IndicatorQueryDto {
  @IsOptional()
  @IsString()
  domain?: string;
}

/** 관측치 목록 질의. 지표/지역 필터(선택). */
export class ObservationQueryDto {
  @IsOptional()
  @IsString()
  indicator?: string; // indicator code 또는 id

  @IsOptional()
  @IsString()
  geo?: string;
}
