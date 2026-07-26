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
import { ResearchService } from './research.service';
import {
  CreateResearchDto,
  UpdateResearchDto,
  ResearchQueryDto,
} from './dto/research.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/research')
export class ResearchController {
  constructor(private readonly researchService: ResearchService) {}

  @Get()
  findAll(@Query() query: ResearchQueryDto) {
    return this.researchService.findAll(query);
  }

  @Get('featured')
  findFeatured() {
    return this.researchService.findFeatured();
  }

  @Get('stats')
  getStats() {
    return this.researchService.getStats();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.researchService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createDto: CreateResearchDto) {
    return this.researchService.create(createDto);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateResearchDto,
  ) {
    return this.researchService.update(id, updateDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.researchService.remove(id);
  }
}
