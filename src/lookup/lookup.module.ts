import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LookupCache } from './entities/lookup-cache.entity';
import { LookupCacheService } from './lookup-cache.service';

@Module({
  imports: [TypeOrmModule.forFeature([LookupCache])],
  providers: [LookupCacheService],
  exports: [LookupCacheService],
})
export class LookupModule {}
