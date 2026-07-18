import { MigrationInterface, QueryRunner } from "typeorm";

export class Baseline1784357488932 implements MigrationInterface {
    name = 'Baseline1784357488932'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" SERIAL NOT NULL, "email" character varying NOT NULL, "password" character varying NOT NULL, "name" character varying(100) NOT NULL, "role" character varying NOT NULL DEFAULT 'admin', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tags" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "type" character varying(50) NOT NULL, "description" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_d90243459a697eadb8ad56e9092" UNIQUE ("name"), CONSTRAINT "PK_e7dc17249a1148a1970748eda99" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "research" ("id" SERIAL NOT NULL, "title" character varying(500) NOT NULL, "authors" text array, "year" integer, "abstract" text, "summary" text, "keywords" text array, "domains" character varying array, "pdf_url" character varying(500), "source_url" character varying(500), "source" character varying(200), "region" character varying(10) NOT NULL DEFAULT 'KR', "is_featured" boolean NOT NULL DEFAULT false, "view_count" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_be0614c6e72bbe071af7b1b3586" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "assessment_cells" ("id" SERIAL NOT NULL, "document_id" integer NOT NULL, "domain" character varying(5) NOT NULL, "policy_axis" character varying(5) NOT NULL, "label" character varying(20) NOT NULL, "note" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_2a26fceb7a6b8fd2b09bd15f7c1" UNIQUE ("document_id", "domain", "policy_axis"), CONSTRAINT "PK_c555f13f09ca75165948f0858d5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "documents" ("id" SERIAL NOT NULL, "title" character varying(500) NOT NULL, "country" character varying(100) NOT NULL, "year" integer, "description" text, "summary" text, "pdf_url" character varying(500), "source_url" character varying(500), "source" character varying(200), "region" character varying(10) NOT NULL DEFAULT 'KR', "is_featured" boolean NOT NULL DEFAULT false, "view_count" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ac51aa5181ee2036f5ca482857c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "recovery_resources" ("id" SERIAL NOT NULL, "name" character varying(300) NOT NULL, "type" character varying(20) NOT NULL, "description" text, "address" character varying(500), "city" character varying(100), "region" character varying(10) NOT NULL DEFAULT 'KR', "phone" character varying(50), "email" character varying(255), "website" character varying(500), "operating_hours" character varying(200), "domains" character varying array, "is_verified" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cf1ed9d596e2ca3b8ca957104e6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "sources" ("id" text NOT NULL, "org" text NOT NULL, "org_ko" text NOT NULL, "domain" text NOT NULL, "scope" text NOT NULL, "kind" text NOT NULL, "title_ko" text NOT NULL, "title_en" text NOT NULL, "url" text NOT NULL, "access_method" text NOT NULL, "access_detail" jsonb, "cadence" text NOT NULL, "expected_month" integer array, "last_checked_at" TIMESTAMP WITH TIME ZONE, "last_published_at" date, "next_expected_at" date, "status" text NOT NULL DEFAULT 'active', "license" text, "reliability" integer, "etag" text, "last_modified" text, "content_hash" text, "fail_count" integer NOT NULL DEFAULT '0', "notes" text, CONSTRAINT "PK_85523beafe5a2a6b90b02096443" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "research_tags" ("research_id" integer NOT NULL, "tag_id" integer NOT NULL, CONSTRAINT "PK_28a9d876257ff50af9c807340af" PRIMARY KEY ("research_id", "tag_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3829648c43566c8028e08948ed" ON "research_tags" ("research_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_daec4df95416dbb377864b1ff9" ON "research_tags" ("tag_id") `);
        await queryRunner.query(`CREATE TABLE "document_tags" ("document_id" integer NOT NULL, "tag_id" integer NOT NULL, CONSTRAINT "PK_c36049ad0ab1c45dc8d50e67da2" PRIMARY KEY ("document_id", "tag_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fc0f5a43d732de92c3bb645b10" ON "document_tags" ("document_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_711914f4d14fa90af5c780eee8" ON "document_tags" ("tag_id") `);
        await queryRunner.query(`CREATE TABLE "recovery_resource_tags" ("resource_id" integer NOT NULL, "tag_id" integer NOT NULL, CONSTRAINT "PK_aed353f2371c82960467dea336a" PRIMARY KEY ("resource_id", "tag_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a845fdd3deace98da57b741ce0" ON "recovery_resource_tags" ("resource_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_0db91a56ff2cbbdb4099208b7a" ON "recovery_resource_tags" ("tag_id") `);
        await queryRunner.query(`ALTER TABLE "assessment_cells" ADD CONSTRAINT "FK_13dd1e2a63fbe550aa43a60489d" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "research_tags" ADD CONSTRAINT "FK_3829648c43566c8028e08948ed6" FOREIGN KEY ("research_id") REFERENCES "research"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "research_tags" ADD CONSTRAINT "FK_daec4df95416dbb377864b1ff9a" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "document_tags" ADD CONSTRAINT "FK_fc0f5a43d732de92c3bb645b105" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "document_tags" ADD CONSTRAINT "FK_711914f4d14fa90af5c780eee85" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "recovery_resource_tags" ADD CONSTRAINT "FK_a845fdd3deace98da57b741ce02" FOREIGN KEY ("resource_id") REFERENCES "recovery_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "recovery_resource_tags" ADD CONSTRAINT "FK_0db91a56ff2cbbdb4099208b7ad" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "recovery_resource_tags" DROP CONSTRAINT "FK_0db91a56ff2cbbdb4099208b7ad"`);
        await queryRunner.query(`ALTER TABLE "recovery_resource_tags" DROP CONSTRAINT "FK_a845fdd3deace98da57b741ce02"`);
        await queryRunner.query(`ALTER TABLE "document_tags" DROP CONSTRAINT "FK_711914f4d14fa90af5c780eee85"`);
        await queryRunner.query(`ALTER TABLE "document_tags" DROP CONSTRAINT "FK_fc0f5a43d732de92c3bb645b105"`);
        await queryRunner.query(`ALTER TABLE "research_tags" DROP CONSTRAINT "FK_daec4df95416dbb377864b1ff9a"`);
        await queryRunner.query(`ALTER TABLE "research_tags" DROP CONSTRAINT "FK_3829648c43566c8028e08948ed6"`);
        await queryRunner.query(`ALTER TABLE "assessment_cells" DROP CONSTRAINT "FK_13dd1e2a63fbe550aa43a60489d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0db91a56ff2cbbdb4099208b7a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a845fdd3deace98da57b741ce0"`);
        await queryRunner.query(`DROP TABLE "recovery_resource_tags"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_711914f4d14fa90af5c780eee8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fc0f5a43d732de92c3bb645b10"`);
        await queryRunner.query(`DROP TABLE "document_tags"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_daec4df95416dbb377864b1ff9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3829648c43566c8028e08948ed"`);
        await queryRunner.query(`DROP TABLE "research_tags"`);
        await queryRunner.query(`DROP TABLE "sources"`);
        await queryRunner.query(`DROP TABLE "recovery_resources"`);
        await queryRunner.query(`DROP TABLE "documents"`);
        await queryRunner.query(`DROP TABLE "assessment_cells"`);
        await queryRunner.query(`DROP TABLE "research"`);
        await queryRunner.query(`DROP TABLE "tags"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
