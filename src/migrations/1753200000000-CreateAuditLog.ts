import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLog1753200000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_log" (
        "id"           uuid        NOT NULL DEFAULT gen_random_uuid(),
        "phone_e164"   text        NOT NULL,
        "result_name"  text,
        "cached"       boolean     NOT NULL,
        "duration_ms"  integer     NOT NULL,
        "kc_sub"       text        NOT NULL,
        "kc_client_id" text        NOT NULL,
        "created_at"   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_log" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_log_phone_e164" ON "audit_log" ("phone_e164")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_log_created_at" ON "audit_log" ("created_at")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "audit_log"`);
  }
}
