import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(20)
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  /**
   * 초대코드 (AS-FIX-1). env ADMIN_INVITE_CODE와 일치해야 가입된다.
   * env가 비어 있으면 값과 무관하게 가입이 차단된다(fail-closed).
   */
  @IsString()
  inviteCode: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class AuthResponseDto {
  accessToken: string;
  user: {
    id: number;
    email: string;
    name: string;
    role: string;
  };
}
