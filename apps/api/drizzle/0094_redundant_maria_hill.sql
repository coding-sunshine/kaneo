CREATE TABLE "project_triage_responsible" (
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"last_assigned_at" timestamp,
	CONSTRAINT "project_triage_responsible_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "sla_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "sla_urgent_hours" integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "sla_high_hours" integer DEFAULT 168 NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "triage_responsibility_mode" text DEFAULT 'notify' NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "sla_due_at" timestamp;--> statement-breakpoint
ALTER TABLE "project_triage_responsible" ADD CONSTRAINT "project_triage_responsible_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_triage_responsible" ADD CONSTRAINT "project_triage_responsible_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;