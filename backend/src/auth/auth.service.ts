import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { RegisterDto, LoginDto, AuthResponseDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * 초대코드 검증 (AS-FIX-1, 감사 문제 #1).
   * env 미설정 = 가입 차단(fail-closed). 실패는 항상 같은 메시지로 응답해
   * "코드가 설정돼 있는지"를 밖에서 구분할 수 없게 한다.
   */
  private assertInvite(code: string | undefined): void {
    const expected = this.config.get<string>('ADMIN_INVITE_CODE')?.trim();
    if (!expected) {
      this.logger.warn(
        '[auth] 가입 시도 거부 — ADMIN_INVITE_CODE 미설정(가입 차단 상태)',
      );
      throw new ForbiddenException('회원가입이 허용되지 않습니다.');
    }
    if (!code || code.trim() !== expected) {
      this.logger.warn('[auth] 가입 시도 거부 — 초대코드 불일치');
      throw new ForbiddenException('회원가입이 허용되지 않습니다.');
    }
  }

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, name, inviteCode } = registerDto;

    this.assertInvite(inviteCode);

    // 이메일 중복 확인
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('이미 등록된 이메일입니다.');
    }

    // 비밀번호 해시
    const hashedPassword = await bcrypt.hash(password, 10);

    // 사용자 생성
    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      name,
    });

    await this.userRepository.save(user);

    // 토큰 생성
    const token = this.generateToken(user);

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // 사용자 찾기
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 잘못되었습니다.');
    }

    // 비밀번호 확인
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 잘못되었습니다.');
    }

    // 활성 상태 확인
    if (!user.isActive) {
      throw new UnauthorizedException('비활성화된 계정입니다.');
    }

    // 토큰 생성
    const token = this.generateToken(user);

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async validateUser(userId: number): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id: userId, isActive: true },
    });
  }

  private generateToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.sign(payload);
  }
}
