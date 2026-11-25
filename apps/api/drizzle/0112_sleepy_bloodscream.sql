CREATE TABLE "statement_conflict" (
	"pair_hash" text PRIMARY KEY NOT NULL,
	"slot_id" text NOT NULL,
	"document_id" text NOT NULL,
	"against_document_id" text NOT NULL,
	"decision" text NOT NULL,
	"reason" text NOT NULL,
	"tolerate_until" timestamp,
	"decided_by" text,
	"decided_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "statement_conflict_tolerate_has_date" CHECK ("statement_conflict"."decision" <> 'tolerate' OR "statement_conflict"."tolerate_until" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "statement_conflict" ADD CONSTRAINT "statement_conflict_slot_id_topic_slot_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."topic_slot"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "statement_conflict" ADD CONSTRAINT "statement_conflict_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "statement_conflict" ADD CONSTRAINT "statement_conflict_against_document_id_document_id_fk" FOREIGN KEY ("against_document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "statement_conflict" ADD CONSTRAINT "statement_conflict_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "statement_conflict_document_idx" ON "statement_conflict" USING btree ("document_id");