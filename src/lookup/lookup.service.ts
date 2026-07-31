import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TruecallerService } from './truecaller.service';
import { LookupCacheService } from './lookup-cache.service';
import { AuditService } from './audit.service';
import { LookupResponseDto } from './dto/lookup-response.dto';
import { toE164 } from '../common/utils/phone.util';

@Injectable()
export class LookupService {
  private readonly defaultCountry: string;

  constructor(
    private readonly truecaller: TruecallerService,
    private readonly cache: LookupCacheService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {
    this.defaultCountry =
      this.config.get<string>('DEFAULT_COUNTRY_CODE') ?? 'GH';
  }

  async lookup(
    rawPhone: string,
    kcSub: string,
    kcClientId: string,
  ): Promise<LookupResponseDto> {
    let phoneE164: string;
    try {
      phoneE164 = toE164(rawPhone, this.defaultCountry);
    } catch {
      throw new BadRequestException(`Invalid phone number: ${rawPhone}`);
    }

    const start = Date.now();

    const cached = await this.cache.get(phoneE164);
    if (cached) {
      const result = {
        ...(cached as unknown as LookupResponseDto),
        cached: true,
      };
      this.audit.write({
        phoneE164,
        resultName: result.name ?? null,
        cached: true,
        durationMs: Date.now() - start,
        kcSub,
        kcClientId,
      });
      return result;
    }

    const result = await this.truecaller.search(phoneE164);

    if (!result.name || result.name === 'Unknown') {
      throw new NotFoundException(
        `Number not found in Truecaller: ${phoneE164}`,
      );
    }

    await this.cache.set(
      phoneE164,
      result as unknown as Record<string, unknown>,
    );

    this.audit.write({
      phoneE164,
      resultName: result.name,
      cached: false,
      durationMs: Date.now() - start,
      kcSub,
      kcClientId,
    });

    return result;
  }
}
