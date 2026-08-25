import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-arms-api-key'] as string;
    const configuredKey = process.env.ARMS_API_KEY || 'arms_apikey_3ef419721adcb5879a8385';
    if (apiKey && apiKey === configuredKey) {
      (request as any).user = {
        username: 'GoogleSheets_Admin',
        role: 'OWNER',
        team: 'ALL'
      };
      return true;
    }

    const token = this.extractTokenFromHeader(request);
    
    if (!token) {
      throw new UnauthorizedException('Yêu cầu xác thực. Token không tìm thấy.');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'fallback-secret-keys-for-arms-dev'
      });
      // Attach user payload to request
      (request as any).user = payload;
    } catch {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn.');
    }
    
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
