import * as dotenv from 'dotenv';
import * as path from 'path';

// Load dotenv from root folder (checks multiple possible paths in monorepo)
dotenv.config({ path: path.join(process.cwd(), '../.env') });
dotenv.config({ path: path.join(process.cwd(), '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config({ path: path.join(__dirname, '../../../../.env') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  // Swagger API Documentation Setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle('ARMS Data Warehouse API v4.0')
    .setDescription(`
      Enterprise Account Resource Management System (ARMS DWH) REST API Documentation.
      
      ## Xác thực:
      - **JWT Bearer Token**: Dành cho Web Dashboard Admin / Manager / Member.
      - **Service Key (\`x-arms-service-key\` hoặc \`x-arms-api-key\`)**: Dành cho tool Python/Node/C# ngoại vi (Shopee Checker, Web Shop, Tool Nuôi).
    `)
    .setVersion('4.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'x-arms-service-key', in: 'header' }, 'x-arms-service-key')
    .addTag('accounts', 'Quản lý tài khoản, Ingest và Consume tự động')
    .addTag('teams', 'Quản lý Đội nhóm & Phân quyền RBAC')
    .addTag('backup', 'Sao lưu & Phục hồi cơ sở dữ liệu MongoDB')
    .addTag('api-keys', 'Cổng kết nối Tool API Service Keys')
    .addTag('audit', 'Nhật ký kiểm toán & Live Terminal Logs')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  console.log(`[DATABASE URI IN USE]: ${process.env.MONGODB_URI}`);
  await app.listen(port);
  console.log(`API is running on: http://localhost:${port}/api`);
  console.log(`Swagger Docs available at: http://localhost:${port}/api/docs`);
}
bootstrap();
