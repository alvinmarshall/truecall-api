import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

export interface AuditEntry {
  phoneE164: string;
  resultName: string | null;
  cached: boolean;
  durationMs: number;
  kcSub: string;
  kcClientId: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  write(entry: AuditEntry): void {
    setImmediate(() => {
      this.repo.insert(entry).catch(() => undefined);
    });
  }
}
