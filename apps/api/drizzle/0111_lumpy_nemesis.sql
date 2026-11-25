CREATE TABLE "document_extraction" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"content_hash" text NOT NULL,
	"slots_hash" text NOT NULL,
	"prompt_version" integer NOT NULL,
	"model" text NOT NULL,
	"readable" boolean NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statement" (
	"id" text PRIMARY KEY NOT NULL,
	"slot_id" text NOT NULL,
	"document_id" text NOT NULL,
	"value" text NOT NULL,
	"normalized" text NOT NULL,
	"quote" text NOT NULL,
	"quote_start" integer NOT NULL,
	"content_hash" text NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"status_reason" text,
	"source" text NOT NULL,
	"decided_by" text,
	"decided_at" timestamp,
	"created_by" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "statement_rejected_has_reason" CHECK ("statement"."status" <> 'rejected' OR "statement"."status_reason" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "topic_slot" (
	"id" text PRIMARY KEY NOT NULL,
	"topic_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"options" text[],
	"created_by" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_extraction" ADD CONSTRAINT "document_extraction_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "statement" ADD CONSTRAINT "statement_slot_id_topic_slot_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."topic_slot"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "statement" ADD CONSTRAINT "statement_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "statement" ADD CONSTRAINT "statement_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "statement" ADD CONSTRAINT "statement_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "topic_slot" ADD CONSTRAINT "topic_slot_topic_id_topic_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topic"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "topic_slot" ADD CONSTRAINT "topic_slot_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "document_extraction_uidx" ON "document_extraction" USING btree ("document_id","content_hash","slots_hash","prompt_version","model");--> statement-breakpoint
CREATE INDEX "statement_document_idx" ON "statement" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "statement_slot_document_hash_uidx" ON "statement" USING btree ("slot_id","document_id","content_hash") WHERE "statement"."status" <> 'rejected';--> statement-breakpoint
CREATE UNIQUE INDEX "topic_slot_topic_key_uidx" ON "topic_slot" USING btree ("topic_id","key");