import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsEnum,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import {
  DomainCode,
  PolicyAxis,
  AssessmentLabel,
  RegionCode,
} from '../../common/enums';

export class CreateDocumentDto {
  @IsString()
  @MaxLength(500)
  title: string;

  @IsString()
  @MaxLength(100)
  country: string;

  @IsOptional()
  @IsNumber()
  year?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  summary?: string;

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

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsNumber()
  year?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  summary?: string;

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

export class DocumentQueryDto {
  @IsOptional()
  @IsNumber()
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  limit?: number = 20;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsEnum(RegionCode)
  region?: RegionCode;

  @IsOptional()
  @IsNumber()
  year?: number;

  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateAssessmentCellDto {
  @IsNumber()
  documentId: number;

  @IsEnum(DomainCode)
  domain: DomainCode;

  @IsEnum(PolicyAxis)
  policyAxis: PolicyAxis;

  @IsEnum(AssessmentLabel)
  label: AssessmentLabel;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateAssessmentCellDto {
  @IsOptional()
  @IsEnum(AssessmentLabel)
  label?: AssessmentLabel;

  @IsOptional()
  @IsString()
  note?: string;
}

export class BulkAssessmentCellDto {
  @IsNumber()
  documentId: number;

  @IsArray()
  cells: {
    domain: DomainCode;
    policyAxis: PolicyAxis;
    label: AssessmentLabel;
    note?: string;
  }[];
}