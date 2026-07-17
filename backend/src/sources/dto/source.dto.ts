import { IsOptional, IsString } from 'class-validator';

/**
 * 소스 목록 조회 쿼리 DTO (읽기 전용).
 * 모든 필터는 선택값. class-validator + 전역 ValidationPipe(whitelist)로 검증한다.
 */
export class SourceQueryDto {
  /** 도메인 정확일치 (alcohol|drug|gambling|digital|tobacco|policy|multi) */
  @IsOptional()
  @IsString()
  domain?: string;

  /**
   * 범위 필터.
   * 'korea' → 한국 소스만, 'intl' → 한국 제외(국제+지역),
   * 그 외 값(global|regional)은 정확일치.
   */
  @IsOptional()
  @IsString()
  scope?: string;

  /** 발간 주기 정확일치 */
  @IsOptional()
  @IsString()
  cadence?: string;

  /** 상태 정확일치 (active|stale|dead) */
  @IsOptional()
  @IsString()
  status?: string;

  /** titleKo / org / orgKo 부분일치 검색 */
  @IsOptional()
  @IsString()
  search?: string;
}
