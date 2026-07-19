import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Roles } from '../auth/roles.decorator';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { TokenService } from './token.service';

@Controller('admin/token')
@Roles('admin')
export class TokenController {
  constructor(private readonly tokenService: TokenService) {}

  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  requestOtp(@Req() req: Request & { user: JwtPayload }) {
    return this.tokenService.requestOtp(req.user.sub);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    await this.tokenService.verifyOtp(dto.requestId, dto.otp, req.user.sub);
    return { message: 'Token stored successfully' };
  }

  @Get('status')
  getStatus() {
    return this.tokenService.getStatus();
  }
}
