import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Repository } from 'typeorm';
import * as truecallerjs from 'truecallerjs';
import { decrypt, encrypt } from './crypto.util';
import { TcToken } from './entities/tc-token.entity';
import { TokenEvent } from './entities/token-event.entity';

const TC_TOKEN_TTL_SECONDS = 259_200;

interface LoginResponse {
  status: number;
  requestId: string;
}

interface VerifyResponse {
  status: number;
  suspended?: boolean;
  installationId: string;
  ttl?: number;
}

@Injectable()
export class TokenService {
  constructor(
    @InjectRepository(TcToken)
    private readonly tcTokenRepo: Repository<TcToken>,
    @InjectRepository(TokenEvent)
    private readonly tokenEventRepo: Repository<TokenEvent>,
    private readonly config: ConfigService,
    @InjectPinoLogger(TokenService.name)
    private readonly logger: PinoLogger,
  ) {}

  async requestOtp(kcSub: string): Promise<{ requestId: string }> {
    const phone = this.config.getOrThrow<string>('TC_PHONE_NUMBER');

    const response = await (
      truecallerjs as unknown as {
        login: (p: string) => Promise<LoginResponse>;
      }
    ).login(phone);

    if (response.status !== 1 && response.status !== 9) {
      this.logger.error({ status: response.status }, 'OTP request failed');
      throw new ServiceUnavailableException('Failed to send OTP');
    }

    await this.tokenEventRepo.save(
      this.tokenEventRepo.create({ eventType: 'otp_requested', kcSub }),
    );

    return { requestId: response.requestId };
  }

  async verifyOtp(
    requestId: string,
    otp: string,
    kcSub: string,
  ): Promise<void> {
    const response = await (
      truecallerjs as unknown as {
        verifyOtp: (r: string, o: string) => Promise<VerifyResponse>;
      }
    ).verifyOtp(requestId, otp);

    if (response.status !== 2 || response.suspended) {
      throw new BadRequestException('Invalid OTP or account suspended');
    }

    const encKey = this.config.getOrThrow<string>('ENCRYPTION_KEY');
    const ttl = response.ttl ?? TC_TOKEN_TTL_SECONDS;
    const expiresAt = new Date(Date.now() + ttl * 1_000);

    await this.tcTokenRepo.save(
      this.tcTokenRepo.create({
        installationIdEnc: encrypt(response.installationId, encKey),
        expiresAt,
      }),
    );

    await this.tokenEventRepo.save(
      this.tokenEventRepo.create({ eventType: 'otp_verified', kcSub }),
    );

    this.logger.info({ expiresAt }, 'TC token stored');
  }

  async getStatus(): Promise<{
    valid: boolean;
    expiresAt: Date | null;
    hoursRemaining: number;
  }> {
    const token = await this.latestToken();

    if (!token || token.expiresAt < new Date()) {
      return { valid: false, expiresAt: null, hoursRemaining: 0 };
    }

    const hoursRemaining = Math.floor(
      (token.expiresAt.getTime() - Date.now()) / 3_600_000,
    );
    return { valid: true, expiresAt: token.expiresAt, hoursRemaining };
  }

  async getInstallationId(): Promise<string | null> {
    const token = await this.latestToken();
    if (!token || token.expiresAt < new Date()) return null;

    const encKey = this.config.getOrThrow<string>('ENCRYPTION_KEY');
    return decrypt(token.installationIdEnc, encKey);
  }

  private latestToken(): Promise<TcToken | null> {
    return this.tcTokenRepo.findOne({
      where: {},
      order: { createdAt: 'DESC' },
    });
  }
}
