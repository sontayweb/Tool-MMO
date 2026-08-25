import { Global, Module } from '@nestjs/common';
import { CryptoService } from '@arms/shared';

@Global()
@Module({
  providers: [
    {
      provide: CryptoService,
      useFactory: () => {
        return new CryptoService(process.env.ENCRYPTION_KEY_BASE64);
      }
    }
  ],
  exports: [CryptoService]
})
export class CryptoModule {}
