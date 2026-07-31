import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { LookupService } from './lookup.service';
import { LookupQueryDto } from './dto/lookup-query.dto';
import { LookupResponseDto } from './dto/lookup-response.dto';
import { JwtPayload } from '../auth/jwt-payload.interface';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@Controller('lookup')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('lookup')
export class LookupController {
  constructor(private readonly lookupService: LookupService) {}

  @Get()
  lookup(
    @Query() query: LookupQueryDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<LookupResponseDto> {
    const { sub, azp } = req.user;
    return this.lookupService.lookup(query.phone, sub, azp);
  }
}
