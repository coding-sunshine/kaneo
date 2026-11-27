CREATE TABLE "user_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"job_title" text,
	"department" text,
	"location" text,
	"time_zone" text,
	"status_text" text,
	"status_clears_at" timestamp,
	"out_of_office_from" timestamp,
	"out_of_office_until" timestamp,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;