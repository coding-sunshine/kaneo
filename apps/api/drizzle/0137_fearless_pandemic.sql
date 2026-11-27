ALTER TABLE "cycle" ADD COLUMN "summary_completed" integer;--> statement-breakpoint
ALTER TABLE "cycle" ADD COLUMN "summary_added_after_start" integer;--> statement-breakpoint
ALTER TABLE "cycle" ADD COLUMN "summary_carried_over" integer;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "cycle_added_at" timestamp;