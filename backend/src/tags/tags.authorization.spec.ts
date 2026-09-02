import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { AuthService } from '../auth/auth.service';
import { User } from '../auth/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtStrategy } from '../auth/jwt.strategy';
import { TagType, UserRole } from '../common/enums';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

describe('TagsController write authorization', () => {
  const jwtSecret = 'test-only-tags-authorization-secret';
  const tagInput = {
    name: '보안 테스트 태그',
    type: TagType.TOPIC,
    description: '외부 DB 없이 권한 경계를 검증합니다.',
  };
  const createdTag = { id: 101, ...tagInput };

  let app: INestApplication;
  let jwtService: JwtService;

  const userRepository = {
    findOne: jest.fn(),
  };
  const tagsService = {
    create: jest.fn(),
    findAll: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: jwtSecret }),
      ],
      controllers: [TagsController],
      providers: [
        AuthService,
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'JWT_SECRET' ? jwtSecret : undefined,
            ),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
        {
          provide: TagsService,
          useValue: tagsService,
        },
      ],
    }).compile();

    jwtService = moduleFixture.get(JwtService);
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    userRepository.findOne.mockReset();
    tagsService.create.mockReset().mockResolvedValue(createdTag);
    tagsService.findAll.mockReset().mockResolvedValue([]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 401 without a bearer token', async () => {
    await request(app.getHttpServer())
      .post('/api/tags')
      .send(tagInput)
      .expect(401);

    expect(tagsService.create).not.toHaveBeenCalled();
  });

  it('returns 401 when the token user no longer exists', async () => {
    userRepository.findOne.mockResolvedValue(null);
    const token = jwtService.sign({
      sub: 404,
      email: 'deleted-user@example.invalid',
      role: UserRole.ADMIN,
    });

    await request(app.getHttpServer())
      .post('/api/tags')
      .set('Authorization', `Bearer ${token}`)
      .send(tagInput)
      .expect(401);

    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { id: 404, isActive: true },
    });
    expect(tagsService.create).not.toHaveBeenCalled();
  });

  it('keeps a public GET without role metadata accessible', async () => {
    await request(app.getHttpServer()).get('/api/tags').expect(200).expect([]);

    expect(userRepository.findOne).not.toHaveBeenCalled();
    expect(tagsService.findAll).toHaveBeenCalledTimes(1);
  });

  it.each([UserRole.USER, UserRole.VIEWER])(
    'returns 403 when the current DB role is %s even if the token claims admin',
    async (role) => {
      userRepository.findOne.mockResolvedValue({
        id: 1,
        email: `${role}@example.com`,
        name: 'Non-admin',
        role,
        isActive: true,
      });
      const token = jwtService.sign({
        sub: 1,
        email: `${role}@example.com`,
        role: UserRole.ADMIN,
      });

      await request(app.getHttpServer())
        .post('/api/tags')
        .set('Authorization', `Bearer ${token}`)
        .send(tagInput)
        .expect(403);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1, isActive: true },
      });
      expect(tagsService.create).not.toHaveBeenCalled();
    },
  );

  it('returns 201 and calls the service when the current DB user is an admin', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 2,
      email: 'admin@example.com',
      name: 'Admin',
      role: UserRole.ADMIN,
      isActive: true,
    });
    const token = jwtService.sign({
      sub: 2,
      email: 'admin@example.com',
      role: UserRole.ADMIN,
    });

    await request(app.getHttpServer())
      .post('/api/tags')
      .set('Authorization', `Bearer ${token}`)
      .send(tagInput)
      .expect(201)
      .expect(createdTag);

    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { id: 2, isActive: true },
    });
    expect(tagsService.create).toHaveBeenCalledTimes(1);
    expect(tagsService.create).toHaveBeenCalledWith(tagInput);
  });
});
