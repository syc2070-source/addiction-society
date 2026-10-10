import {
  BadRequestException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
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
import { AddResearchReviewColumns1788400000000 } from '../migrations/1788400000000-AddResearchReviewColumns';
import { Research } from './entities/research.entity';
import {
  isPubliclyVisible,
  relevanceColumns,
  relevanceVerdict,
} from './relevance';
import { ResearchReviewController } from './research-review.controller';
import { ResearchService } from './research.service';

// SOC-R1 — 검수 칸 · 공개 규칙 하나 · 검수 창 API.
const passing = {
  status: 'approved',
  title: 'Cell-Phone Addiction: A Review',
  abstract: null,
  keywords: [],
};
const failing = {
  status: 'approved',
  title: 'The Positive and Negative Syndrome Scale (PANSS) for Schizophrenia',
  abstract: 'Patients were rated drug-free and again after drug treatment.',
  keywords: ['alcohol use disorder treatment'],
};

describe('public visibility rule (approved ∧ (gate ∨ keep) ∧ ¬hide)', () => {
  it('gate pass, unreviewed → visible', () => {
    expect(isPubliclyVisible({ ...passing, reviewDecision: null })).toBe(true);
  });

  it('gate fail + keep → visible', () => {
    expect(isPubliclyVisible({ ...failing, reviewDecision: 'keep' })).toBe(
      true,
    );
  });

  it('hide wins even when the gate passes', () => {
    expect(isPubliclyVisible({ ...passing, reviewDecision: 'hide' })).toBe(
      false,
    );
  });

  it('gate fail, unreviewed → hidden', () => {
    expect(isPubliclyVisible({ ...failing, reviewDecision: null })).toBe(false);
  });

  it('keep never exposes a non-approved row', () => {
    expect(
      isPubliclyVisible({
        ...failing,
        status: 'pending',
        reviewDecision: 'keep',
      }),
    ).toBe(false);
  });
});

describe('relevance verdict / columns', () => {
  it('explains a failure by field', () => {
    const v = relevanceVerdict(failing);
    expect(v.pass).toBe(false);
    expect(v.reason).toBe('실패: 제목 0 · 키워드 0 · 초록 2(<3)');
    expect(v.hits).toEqual({ title: 0, keywords: 0, abstract: 2 });
  });

  it('explains a pass and fills the three relevance columns', () => {
    const at = new Date('2026-10-10T00:00:00Z');
    expect(relevanceColumns(passing, at)).toEqual({
      relevanceScore: '1',
      relevanceReason: '통과: 제목 1',
      relevanceCheckedAt: at,
    });
  });
});

describe('migration AddResearchReviewColumns', () => {
  const cols = [
    'reviewed_by',
    'reviewed_at',
    'review_decision',
    'relevance_score',
    'relevance_reason',
    'relevance_checked_at',
  ];
  const run = async (dir: 'up' | 'down') => {
    const sql: string[] = [];
    const qr = { query: jest.fn(async (q: string) => void sql.push(q)) };
    await new AddResearchReviewColumns1788400000000()[dir](qr as never);
    return sql.join('\n');
  };

  it('up only adds six nullable columns with IF NOT EXISTS', async () => {
    const sql = await run('up');
    for (const c of cols) {
      expect(sql).toMatch(
        new RegExp(`ADD COLUMN IF NOT EXISTS "${c}" \\w+ NULL`),
      );
    }
    expect(sql).not.toMatch(/UPDATE|DEFAULT|NOT NULL|"status"/i);
  });

  it('down drops exactly those six columns', async () => {
    const sql = await run('down');
    for (const c of cols) expect(sql).toContain(`DROP COLUMN IF EXISTS "${c}"`);
    expect(sql.match(/DROP COLUMN/g)).toHaveLength(6);
  });
});

describe('ResearchService review', () => {
  const rows = [
    { id: 1, ...passing, reviewDecision: null },
    { id: 2, ...failing, reviewDecision: null },
    { id: 3, ...failing, reviewDecision: 'keep' },
    { id: 4, ...failing, reviewDecision: 'hide' },
  ] as unknown as Research[];
  const repo = {
    find: jest.fn(async () => rows),
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const service = new ResearchService(repo as never, {} as never);

  beforeEach(() => jest.clearAllMocks());

  it('queue tabs only hold gate failures, split by decision', async () => {
    expect((await service.findReviewQueue('pending')).map((r) => r.id)).toEqual(
      [2],
    );
    expect((await service.findReviewQueue('keep')).map((r) => r.id)).toEqual([
      3,
    ]);
    expect((await service.findReviewQueue('hide')).map((r) => r.id)).toEqual([
      4,
    ]);
    const [item] = await service.findReviewQueue('pending');
    expect(item.gateReason).toBe('실패: 제목 0 · 키워드 0 · 초록 2(<3)');
    expect(item.abstractPreview.length).toBeLessThanOrEqual(200);
  });

  it('writes only review_* columns (status untouched)', async () => {
    repo.findOne.mockResolvedValue({ id: 2 });
    await service.review(2, 'keep', 'owner@example.com');
    expect(repo.update).toHaveBeenCalledWith(2, {
      reviewDecision: 'keep',
      reviewedBy: 'owner@example.com',
      reviewedAt: expect.any(Date),
    });
  });

  it('rejects a missing decision and unknown ids', async () => {
    await expect(service.review(2, undefined, 'x')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    repo.findOne.mockResolvedValue(null);
    await expect(service.review(99, 'hide', 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('PUT /api/admin/research/:id/review', () => {
  const jwtSecret = 'test-only-research-review-secret';
  let app: INestApplication;
  let jwtService: JwtService;
  const userRepository = { findOne: jest.fn() };
  const researchService = {
    review: jest.fn(async (id: number, decision: unknown, by: string) => ({
      id,
      reviewDecision: decision,
      reviewedBy: by,
      reviewedAt: new Date(),
    })),
    findReviewQueue: jest.fn(async () => []),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: jwtSecret }),
      ],
      controllers: [ResearchReviewController],
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
        { provide: ResearchService, useValue: researchService },
      ],
    }).compile();
    jwtService = moduleFixture.get(JwtService);
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  const tokenFor = (role: UserRole) => {
    userRepository.findOne.mockResolvedValue({
      id: 7,
      email: `${role}@example.com`,
      name: role,
      role,
      isActive: true,
    });
    return jwtService.sign({ sub: 7, role });
  };

  it('401 without a token', async () => {
    await request(app.getHttpServer())
      .put('/api/admin/research/2/review')
      .send({ decision: 'keep' })
      .expect(401);
    expect(researchService.review).not.toHaveBeenCalled();
  });

  it('403 for a non-admin token', async () => {
    await request(app.getHttpServer())
      .put('/api/admin/research/2/review')
      .set('Authorization', `Bearer ${tokenFor(UserRole.USER)}`)
      .send({ decision: 'keep' })
      .expect(403);
    expect(researchService.review).not.toHaveBeenCalled();
  });

  it('admin decision records the logged-in reviewer', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/admin/research/2/review')
      .set('Authorization', `Bearer ${tokenFor(UserRole.ADMIN)}`)
      .send({ decision: 'hide' })
      .expect(200);
    expect(researchService.review).toHaveBeenCalledWith(
      2,
      'hide',
      'admin@example.com',
    );
    expect(res.body.reviewDecision).toBe('hide');
  });

  it('400 for an unknown decision value', async () => {
    await request(app.getHttpServer())
      .put('/api/admin/research/2/review')
      .set('Authorization', `Bearer ${tokenFor(UserRole.ADMIN)}`)
      .send({ decision: 'approve' })
      .expect(400);
  });

  it('queue is admin-only too', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/research/review?tab=pending')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/admin/research/review?tab=pending')
      .set('Authorization', `Bearer ${tokenFor(UserRole.ADMIN)}`)
      .expect(200);
    expect(researchService.findReviewQueue).toHaveBeenCalledWith('pending');
  });
});
