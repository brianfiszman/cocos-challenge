import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/exceptions/http-exception.filter';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';

export interface TestContext {
  app: INestApplication;
  sequelize: Sequelize;
}

/**
 * Boots the real application (real modules, real repositories, real Postgres)
 * with the same global pipes, filters and interceptors as `main.ts`.
 */
export async function createTestApp(): Promise<TestContext> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  // Test suites assert on status codes; keep Nest's request logs out of the way.
  app.useLogger(false);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  await app.init();

  const sequelize = app.get(Sequelize);
  // The shared database config logs every query; tests should stay quiet.
  sequelize.options.logging = false;

  return { app, sequelize };
}
