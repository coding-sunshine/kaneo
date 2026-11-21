CREATE TABLE "project_member_preference" (
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"left_at" timestamp,
	"notify_issue_added" boolean DEFAULT false NOT NULL,
	"notify_issue_closed" boolean DEFAULT false NOT NULL,
	"notify_issue_triage" boolean DEFAULT false NOT NULL,
	CONSTRAINT "project_member_preference_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "project_member_preference" ADD CONSTRAINT "project_member_preference_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_member_preference" ADD CONSTRAINT "project_member_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "project_member_preference_user_idx" ON "project_member_preference" USING btree ("user_id");