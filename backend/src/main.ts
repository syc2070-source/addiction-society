import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // CORS 허용 출처 (AS-FIX-1, 감사 문제 #1).
  // 이전엔 origin:'*' 였다. 공개 GET만 있을 땐 문제가 작았지만 쓰기·승인
  // 엔드포인트가 있는 이상 브라우저발 요청 출처는 좁혀야 한다.
  // env CORS_ORIGINS(쉼표 구분)로 덮어쓸 수 있다.
  const originEnv = process.env.CORS_ORIGINS?.trim();
  const allowList = originEnv
    ? originEnv
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : [
        'https://addictionsociety.net',
        'https://www.addictionsociety.net',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ];
  // Vercel 프리뷰는 배포마다 호스트가 바뀌므로 패턴으로 허용한다.
  const previewPattern = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

  app.enableCors({
    origin: (origin, callback) => {
      // origin 없음 = 서버 간 호출·curl. 브라우저 동일출처 정책 대상이 아니므로 허용.
      if (!origin) return callback(null, true);
      if (allowList.includes(origin) || previewPattern.test(origin)) {
        return callback(null, true);
      }
      // 거부는 throw가 아니라 false — 프리플라이트가 500이 되지 않게 한다.
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // AS-FIX-1: /uploads 정적 서빙 제거. upload 모듈을 폐기했다(감사 문제 #12)
  //  - 프론트에 업로드 UI가 없어 호출자가 0이었다.
  //  - Render 디스크가 휘발성이라 재배포 때 파일이 사라진다(기능으로 성립 안 함).
  //  - 저장 파일명을 originalname의 확장자로 만들고 mimetype은 클라이언트 값만
  //    믿어, 인증만 통과하면 .html을 올려 이 오리진에서 서빙할 수 있었다.

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`🚀 Addiction Society API running on http://localhost:${port}`);
}
void bootstrap();
