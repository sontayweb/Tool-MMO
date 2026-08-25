import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { URL } from 'url';

function parseRedisUrl(urlStr: string) {
  try {
    const parsed = new URL(urlStr);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379', 10),
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      db: parsed.pathname ? parseInt(parsed.pathname.substring(1) || '0', 10) : 0
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

const connection = parseRedisUrl(process.env.REDIS_URL || 'redis://localhost:6379');

@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection
    }),
    BullModule.registerQueue(
      { name: 'scan-queue' },
      { name: 'export-queue' }
    )
  ],
  exports: [BullModule]
})
export class QueueModule {}
