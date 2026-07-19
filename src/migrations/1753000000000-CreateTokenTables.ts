import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTokenTables1753000000000 implements MigrationInterface {
  name = 'CreateTokenTables1753000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tc_tokens" (
        "id"                   uuid        NOT NULL DEFAULT gen_random_uuid(),
        "installation_id_enc"  text        NOT NULL,
        "expires_at"           TIMESTAMPTZ NOT NULL,
        "created_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tc_tokens" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "token_events" (
        "id"          uuid        NOT NULL DEFAULT gen_random_uuid(),
        "event_type"  text        NOT NULL,
        "kc_sub"      text,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_token_events" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "token_events"`);
    await queryRunner.query(`DROP TABLE "tc_tokens"`);
  }
}
