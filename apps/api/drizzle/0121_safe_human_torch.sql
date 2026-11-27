CREATE TABLE "task_extraction_progress" (
	"key" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"asset_id" text,
	"next" integer NOT NULL,
	"readable" boolean NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_extraction_progress" ADD CONSTRAINT "task_extraction_progress_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_extraction_progress" ADD CONSTRAINT "task_extraction_progress_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE cascade ON UPDATE cascade;