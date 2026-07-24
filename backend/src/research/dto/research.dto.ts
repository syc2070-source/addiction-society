import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsEnum,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { DomainCode, RegionCode } from '../../common/enums';

export class CreateResearchDto {
  @IsString()
  @MaxLength(500)
  title: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  authors?: string[];

  @IsOptional()
  @IsNumber()
  year?: number;

  @IsOptional()
  @IsString()
  abstract?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsArray()
  @IsEnum(DomainCode, { each: true })
  domains?: DomainCode[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  pdfUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  source?: string;

  @IsOptional()
  @IsEnum(RegionCode)
  region?: RegionCode;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  tagIds?: number[];
}

export class UpdateResearchDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  authors?: string[];

  @IsOptional()
  @IsNumber()
  year?: number;

  @IsOptional()
  @IsString()
  abstract?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsArray()
  @IsEnum(DomainCode, { each: true })
  domains?: DomainCode[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  pdfUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  source?: string;

  @IsOptional()
  @IsEnum(RegionCode)
  region?: RegionCode;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  tagIds?: number[];
}

export class ResearchQueryDto {
  @IsOptional()
  @IsNumber()
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  limit?: number = 20;

  @IsOptional()
  @IsEnum(DomainCode)
  domain?: DomainCode;

  @IsOptional()
  @IsEnum(RegionCode)
  region?: RegionCode;

  @IsOptional()
  @IsNumber()
  year?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  /**
   * 검토 상태 필터. 미지정 시 공개 기본값 'approved'만 반환한다(원칙 8).
   * 'all'을 명시하면 상태 무관 전체 반환(운영 점검용).
   */
  @IsOptional()
  @IsString()
  status?: string;
}
