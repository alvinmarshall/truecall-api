import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtPayload } from '../../auth/jwt-payload.interface';

@Injectable()
export class JwtThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Request & { user?: JwtPayload }): Promise<string> {
    return Promise.resolve(req.user?.sub ?? req.ip ?? 'anonymous');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    return super.canActivate(context);
  }
}
