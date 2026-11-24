CREATE TABLE "pull_request_owner" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"url" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "pull_request_owner_workspace_url_unique" UNIQUE("workspace_id","url")
);
--> statement-breakpoint
ALTER TABLE "pull_request_owner" ADD CONSTRAINT "pull_request_owner_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "pull_request_owner" ADD CONSTRAINT "pull_request_owner_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "pull_request_owner_ownerUserId_idx" ON "pull_request_owner" USING btree ("owner_user_id");