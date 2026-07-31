import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'phone_e164', type: 'text' })
  phoneE164: string;

  @Column({ name: 'result_name', type: 'text', nullable: true })
  resultName: string | null;

  @Column({ type: 'boolean' })
  cached: boolean;

  @Column({ name: 'duration_ms', type: 'integer' })
  durationMs: number;

  @Column({ name: 'kc_sub', type: 'text' })
  kcSub: string;

  @Column({ name: 'kc_client_id', type: 'text' })
  kcClientId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
