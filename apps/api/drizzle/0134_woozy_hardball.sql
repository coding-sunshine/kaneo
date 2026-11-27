CREATE TABLE "calendar_connection" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"account_email" text,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp,
	"time_zone" text DEFAULT 'UTC' NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "calendar_connection_user_provider_unique" UNIQUE("user_id","provider")
);
--> statement-breakpoint
CREATE TABLE "calendar_task_event" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"task_id" text NOT NULL,
	"external_event_id" text NOT NULL,
	"fingerprint" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "calendar_task_event_connection_task_unique" UNIQUE("connection_id","task_id")
);
--> statement-breakpoint
ALTER TABLE "calendar_connection" ADD CONSTRAINT "calendar_connection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_task_event" ADD CONSTRAINT "calendar_task_event_connection_id_calendar_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."calendar_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_task_event_task_id_idx" ON "calendar_task_event" USING btree ("task_id");