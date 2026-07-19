import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { JwtPayload } from '../../auth/jwt-payload.interface';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    @InjectPinoLogger(LoggingInterceptor.name)
    private readonly logger: PinoLogger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();

    const { method, url, user } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const res = context
          .switchToHttp()
          .getResponse<{ statusCode: number }>();
        this.logger.info({
          method,
          url,
          statusCode: res.statusCode,
          durationMs: Date.now() - start,
          kcSub: user?.sub,
          kcClientId: user?.azp,
        });
      }),
    );
  }
}
