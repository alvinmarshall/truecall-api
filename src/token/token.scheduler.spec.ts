import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import axios from 'axios';
import { TokenService } from './token.service';
import { TokenScheduler } from './token.scheduler';

jest.mock('axios');
const mockedPost = jest.fn();
(axios as jest.Mocked<typeof axios>).post = mockedPost;

type PostCall = [string, { text: string; chat_id: string }];

const warnMock = jest.fn();
const errorMock = jest.fn();
const mockLogger = {
  warn: warnMock,
  error: errorMock,
  info: jest.fn(),
} as unknown as PinoLogger;

const makeConfig = (overrides: Record<string, unknown> = {}) => ({
  get: jest.fn((key: string) => {
    const defaults: Record<string, unknown> = {
      TOKEN_TTL_BUFFER_SECONDS: 43_200,
      TELEGRAM_BOT_TOKEN: 'test-bot-token',
      TELEGRAM_CHAT_ID: 'test-chat-id',
      ...overrides,
    };
    return defaults[key];
  }),
});

const makeScheduler = (
  status: { valid: boolean; hoursRemaining: number },
  configOverrides: Record<string, unknown> = {},
) => {
  const tokenService = {
    getStatus: jest.fn().mockResolvedValue(status),
  } as unknown as TokenService;
  const config = makeConfig(configOverrides);
  return new TokenScheduler(
    tokenService,
    config as unknown as ConfigService,
    mockLogger,
  );
};

describe('TokenScheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPost.mockResolvedValue({ status: 200 });
  });

  describe('checkTokenExpiry', () => {
    it('does not alert when token is valid and hoursRemaining exceeds buffer', async () => {
      const scheduler = makeScheduler({ valid: true, hoursRemaining: 20 });
      await scheduler['checkTokenExpiry']();
      expect(mockedPost).not.toHaveBeenCalled();
    });

    it('alerts when token is invalid', async () => {
      const scheduler = makeScheduler({ valid: false, hoursRemaining: 0 });
      await scheduler['checkTokenExpiry']();
      expect(mockedPost).toHaveBeenCalled();
    });

    it('alerts when valid but hoursRemaining is within buffer', async () => {
      const scheduler = makeScheduler({ valid: true, hoursRemaining: 2 });
      await scheduler['checkTokenExpiry']();
      expect(mockedPost).toHaveBeenCalled();
    });

    it('uses default buffer of 43200 when TOKEN_TTL_BUFFER_SECONDS not configured', async () => {
      const scheduler = makeScheduler(
        { valid: true, hoursRemaining: 20 },
        { TOKEN_TTL_BUFFER_SECONDS: undefined },
      );
      await scheduler['checkTokenExpiry']();
      expect(mockedPost).not.toHaveBeenCalled();
    });
  });

  describe('sendTelegramAlert', () => {
    it('skips and warns when TELEGRAM_BOT_TOKEN missing', async () => {
      const scheduler = makeScheduler(
        { valid: false, hoursRemaining: 0 },
        { TELEGRAM_BOT_TOKEN: undefined },
      );
      await scheduler['checkTokenExpiry']();
      expect(warnMock).toHaveBeenCalledWith(
        'Telegram config missing — skipping alert',
      );
      expect(mockedPost).not.toHaveBeenCalled();
    });

    it('skips and warns when TELEGRAM_CHAT_ID missing', async () => {
      const scheduler = makeScheduler(
        { valid: false, hoursRemaining: 0 },
        { TELEGRAM_CHAT_ID: undefined },
      );
      await scheduler['checkTokenExpiry']();
      expect(warnMock).toHaveBeenCalledWith(
        'Telegram config missing — skipping alert',
      );
      expect(mockedPost).not.toHaveBeenCalled();
    });

    it('sends expiry warning text when token is still valid', async () => {
      const scheduler = makeScheduler({ valid: true, hoursRemaining: 1 });
      await scheduler['checkTokenExpiry']();
      const [, body] = (mockedPost.mock.calls as PostCall[])[0];
      expect(body.text).toContain('expires in 1h');
    });

    it('sends expired alert text when token is invalid', async () => {
      const scheduler = makeScheduler({ valid: false, hoursRemaining: 0 });
      await scheduler['checkTokenExpiry']();
      const [, body] = (mockedPost.mock.calls as PostCall[])[0];
      expect(body.text).toContain('EXPIRED');
    });

    it('posts to correct Telegram URL with chat_id', async () => {
      const scheduler = makeScheduler({ valid: false, hoursRemaining: 0 });
      await scheduler['checkTokenExpiry']();
      const [url, body] = (mockedPost.mock.calls as PostCall[])[0];
      expect(url).toContain('test-bot-token');
      expect(url).toContain('sendMessage');
      expect(body.chat_id).toBe('test-chat-id');
    });

    it('logs error and does not throw when axios.post fails', async () => {
      mockedPost.mockRejectedValue(new Error('network error'));
      const scheduler = makeScheduler({ valid: false, hoursRemaining: 0 });
      await expect(scheduler['checkTokenExpiry']()).resolves.toBeUndefined();
      expect(errorMock).toHaveBeenCalled();
    });
  });
});
