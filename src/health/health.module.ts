import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenModule } from '../token/token.module';
import { HealthController } from './health.controller';
import { TruecallerTokenHealthIndicator } from './truecaller-token.health';

@Module({
  imports: [TerminusModule, TypeOrmModule, TokenModule],
  controllers: [HealthController],
  providers: [TruecallerTokenHealthIndicator],
})
export class HealthModule {}
