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
import { RecoveryService } from './recovery.service';
import {
  CreateRecoveryResourceDto,
  UpdateRecoveryResourceDto,
  RecoveryResourceQueryDto,
} from './dto/recovery.dto';
import { Roles } from '../auth/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../common/enums';

@Controller('api/recovery')
export class RecoveryController {
  constructor(private readonly recoveryService: RecoveryService) {}

  @Get('resources')
  findAll(@Query() query: RecoveryResourceQueryDto) {
    return this.recoveryService.findAll(query);
  }

  @Get('resources/stats')
  getStats() {
    return this.recoveryService.getStats();
  }

  @Get('resources/cities')
  getCities() {
    return this.recoveryService.getCities();
  }

  @Get('resources/city/:city')
  findByCity(@Param('city') city: string) {
    return this.recoveryService.findByCity(city);
  }

  @Get('resources/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.recoveryService.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('resources')
  create(@Body() createDto: CreateRecoveryResourceDto) {
    return this.recoveryService.create(createDto);
  }

  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Put('resources/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateRecoveryResourceDto,
  ) {
    return this.recoveryService.update(id, updateDto);
  }

  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete('resources/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.recoveryService.remove(id);
  }
}
