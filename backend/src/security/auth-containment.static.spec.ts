import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import * as ts from 'typescript';

type MutationMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface ParsedDecorator {
  name: string;
  argumentTexts: string[];
  firstStringArgument?: string;
}

interface MutationEndpoint {
  file: string;
  method: MutationMethod;
  route: string;
  key: string;
  decorators: ParsedDecorator[];
}

const MUTATION_DECORATORS = new Map<string, MutationMethod>([
  ['Post', 'POST'],
  ['Put', 'PUT'],
  ['Patch', 'PATCH'],
  ['Delete', 'DELETE'],
]);

const AUDITED_MUTATION_ENDPOINTS = [
  'backend/src/auth/auth.controller.ts POST /api/auth/login',
  'backend/src/auth/auth.controller.ts POST /api/auth/register',
  'backend/src/indicators/indicators.controller.ts POST /api/indicators/extract-pdf',
  'backend/src/indicators/indicators.controller.ts POST /api/indicators/observations/approve',
  'backend/src/indicators/review.controller.ts POST /api/indicators/review/:token',
  'backend/src/policy/policy.controller.ts DELETE /api/policy/documents/:id',
  'backend/src/policy/policy.controller.ts DELETE /api/policy/matrix/cells/:id',
  'backend/src/policy/policy.controller.ts POST /api/policy/documents',
  'backend/src/policy/policy.controller.ts POST /api/policy/documents/:id/analyze',
  'backend/src/policy/policy.controller.ts POST /api/policy/matrix/bulk',
  'backend/src/policy/policy.controller.ts POST /api/policy/matrix/cells',
  'backend/src/policy/policy.controller.ts PUT /api/policy/documents/:id',
  'backend/src/policy/policy.controller.ts PUT /api/policy/matrix/cells/:id',
  'backend/src/recovery/recovery.controller.ts DELETE /api/recovery/resources/:id',
  'backend/src/recovery/recovery.controller.ts POST /api/recovery/resources',
  'backend/src/recovery/recovery.controller.ts PUT /api/recovery/resources/:id',
  'backend/src/research/research.controller.ts DELETE /api/research/:id',
  'backend/src/research/research.controller.ts POST /api/research',
  'backend/src/research/research.controller.ts PUT /api/research/:id',
  'backend/src/tags/tags.controller.ts DELETE /api/tags/:id',
  'backend/src/tags/tags.controller.ts POST /api/tags',
  'backend/src/tags/tags.controller.ts PUT /api/tags/:id',
] as const;

const PUBLIC_AUTH_MUTATIONS = new Set([
  'backend/src/auth/auth.controller.ts POST /api/auth/login',
  'backend/src/auth/auth.controller.ts POST /api/auth/register',
]);

// This is not a public, unguarded write: possession of a narrowly scoped,
// expiring HMAC token authorizes one review batch. Keep this list exact so a
// new mutation cannot silently bypass the JWT + admin requirement below.
const CAPABILITY_AUTH_MUTATIONS = new Set([
  'backend/src/indicators/review.controller.ts POST /api/indicators/review/:token',
]);

function findRepositoryRoot(...startingPoints: string[]): string {
  const visited = new Set<string>();

  for (const startingPoint of startingPoints) {
    let current = resolve(startingPoint);

    while (!visited.has(current)) {
      visited.add(current);

      if (
        existsSync(join(current, '.git')) &&
        existsSync(join(current, 'backend', 'package.json')) &&
        existsSync(join(current, 'frontend', 'package.json'))
      ) {
        return current;
      }

      const parent = dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }
  }

  throw new Error('Unable to locate the addiction-society repository root');
}

const REPOSITORY_ROOT = findRepositoryRoot(__dirname, process.cwd());

function repositoryPath(filePath: string): string {
  return relative(REPOSITORY_ROOT, filePath).replaceAll('\\', '/');
}

function readRepositoryFile(filePath: string): string {
  return readFileSync(join(REPOSITORY_ROOT, filePath), 'utf8');
}

function listFilesRecursively(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    return entry.isDirectory() ? listFilesRecursively(entryPath) : [entryPath];
  });
}

function nodeDecorators(node: ts.Node): readonly ts.Decorator[] {
  return ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [];
}

function decoratorName(expression: ts.LeftHandSideExpression): string {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }

  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text;
  }

  return expression.getText();
}

function parseDecorator(
  decorator: ts.Decorator,
  sourceFile: ts.SourceFile,
): ParsedDecorator {
  if (!ts.isCallExpression(decorator.expression)) {
    return {
      name: decoratorName(decorator.expression),
      argumentTexts: [],
    };
  }

  const args = [...decorator.expression.arguments];
  const firstArg = args[0];

  return {
    name: decoratorName(decorator.expression.expression),
    argumentTexts: args.map((argument) => argument.getText(sourceFile)),
    firstStringArgument:
      firstArg && ts.isStringLiteralLike(firstArg) ? firstArg.text : undefined,
  };
}

function routeFromDecorator(decorator: ParsedDecorator): string {
  if (decorator.argumentTexts.length === 0) {
    return '';
  }

  return decorator.firstStringArgument ?? '<dynamic-route>';
}

function joinRoute(...parts: string[]): string {
  const path = parts
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');

  return path ? `/${path}` : '/';
}

function discoverMutationEndpoints(): MutationEndpoint[] {
  const controllerFiles = listFilesRecursively(
    join(REPOSITORY_ROOT, 'backend', 'src'),
  ).filter((filePath) => filePath.endsWith('.controller.ts'));

  const endpoints: MutationEndpoint[] = [];

  for (const filePath of controllerFiles) {
    const source = readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(
      filePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    sourceFile.forEachChild((node) => {
      if (!ts.isClassDeclaration(node)) {
        return;
      }

      const classDecorators = nodeDecorators(node).map((decorator) =>
        parseDecorator(decorator, sourceFile),
      );
      const controller = classDecorators.find(
        (decorator) => decorator.name === 'Controller',
      );

      if (!controller) {
        return;
      }

      const controllerRoute = routeFromDecorator(controller);

      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member)) {
          continue;
        }

        const methodDecorators = nodeDecorators(member).map((decorator) =>
          parseDecorator(decorator, sourceFile),
        );

        for (const decorator of methodDecorators) {
          const method = MUTATION_DECORATORS.get(decorator.name);
          if (!method) {
            continue;
          }

          const file = repositoryPath(filePath);
          const route = joinRoute(
            controllerRoute,
            routeFromDecorator(decorator),
          );

          endpoints.push({
            file,
            method,
            route,
            key: `${file} ${method} ${route}`,
            decorators: [...classDecorators, ...methodDecorators],
          });
        }
      }
    });
  }

  return endpoints.sort((left, right) => left.key.localeCompare(right.key));
}

function hasDecoratorArgument(
  endpoint: MutationEndpoint,
  decorator: string,
  argument: string,
): boolean {
  return endpoint.decorators.some(
    (candidate) =>
      candidate.name === decorator &&
      candidate.argumentTexts.some(
        (candidateArgument) =>
          candidateArgument.replace(/\s/g, '') === argument,
      ),
  );
}

function jwtConfigurationFindings(): string[] {
  const backendSources = listFilesRecursively(
    join(REPOSITORY_ROOT, 'backend', 'src'),
  ).filter(
    (filePath) => filePath.endsWith('.ts') && !filePath.endsWith('.spec.ts'),
  );
  const findings: string[] = [];

  for (const filePath of backendSources) {
    const source = readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(
      filePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const visit = (node: ts.Node): void => {
      if (
        ts.isBinaryExpression(node) &&
        (node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
          node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) &&
        /\bJWT_SECRET\b/.test(node.left.getText(sourceFile))
      ) {
        findings.push(`${repositoryPath(filePath)}: JWT fallback expression`);
      }

      if (
        ts.isCallExpression(node) &&
        node.arguments.length > 1 &&
        ts.isStringLiteralLike(node.arguments[0]) &&
        node.arguments[0].text === 'JWT_SECRET'
      ) {
        findings.push(`${repositoryPath(filePath)}: JWT config default`);
      }

      if (ts.isPropertyAssignment(node)) {
        const name = node.name.getText(sourceFile).replace(/['"]/g, '');
        if (
          (name === 'secret' || name === 'secretOrKey') &&
          ts.isStringLiteralLike(node.initializer)
        ) {
          findings.push(`${repositoryPath(filePath)}: literal JWT secret`);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  return [...new Set(findings)].sort();
}

function userEntityRoleDefault(): string | undefined {
  const filePath = join(
    REPOSITORY_ROOT,
    'backend',
    'src',
    'auth',
    'entities',
    'user.entity.ts',
  );
  const sourceFile = ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let roleDefault: string | undefined;

  sourceFile.forEachChild((node) => {
    if (!ts.isClassDeclaration(node) || node.name?.text !== 'User') {
      return;
    }

    for (const member of node.members) {
      if (
        !ts.isPropertyDeclaration(member) ||
        member.name.getText(sourceFile) !== 'role'
      ) {
        continue;
      }

      for (const decorator of nodeDecorators(member)) {
        if (
          !ts.isCallExpression(decorator.expression) ||
          decoratorName(decorator.expression.expression) !== 'Column'
        ) {
          continue;
        }

        const options = decorator.expression.arguments[0];
        if (!options || !ts.isObjectLiteralExpression(options)) {
          continue;
        }

        const defaultProperty = options.properties.find(
          (property): property is ts.PropertyAssignment =>
            ts.isPropertyAssignment(property) &&
            property.name.getText(sourceFile).replace(/['"]/g, '') ===
              'default',
        );

        roleDefault = defaultProperty?.initializer.getText(sourceFile);
      }
    }
  });

  return roleDefault;
}

const mutationEndpoints = discoverMutationEndpoints();

describe('AUTH-001 controller containment', () => {
  it('keeps the audited mutation-route inventory explicit', () => {
    expect(mutationEndpoints.map((endpoint) => endpoint.key)).toEqual(
      [...AUDITED_MUTATION_ENDPOINTS].sort((left, right) =>
        left.localeCompare(right),
      ),
    );
  });

  it('requires JWT and the admin role on every ordinary admin mutation endpoint', () => {
    const missingProtection = mutationEndpoints
      .filter(
        (endpoint) =>
          !PUBLIC_AUTH_MUTATIONS.has(endpoint.key) &&
          !CAPABILITY_AUTH_MUTATIONS.has(endpoint.key),
      )
      .flatMap((endpoint) => {
        const missing: string[] = [];

        if (!hasDecoratorArgument(endpoint, 'UseGuards', 'JwtAuthGuard')) {
          missing.push('JwtAuthGuard');
        }
        if (!hasDecoratorArgument(endpoint, 'UseGuards', 'RolesGuard')) {
          missing.push('RolesGuard');
        }
        if (!hasDecoratorArgument(endpoint, 'Roles', 'UserRole.ADMIN')) {
          missing.push('UserRole.ADMIN');
        }

        return missing.length
          ? [`${endpoint.key}: missing ${missing.join(', ')}`]
          : [];
      });

    expect(missingProtection).toEqual([]);
  });

  it('keeps the review mutation exception limited to an expiring HMAC capability', () => {
    expect([...CAPABILITY_AUTH_MUTATIONS]).toEqual([
      'backend/src/indicators/review.controller.ts POST /api/indicators/review/:token',
    ]);

    const reviewController = readRepositoryFile(
      'backend/src/indicators/review.controller.ts',
    );
    const reviewToken = readRepositoryFile(
      'backend/src/indicators/review-token.util.ts',
    );
    const reviewSecret = readRepositoryFile(
      'backend/src/indicators/review-secret.util.ts',
    );

    expect(reviewController).toMatch(/@Post\(\s*['"]:token['"]\s*\)/);
    expect(reviewController).toMatch(
      /verifyReviewToken\(\s*token\s*,\s*this\.secret\(\)\s*\)/,
    );
    expect(reviewController).toMatch(/if\s*\(\s*!v\.ok\s*\)/);
    expect(reviewController).toMatch(
      /reviewBatch\(\s*v\.batch\s*,\s*action\s*\)/,
    );
    expect(reviewToken).toMatch(/createHmac\(\s*['"]sha256['"]/);
    expect(reviewToken).toMatch(/timingSafeEqual\(/);
    expect(reviewToken).toMatch(
      /payload\.exp\s*\*\s*1000\s*<\s*now\.getTime\(\)/,
    );
    expect(reviewSecret).toMatch(/\bREVIEW_TOKEN_SECRET\b/);
    expect(reviewSecret).toMatch(/\bJWT_SECRET\b/);
    expect(reviewSecret).toMatch(/createHmac\(\s*['"]sha256['"]/);
  });
});

describe('AUTH-001 legacy admin containment', () => {
  const legacyFiles = {
    'frontend/src/pages/admin/AdminLogin.tsx': readRepositoryFile(
      'frontend/src/pages/admin/AdminLogin.tsx',
    ),
    'frontend/public/admin.html': readRepositoryFile(
      'frontend/public/admin.html',
    ),
    'frontend/src/api/index.ts': readRepositoryFile(
      'frontend/src/api/index.ts',
    ),
  };

  it('contains no registration request or authApi.register surface', () => {
    const forbiddenPatterns = [
      { label: 'register route', pattern: /\/auth\/register(?:\b|\/)/i },
      { label: 'authApi.register', pattern: /\bauthApi\s*\.\s*register\b/i },
      { label: 'register API member', pattern: /\bregister\s*:/i },
    ];
    const findings = Object.entries(legacyFiles).flatMap(([file, source]) =>
      forbiddenPatterns
        .filter(({ pattern }) => pattern.test(source))
        .map(({ label }) => `${file}: ${label}`),
    );

    expect(findings).toEqual([]);
  });

  it('retains the existing login flow in both legacy clients and the API wrapper', () => {
    expect(legacyFiles['frontend/src/pages/admin/AdminLogin.tsx']).toMatch(
      /\bauthApi\s*\.\s*login\s*\(/,
    );
    expect(legacyFiles['frontend/public/admin.html']).toMatch(
      /\/auth\/login\b/,
    );
    expect(legacyFiles['frontend/src/api/index.ts']).toMatch(
      /\blogin\s*:[\s\S]*?api\.post\(\s*['"]\/auth\/login['"]/,
    );
  });

  it('contains no fixed or hinted credentials in the two legacy login surfaces', () => {
    const sensitiveFiles = {
      'frontend/src/pages/admin/AdminLogin.tsx':
        legacyFiles['frontend/src/pages/admin/AdminLogin.tsx'],
      'frontend/public/admin.html': legacyFiles['frontend/public/admin.html'],
    };
    const credentialPatterns = [
      {
        label: 'email-like literal',
        pattern: /(['"`])[^'"`\s@]+@[^'"`\s@]+\.[^'"`\s@]+\1/i,
      },
      {
        label: 'credential-like assignment',
        pattern:
          /\b(?:password|passwd|pwd|accessToken|authToken|token|jwtSecret|secret)\b\s*[:=]\s*(['"`])[^'"`\r\n]+\1/i,
      },
      {
        label: 'fixed administrator credential constant',
        pattern:
          /\b(?:ADMIN|DEFAULT|BOOTSTRAP|INITIAL)_(?:EMAIL|PASSWORD|PASS|TOKEN|SECRET|CREDENTIALS?)\b\s*=/i,
      },
      {
        label: 'prefilled login input',
        pattern:
          /<input\b(?=[^>]*(?:id|name)=['"](?:login)?(?:email|password)['"])(?=[^>]*\bvalue=['"][^'"]+['"])[^>]*>/i,
      },
      {
        label: 'default credential hint',
        pattern:
          /(?:기본|초기)\s*(?:관리자\s*)?(?:계정|이메일|비밀번호|자격\s*정보)|\b(?:default|initial|bootstrap)\s+(?:admin(?:istrator)?\s+)?(?:credentials?|email|password|token)\b/i,
      },
    ];
    const findings = Object.entries(sensitiveFiles).flatMap(([file, source]) =>
      credentialPatterns
        .filter(({ pattern }) => pattern.test(source))
        .map(({ label }) => `${file}: ${label}`),
    );

    expect(findings).toEqual([]);
  });
});

describe('AUTH-001 JWT and default-role containment', () => {
  it('uses one required non-empty JWT secret path without a fallback or get default', () => {
    const jwtConfig = readRepositoryFile('backend/src/auth/jwt.config.ts');
    const appModule = readRepositoryFile('backend/src/app.module.ts');
    const authModule = readRepositoryFile('backend/src/auth/auth.module.ts');
    const jwtStrategy = readRepositoryFile('backend/src/auth/jwt.strategy.ts');

    expect(jwtConfigurationFindings()).toEqual([]);
    expect(jwtConfig).toMatch(/typeof\s+value\s*!==\s*['"]string['"]/);
    expect(jwtConfig).toMatch(/value\.trim\(\)\.length\s*===\s*0/);
    expect(jwtConfig).toMatch(/throw\s+new\s+Error\s*\(/);
    expect(appModule).toMatch(/validate\s*:\s*validateJwtEnvironment\b/);
    expect(authModule).toMatch(
      /\bsecret\s*:\s*getRequiredJwtSecret\(configService\)/,
    );
    expect(jwtStrategy).toMatch(
      /\bsecretOrKey\s*:\s*getRequiredJwtSecret\(configService\)/,
    );
  });

  it('defaults newly created User entities to the non-admin user role', () => {
    expect(userEntityRoleDefault()).toBe('UserRole.USER');
  });
});
