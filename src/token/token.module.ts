import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TcToken } from './entities/tc-token.entity';
import { TokenEvent } from './entities/token-event.entity';
import { TokenController } from './token.controller';
import { TokenScheduler } from './token.scheduler';
import { TokenService } from './token.service';

@Module({
  imports: [TypeOrmModule.forFeature([TcToken, TokenEvent])],
  controllers: [TokenController],
  providers: [TokenService, TokenScheduler],
  exports: [TokenService],
})
export class TokenModule {}
