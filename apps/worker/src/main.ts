import * as dotenv from 'dotenv';
import * as path from 'path';

// Load dotenv from root folder (checks multiple possible paths in monorepo)
dotenv.config({ path: path.join(process.cwd(), '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log('Worker microservice is running and listening to BullMQ queues...');
}
bootstrap();
