import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('tc_tokens')
export class TcToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'installation_id_enc', type: 'text' })
  installationIdEnc: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
