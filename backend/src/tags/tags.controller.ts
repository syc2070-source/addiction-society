import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { TagsService } from './tags.service';
import { TagType } from '../common/enums';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  findAll() {
    return this.tagsService.findAll();
  }

  @Get('grouped')
  getGroupedTags() {
    return this.tagsService.getGroupedTags();
  }

  @Get('type/:type')
  findByType(@Param('type') type: TagType) {
    return this.tagsService.findByType(type);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tagsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() data: { name: string; type: TagType; description?: string }) {
    return this.tagsService.create(data);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { name?: string; description?: string },
  ) {
    return this.tagsService.update(id, data);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tagsService.remove(id);
  }
}