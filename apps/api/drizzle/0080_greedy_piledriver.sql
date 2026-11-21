CREATE TABLE "comment_reaction" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" text NOT NULL,
	"user_id" text NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "comment_reaction_activity_user_emoji_unique" UNIQUE("activity_id","user_id","emoji")
);
--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "parent_id" text;--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "resolved_at" timestamp;--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "resolved_by_user_id" text;--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "resolving_comment_id" text;--> statement-breakpoint
ALTER TABLE "comment_reaction" ADD CONSTRAINT "comment_reaction_activity_id_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_reaction" ADD CONSTRAINT "comment_reaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comment_reaction_activity_id_idx" ON "comment_reaction" USING btree ("activity_id");--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_resolved_by_user_id_user_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_parent_id_activity_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_resolving_comment_id_activity_id_fk" FOREIGN KEY ("resolving_comment_id") REFERENCES "public"."activity"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_parent_id_idx" ON "activity" USING btree ("parent_id");