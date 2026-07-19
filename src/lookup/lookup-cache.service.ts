import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LookupCache } from './entities/lookup-cache.entity';

@Injectable()
export class LookupCacheService {
  constructor(
    @InjectRepository(LookupCache)
    private readonly repo: Repository<LookupCache>,
    private readonly config: ConfigService,
  ) {}

  async get(phoneE164: string): Promise<Record<string, unknown> | null> {
    const entry = await this.repo.findOne({ where: { phoneE164 } });
    if (!entry || entry.expiresAt < new Date()) return null;
    return entry.result;
  }

  async set(phoneE164: string, result: Record<string, unknown>): Promise<void> {
    const ttl = this.config.get<number>('CACHE_TTL_SECONDS') ?? 86_400;
    const expiresAt = new Date(Date.now() + ttl * 1_000);
    await this.repo.upsert(
      { phoneE164, result: result as object, expiresAt },
      ['phoneE164'],
    );
  }

  async invalidate(phoneE164: string): Promise<void> {
    await this.repo.delete({ phoneE164 });
  }
}
