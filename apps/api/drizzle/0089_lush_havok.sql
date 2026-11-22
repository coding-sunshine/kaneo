ALTER TABLE "loop" ALTER COLUMN "frequency" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "loop" ALTER COLUMN "next_run_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "loop" ADD COLUMN "trigger" text DEFAULT 'schedule' NOT NULL;--> statement-breakpoint
ALTER TABLE "loop" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "loop" ADD CONSTRAINT "loop_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;