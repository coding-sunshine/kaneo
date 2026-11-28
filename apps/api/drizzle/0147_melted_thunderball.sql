CREATE TABLE "document_collab_state" (
	"document_id" text PRIMARY KEY NOT NULL,
	"state" "bytea" NOT NULL,
	"seeded_hash" text NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_collab_state" ADD CONSTRAINT "document_collab_state_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE cascade;