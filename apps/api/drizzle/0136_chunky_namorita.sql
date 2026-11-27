CREATE TABLE "task_design_review" (
	"task_id" text NOT NULL,
	"reviewer_id" text NOT NULL,
	"requester_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"resolved_at" timestamp,
	CONSTRAINT "task_design_review_task_id_reviewer_id_pk" PRIMARY KEY("task_id","reviewer_id")
);
--> statement-breakpoint
ALTER TABLE "task_design_review" ADD CONSTRAINT "task_design_review_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_design_review" ADD CONSTRAINT "task_design_review_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_design_review" ADD CONSTRAINT "task_design_review_requester_id_user_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "task_design_review_reviewer_status_idx" ON "task_design_review" USING btree ("reviewer_id","status");