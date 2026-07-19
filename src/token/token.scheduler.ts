import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import axios from 'axios';
import { TokenService } from './token.service';

@Injectable()
export class TokenScheduler {
  constructor(
    private readonly tokenService: TokenService,
    private readonly config: ConfigService,
    @InjectPinoLogger(TokenScheduler.name)
    private readonly logger: PinoLogger,
  ) {}

  @Cron('0 */6 * * *')
  async checkTokenExpiry(): Promise<void> {
    const status = await this.tokenService.getStatus();
    const bufferSeconds =
      this.config.get<number>('TOKEN_TTL_BUFFER_SECONDS') ?? 43_200;

    const shouldAlert =
      !status.valid || status.hoursRemaining * 3_600 < bufferSeconds;

    if (shouldAlert) {
      await this.sendTelegramAlert(status.hoursRemaining, status.valid);
    }
  }

  private async sendTelegramAlert(
    hoursRemaining: number,
    valid: boolean,
  ): Promise<void> {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const chatId = this.config.get<string>('TELEGRAM_CHAT_ID');

    if (!botToken || !chatId) {
      this.logger.warn('Telegram config missing — skipping alert');
      return;
    }

    const text = valid
      ? `⚠️ TrueCall: TC token expires in ${hoursRemaining}h. POST /admin/token/request-otp now.`
      : `🚨 TrueCall: TC token EXPIRED. POST /admin/token/request-otp immediately.`;

    try {
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text,
      });
    } catch (err: unknown) {
      this.logger.error({ err }, 'Failed to send Telegram alert');
    }
  }
}
