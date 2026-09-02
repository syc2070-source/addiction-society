import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { UserRole } from '../common/enums';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';

describe('public registration security boundary', () => {
  let app: INestApplication;
  let authService: AuthService;

  const userRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };
  const jwtService = {
    sign: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
      ],
    }).compile();

    authService = moduleFixture.get(AuthService);
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects POST /api/auth/register with 403', async () => {
    await request(app.getHttpServer()).post('/api/auth/register').expect(403);
  });

  it('rejects an attempted admin registration with 403', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'attacker@example.com',
        password: 'irrelevant-password',
        name: 'Attacker',
        role: 'admin',
      })
      .expect(403);
  });

  it('does not create, save, or sign anything in AuthService.register', () => {
    expect(() => authService.register()).toThrow(
      '공개 회원가입은 허용되지 않습니다.',
    );
    expect(userRepository.create).not.toHaveBeenCalled();
    expect(userRepository.save).not.toHaveBeenCalled();
    expect(jwtService.sign).not.toHaveBeenCalled();
  });

  it('keeps login available for an existing active administrator', async () => {
    const password = 'test-only-login-password';
    userRepository.findOne.mockResolvedValue({
      id: 1,
      email: 'administrator@example.invalid',
      password: await bcrypt.hash(password, 4),
      name: 'Administrator',
      role: UserRole.ADMIN,
      isActive: true,
    });
    jwtService.sign.mockReturnValue('test-only-access-token');

    await expect(
      authService.login({
        email: 'administrator@example.invalid',
        password,
      }),
    ).resolves.toEqual({
      accessToken: 'test-only-access-token',
      user: {
        id: 1,
        email: 'administrator@example.invalid',
        name: 'Administrator',
        role: UserRole.ADMIN,
      },
    });
  });
});
