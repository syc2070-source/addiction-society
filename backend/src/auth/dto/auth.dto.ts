import { IsEmail, IsString } from 'class-validator';
import { UserRole } from '../../common/enums';

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
    role: UserRole;
  };
}
