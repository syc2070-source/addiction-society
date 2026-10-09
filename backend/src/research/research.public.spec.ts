import { INestApplication, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { AuthService } from '../auth/auth.service';
import { User } from '../auth/entities/user.entity';
import { JwtStrategy } from '../auth/jwt.strategy';
import { UserRole } from '../common/enums';
import { Tag } from '../tags/entities/tag.entity';
import { HealthController } from '../health.controller';
import { Research } from './entities/research.entity';
import { collectedStatus, isAddictionRelevant } from './relevance';
import { ResearchController } from './research.controller';
import { ResearchService } from './research.service';

// 운영 실측(2026-10-09) 제목·초록 발췌 — 외부 DB 없이 공개 경계를 검증한다.
const relevantRows = [
  {
    title: 'Cell-Phone Addiction: A Review',
    abstract: 'We review evidence on problematic phone use.',
    keywords: ['work addiction workaholism'],
  },
  {
    title: '청소년 도박 문제의 위험 요인',
    abstract: null,
    keywords: ['gambling disorder'],
  },
  {
    title: 'Short-Term Effects of Nose-Only Cigarette Smoke Exposure',
    abstract:
      'Mainstream smoke contains nicotine. Smoking and tobacco exposure were modelled.',
    keywords: ['alcohol use disorder treatment'],
  },
];

const irrelevantRows = [
  {
    title: 'The Positive and Negative Syndrome Scale (PANSS) for Schizophrenia',
    abstract:
      'Patients were rated drug-free and again after drug treatment with the scale.',
    keywords: ['alcohol use disorder treatment'],
  },
  {
    title:
      'QUANTUM ESPRESSO: a modular and open-source software project for quantum simulations of materials',
    abstract:
      'An integrated suite of codes for electronic-structure calculations.',
    keywords: ['problematic internet use'],
  },
  {
    title: 'A Critical Review of the Job Demands-Resources Model',
    abstract:
      'Job resources and work engagement; anticoagulant drugs are not covered.',
    keywords: ['work addiction workaholism'],
  },
];

describe('research relevance gate', () => {
  it.each(relevantRows)('passes: $title', (row) => {
    expect(isAddictionRelevant(row)).toBe(true);
    expect(collectedStatus(row)).toBe('approved');
  });

  it.each(irrelevantRows)('fails: $title', (row) => {
    expect(isAddictionRelevant(row)).toBe(false);
    expect(collectedStatus(row)).toBe('pending');
  });

  it('counts curated (non-collector) keywords', () => {
    expect(
      isAddictionRelevant({ title: 'Cohort study', keywords: ['음주'] }),
    ).toBe(true);
  });
});

describe('ResearchService public paths', () => {
  const rows = [
    { id: 1, status: 'approved', ...relevantRows[0] },
    { id: 2, status: 'approved', ...irrelevantRows[0] },
    { id: 3, status: 'approved', ...relevantRows[1] },
    { id: 4, status: 'approved', ...irrelevantRows[1] },
  ] as unknown as Research[];

  const qb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };
  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    findOne: jest.fn(),
    find: jest.fn(),
    increment: jest.fn(),
  };
  const service = new ResearchService(repo as never, {} as never);

  beforeEach(() => {
    jest.clearAllMocks();
    qb.getManyAndCount.mockResolvedValue([rows, rows.length]);
  });

  it('list/search forces approved and drops gate failures with a matching total', async () => {
    const res = await service.findPublic({
      status: 'all',
      search: 'a',
      page: 1,
      limit: 1,
    });

    expect(qb.andWhere).toHaveBeenCalledWith('research.status = :status', {
      status: 'approved',
    });
    expect(res.total).toBe(2);
    expect(res.data.map((r) => r.id)).toEqual([1]);
    const page2 = await service.findPublic({ page: 2, limit: 1 });
    expect(page2.data.map((r) => r.id)).toEqual([3]);
  });

  it('findOne only looks up approved rows and 404s otherwise', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findPublicOne(9)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 9, status: 'approved' },
      relations: ['tags'],
    });
    expect(repo.increment).not.toHaveBeenCalled();
  });

  it('findOne 404s an approved row that fails the gate', async () => {
    repo.findOne.mockResolvedValue(rows[1]);
    await expect(service.findPublicOne(2)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('findOne returns an approved, relevant row', async () => {
    repo.findOne.mockResolvedValue(rows[0]);
    await expect(service.findPublicOne(1)).resolves.toBe(rows[0]);
    expect(repo.increment).toHaveBeenCalledWith({ id: 1 }, 'viewCount', 1);
  });

  it('stats count only publicly visible rows', async () => {
    repo.find.mockResolvedValue(rows);
    const stats = await service.getStats();
    expect(repo.find).toHaveBeenCalledWith({ where: { status: 'approved' } });
    expect(stats.total).toBe(2);
  });
});

describe('ResearchController public vs admin routing', () => {
  const jwtSecret = 'test-only-research-public-secret';
  let app: INestApplication;
  let jwtService: JwtService;

  const userRepository = { findOne: jest.fn() };
  const researchService = {
    findAll: jest.fn(),
    findPublic: jest.fn(),
    findOne: jest.fn(),
    findPublicOne: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: jwtSecret }),
      ],
      controllers: [ResearchController, HealthController],
      providers: [
        AuthService,
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'JWT_SECRET' ? jwtSecret : undefined,
            ),
          },
        },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Tag), useValue: {} },
        { provide: ResearchService, useValue: researchService },
      ],
    }).compile();

    jwtService = moduleFixture.get(JwtService);
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    researchService.findAll.mockResolvedValue({ data: [], total: 0 });
    researchService.findPublic.mockResolvedValue({ data: [], total: 0 });
    researchService.findOne.mockResolvedValue({ id: 5 });
    researchService.findPublicOne.mockRejectedValue(
      new NotFoundException('Research #5 not found'),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  const adminToken = () => {
    userRepository.findOne.mockResolvedValue({
      id: 1,
      email: 'admin@example.com',
      name: 'Admin',
      role: UserRole.ADMIN,
      isActive: true,
    });
    return jwtService.sign({ sub: 1, role: UserRole.ADMIN });
  };

  it('ignores status=all on the public list', async () => {
    await request(app.getHttpServer())
      .get('/api/research?status=all')
      .expect(200);
    expect(researchService.findAll).not.toHaveBeenCalled();
    expect(researchService.findPublic).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'approved' }),
    );
  });

  it('keeps the admin list path unchanged', async () => {
    await request(app.getHttpServer())
      .get('/api/research?status=pending')
      .set('Authorization', `Bearer ${adminToken()}`)
      .expect(200);
    expect(researchService.findPublic).not.toHaveBeenCalled();
    expect(researchService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' }),
    );
  });

  it('returns 404 for a non-public item on the public detail path', async () => {
    await request(app.getHttpServer()).get('/api/research/5').expect(404);
    expect(researchService.findOne).not.toHaveBeenCalled();
  });

  it('lets an admin read any item by id', async () => {
    await request(app.getHttpServer())
      .get('/api/research/5')
      .set('Authorization', `Bearer ${adminToken()}`)
      .expect(200);
    expect(researchService.findPublicOne).not.toHaveBeenCalled();
  });

  it('serves /api/health with a commit and no auth', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);
    expect(res.body).toEqual({
      ok: true,
      commit: process.env.RENDER_GIT_COMMIT ?? 'local',
      startedAt: expect.any(String),
    });
  });
});
