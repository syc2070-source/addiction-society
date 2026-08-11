import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 회원가입 — 초대코드 필수 (AS-FIX-1, 감사 문제 #1).
   *
   * 감사 이전에는 아무 제한이 없었고 users.role 기본값이 'admin'이라
   * 누구나 가입 한 번으로 쓰기·승인 권한을 얻었다(실기동으로 재현됨).
   *
   * 완전 비활성 대신 초대코드로 막은 이유: DB를 새로 세웠을 때 첫 관리자를
   * 만들 다른 경로가 없다(users 시드 없음). 초대코드는 구멍을 닫으면서
   * 복구 경로를 남긴다. ADMIN_INVITE_CODE가 비어 있으면 가입은 완전히
   * 차단된다(fail-closed) — 잊고 배포해도 열리지 않는다.
   */
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Request() req) {
    return req.user;
  }
}
