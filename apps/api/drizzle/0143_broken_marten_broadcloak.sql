CREATE TABLE "onboarding_checklist" (
	"user_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"handbook_document_id" text,
	"welcome_channel_id" text,
	"sample_task_id" text,
	"completed_items" text[] DEFAULT '{}'::text[] NOT NULL,
	"seeded_at" timestamp,
	"dismissed_at" timestamp,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "onboarding_checklist" ADD CONSTRAINT "onboarding_checklist_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_checklist" ADD CONSTRAINT "onboarding_checklist_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_checklist" ADD CONSTRAINT "onboarding_checklist_handbook_document_id_document_id_fk" FOREIGN KEY ("handbook_document_id") REFERENCES "public"."document"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_checklist" ADD CONSTRAINT "onboarding_checklist_welcome_channel_id_chat_channel_id_fk" FOREIGN KEY ("welcome_channel_id") REFERENCES "public"."chat_channel"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_checklist" ADD CONSTRAINT "onboarding_checklist_sample_task_id_task_id_fk" FOREIGN KEY ("sample_task_id") REFERENCES "public"."task"("id") ON DELETE set null ON UPDATE no action;