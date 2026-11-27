CREATE TABLE "ai_budget" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"user_daily_tokens" integer,
	"workspace_monthly_tokens" integer,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "workspace_id" text;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "ai_budget" ADD CONSTRAINT "ai_budget_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "ai_usage_workspace_created_at_idx" ON "ai_usage" USING btree ("workspace_id","created_at");