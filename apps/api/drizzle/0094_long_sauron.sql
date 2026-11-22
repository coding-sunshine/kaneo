CREATE TABLE "passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc'),
	"aaguid" text
);
--> statement-breakpoint
ALTER TABLE "user_notification_preference" ADD COLUMN "schedule_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preference" ADD COLUMN "schedule_timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preference" ADD COLUMN "schedule_days" integer[] DEFAULT '{1,2,3,4,5}'::integer[] NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preference" ADD COLUMN "schedule_start" text DEFAULT '09:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preference" ADD COLUMN "schedule_end" text DEFAULT '18:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "passkey_userId_idx" ON "passkey" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "passkey_credentialID_idx" ON "passkey" USING btree ("credential_id");