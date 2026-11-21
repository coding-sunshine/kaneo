ALTER TABLE "task" ADD COLUMN "started_at" timestamp;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "started_triage_at" timestamp;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "triaged_at" timestamp;