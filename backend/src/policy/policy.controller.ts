import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { PolicyService } from './policy.service';
import { GptAnalysisService } from './gpt-analysis.service';
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  DocumentQueryDto,
  CreateAssessmentCellDto,
  UpdateAssessmentCellDto,
  BulkAssessmentCellDto,
} from './dto/policy.dto';
import { Roles } from '../auth/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../common/enums';

@Controller('api/policy')
export class PolicyController {
  constructor(
    private readonly policyService: PolicyService,
    private readonly gptService: GptAnalysisService,
  ) {}

  @Get('documents')
  findAllDocuments(@Query() query: DocumentQueryDto) {
    return this.policyService.findAllDocuments(query);
  }

  @Get('documents/stats')
  getDocumentStats() {
    return this.policyService.getDocumentStats();
  }

  // 구체적 경로를 documents/:id 보다 먼저 등록
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('documents/:id/analyze')
  async analyzeDocument(@Param('id', ParseIntPipe) id: number) {
    const document = await this.policyService.findOneDocumentWithoutView(id);

    const analysis = await this.gptService.analyzePolicy({
      title: document.title,
      summary: document.summary,
      description: document.description,
      country: document.country,
      year: document.year,
    });

    if (analysis.cells.length > 0) {
      await this.policyService.bulkUpdateCells({
        documentId: id,
        cells: analysis.cells,
      });
    }

    return {
      success: true,
      summary: analysis.summary,
      cellCount: analysis.cells.length,
    };
  }

  @Get('documents/:id')
  findOneDocument(@Param('id', ParseIntPipe) id: number) {
    return this.policyService.findOneDocument(id);
  }

  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('documents')
  createDocument(@Body() createDto: CreateDocumentDto) {
    return this.policyService.createDocument(createDto);
  }

  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Put('documents/:id')
  updateDocument(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateDocumentDto,
  ) {
    return this.policyService.updateDocument(id, updateDto);
  }

  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete('documents/:id')
  removeDocument(@Param('id', ParseIntPipe) id: number) {
    return this.policyService.removeDocument(id);
  }

  @Get('matrix/:documentId')
  getMatrix(@Param('documentId', ParseIntPipe) documentId: number) {
    return this.policyService.getMatrix(documentId);
  }

  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('matrix/cells')
  createCell(@Body() createDto: CreateAssessmentCellDto) {
    return this.policyService.createCell(createDto);
  }

  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Put('matrix/cells/:id')
  updateCell(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateAssessmentCellDto,
  ) {
    return this.policyService.updateCell(id, updateDto);
  }

  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('matrix/bulk')
  bulkUpdateCells(@Body() bulkDto: BulkAssessmentCellDto) {
    return this.policyService.bulkUpdateCells(bulkDto);
  }

  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete('matrix/cells/:id')
  deleteCell(@Param('id', ParseIntPipe) id: number) {
    return this.policyService.deleteCell(id);
  }
}
