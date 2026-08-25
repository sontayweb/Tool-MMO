import * as dotenv from 'dotenv';
import * as path from 'path';

// Load dotenv from root folder (checks multiple possible paths in monorepo)
dotenv.config({ path: path.join(process.cwd(), '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.setGlobalPrefix('api');
  app.enableCors();
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true
  }));

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`API is running on: http://localhost:${port}/api`);
}
bootstrap();
