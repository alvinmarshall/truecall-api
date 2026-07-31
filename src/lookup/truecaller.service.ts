import {
  Injectable,
  ServiceUnavailableException,
  BadGatewayException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  circuitBreaker,
  ConsecutiveBreaker,
  ExponentialBackoff,
  retry,
  handleAll,
  wrap,
  IPolicy,
} from 'cockatiel';
import * as truecallerjs from 'truecallerjs';
import { TokenService } from '../token/token.service';
import { LookupResponseDto } from './dto/lookup-response.dto';

@Injectable()
export class TruecallerService {
  private readonly policy: IPolicy;
  private readonly defaultCountry: string;

  constructor(
    private readonly tokenService: TokenService,
    private readonly config: ConfigService,
    @InjectPinoLogger(TruecallerService.name)
    private readonly logger: PinoLogger,
  ) {
    const cb = circuitBreaker(handleAll, {
      halfOpenAfter: 30_000,
      breaker: new ConsecutiveBreaker(5),
    });
    const retryPolicy = retry(handleAll, {
      maxAttempts: 3,
      backoff: new ExponentialBackoff({ initialDelay: 500, maxDelay: 1_000 }),
    });

    this.policy = wrap(retryPolicy, cb);
    this.defaultCountry =
      this.config.get<string>('DEFAULT_COUNTRY_CODE') ?? 'GH';
  }

  async search(phoneE164: string): Promise<LookupResponseDto> {
    const installationId = await this.tokenService.getInstallationId();
    if (!installationId) {
      throw new ServiceUnavailableException(
        'Truecaller token expired — re-authenticate via /admin/token/request-otp',
      );
    }

    let raw: Record<string, unknown>;
    try {
      raw = (await this.policy.execute(() =>
        truecallerjs.search({
          number: phoneE164,
          countryCode: this.defaultCountry,
          installationId,
        }),
      )) as unknown as Record<string, unknown>;
    } catch (err) {
      this.logger.error(
        { err: err as Error, phone: phoneE164 },
        'Truecaller upstream error',
      );
      throw new BadGatewayException('Truecaller upstream error');
    }

    return this.mapResponse(phoneE164, raw);
  }

  private mapResponse(
    phoneE164: string,
    raw: Record<string, unknown>,
  ): LookupResponseDto {
    const data = raw as {
      name?: string;
      score?: number;
      phones?: { carrier?: string; numberType?: string }[];
      addresses?: { countryCode?: string }[];
      spamInfo?: { score?: number; spamStatus?: string };
    };

    const phone = data.phones?.[0];
    const address = data.addresses?.[0];
    const spam = data.spamInfo;
    const spamScore = spam?.score ?? 0;

    return {
      phone: phoneE164,
      name: data.name ?? 'Unknown',
      score: data.score ?? 0,
      carrier: phone?.carrier ?? '',
      lineType: phone?.numberType ?? '',
      country: address?.countryCode ?? this.defaultCountry,
      spamScore,
      isSpam: spamScore > 0 || spam?.spamStatus === 'SPAM',
      cached: false,
      lookedUpAt: new Date().toISOString(),
    };
  }
}
