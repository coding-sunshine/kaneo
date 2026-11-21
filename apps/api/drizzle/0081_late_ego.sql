CREATE TABLE "comment_thread_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" text NOT NULL,
	"user_id" text NOT NULL,
	"subscribed" boolean NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "comment_thread_subscription_activity_user_unique" UNIQUE("activity_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "comment_thread_subscription" ADD CONSTRAINT "comment_thread_subscription_activity_id_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_thread_subscription" ADD CONSTRAINT "comment_thread_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;