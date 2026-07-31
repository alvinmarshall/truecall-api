import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LookupCache } from './entities/lookup-cache.entity';
import { AuditLog } from './entities/audit-log.entity';
import { LookupCacheService } from './lookup-cache.service';
import { AuditService } from './audit.service';
import { TruecallerService } from './truecaller.service';
import { LookupService } from './lookup.service';
import { LookupController } from './lookup.controller';
import { TokenModule } from '../token/token.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LookupCache, AuditLog]),
    TokenModule,
  ],
  providers: [LookupCacheService, AuditService, TruecallerService, LookupService],
  controllers: [LookupController],
})
export class LookupModule {}
