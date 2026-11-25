CREATE TABLE "document_file" (
	"asset_id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"original_name" text NOT NULL,
	"source_client" text,
	"source_user_id" text,
	"source_url" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "document_id" text;--> statement-breakpoint
ALTER TABLE "document_file" ADD CONSTRAINT "document_file_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document_file" ADD CONSTRAINT "document_file_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document_file" ADD CONSTRAINT "document_file_source_user_id_user_id_fk" FOREIGN KEY ("source_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "document_file_document_idx" ON "document_file" USING btree ("document_id");--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "asset_documentId_idx" ON "asset" USING btree ("document_id");--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_one_owner" CHECK (("asset"."project_id" IS NOT NULL) <> ("asset"."document_id" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_document_file_unattached" CHECK ("asset"."document_id" IS NULL OR num_nonnulls("asset"."task_id", "asset"."activity_id") = 0);
