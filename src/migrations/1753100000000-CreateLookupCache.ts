import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLookupCache1753100000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "lookup_cache" (
        "id"          uuid        NOT NULL DEFAULT gen_random_uuid(),
        "phoneE164"   text        NOT NULL,
        "result"      jsonb       NOT NULL,
        "expiresAt"   timestamptz NOT NULL,
        "createdAt"   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lookup_cache" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_lookup_cache_phone" UNIQUE ("phoneE164")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_lookup_cache_expiresAt" ON "lookup_cache" ("expiresAt")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "lookup_cache"`);
  }
}
