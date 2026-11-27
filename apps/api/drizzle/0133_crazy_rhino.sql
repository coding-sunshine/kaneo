CREATE TABLE "receipt_ticket" (
	"document_id" text NOT NULL,
	"suggestion_key" text NOT NULL,
	"task_id" text,
	"accepted_by" text,
	"accepted_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "receipt_ticket_document_id_suggestion_key_pk" PRIMARY KEY("document_id","suggestion_key")
);
--> statement-breakpoint
ALTER TABLE "receipt_ticket" ADD CONSTRAINT "receipt_ticket_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "receipt_ticket" ADD CONSTRAINT "receipt_ticket_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "receipt_ticket" ADD CONSTRAINT "receipt_ticket_accepted_by_user_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;