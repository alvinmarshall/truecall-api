import { TokenController } from './token.controller';
import { TokenService } from './token.service';
import { Request } from 'express';
import { JwtPayload } from '../auth/jwt-payload.interface';

const makeService = () => ({
  requestOtp: jest.fn(),
  verifyOtp: jest.fn(),
  getStatus: jest.fn(),
});

const makeReq = (sub: string) =>
  ({ user: { sub } as JwtPayload }) as Request & { user: JwtPayload };

describe('TokenController', () => {
  let controller: TokenController;
  let service: ReturnType<typeof makeService>;

  beforeEach(() => {
    service = makeService();
    controller = new TokenController(service as unknown as TokenService);
  });

  describe('requestOtp', () => {
    it('delegates to tokenService with user sub and returns result', async () => {
      service.requestOtp.mockResolvedValue({ requestId: 'req-1' });
      const result = await controller.requestOtp(makeReq('sub-1'));
      expect(service.requestOtp).toHaveBeenCalledWith('sub-1');
      expect(result).toEqual({ requestId: 'req-1' });
    });
  });

  describe('verifyOtp', () => {
    it('calls tokenService.verifyOtp and returns success message', async () => {
      service.verifyOtp.mockResolvedValue(undefined);
      const result = await controller.verifyOtp(
        { requestId: 'req-1', otp: '123456' },
        makeReq('sub-1'),
      );
      expect(service.verifyOtp).toHaveBeenCalledWith(
        'req-1',
        '123456',
        'sub-1',
      );
      expect(result).toEqual({ message: 'Token stored successfully' });
    });
  });

  describe('getStatus', () => {
    it('delegates to tokenService.getStatus', async () => {
      const status = { valid: true, expiresAt: new Date(), hoursRemaining: 24 };
      service.getStatus.mockResolvedValue(status);
      const result = await controller.getStatus();
      expect(service.getStatus).toHaveBeenCalled();
      expect(result).toBe(status);
    });
  });
});
