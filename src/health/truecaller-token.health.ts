import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { TokenService } from '../token/token.service';

@Injectable()
export class TruecallerTokenHealthIndicator extends HealthIndicator {
  constructor(private readonly tokenService: TokenService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const status = await this.tokenService.getStatus();

    if (!status.valid) {
      throw new HealthCheckError(
        'Truecaller token expired',
        this.getStatus(key, false, { hoursRemaining: 0 }),
      );
    }

    return this.getStatus(key, true, {
      hoursRemaining: status.hoursRemaining,
    });
  }
}
