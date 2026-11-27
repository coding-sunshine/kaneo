CREATE TABLE "email_intake_failure" (
	"uid" text PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"last_failed_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_intake_message" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"task_id" text NOT NULL,
	"message_id" text NOT NULL,
	"direction" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"address" text NOT NULL,
	"name" text,
	"subject" text NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "email_intake_message_project_message_unique" UNIQUE("project_id","message_id")
);
--> statement-breakpoint
CREATE TABLE "email_intake" (
	"project_id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "email_intake_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "email_intake_message" ADD CONSTRAINT "email_intake_message_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "email_intake_message" ADD CONSTRAINT "email_intake_message_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "email_intake" ADD CONSTRAINT "email_intake_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "email_intake_message_task_idx" ON "email_intake_message" USING btree ("task_id");