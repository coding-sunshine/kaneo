CREATE TABLE "task_extraction" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"asset_id" text,
	"content_hash" text NOT NULL,
	"slots_hash" text NOT NULL,
	"prompt_version" integer NOT NULL,
	"model" text NOT NULL,
	"readable" boolean NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "task_extraction_uidx" UNIQUE NULLS NOT DISTINCT("task_id","asset_id","content_hash","slots_hash","prompt_version","model")
);
--> statement-breakpoint
CREATE TABLE "task_statement" (
	"id" text PRIMARY KEY NOT NULL,
	"slot_id" text NOT NULL,
	"task_id" text NOT NULL,
	"asset_id" text,
	"value" text NOT NULL,
	"normalized" text NOT NULL,
	"quote" text NOT NULL,
	"dismissed_by" text,
	"dismissed_at" timestamp,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "task_statement_uidx" UNIQUE NULLS NOT DISTINCT("slot_id","task_id","asset_id","normalized")
);
--> statement-breakpoint
ALTER TABLE "task_extraction" ADD CONSTRAINT "task_extraction_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_extraction" ADD CONSTRAINT "task_extraction_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_statement" ADD CONSTRAINT "task_statement_slot_id_topic_slot_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."topic_slot"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_statement" ADD CONSTRAINT "task_statement_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_statement" ADD CONSTRAINT "task_statement_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_statement" ADD CONSTRAINT "task_statement_dismissed_by_user_id_fk" FOREIGN KEY ("dismissed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "task_statement_task_idx" ON "task_statement" USING btree ("task_id");