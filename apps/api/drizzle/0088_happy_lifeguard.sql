ALTER TABLE "project" ADD COLUMN "estimate_type" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "estimate_extended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "estimate_allow_zero" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "estimate_count_unestimated" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "estimate" integer;