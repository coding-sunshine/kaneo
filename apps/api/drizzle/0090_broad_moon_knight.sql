ALTER TABLE "label" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "label" ADD COLUMN "parent_label_id" text;--> statement-breakpoint
ALTER TABLE "label" ADD CONSTRAINT "label_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "label" ADD CONSTRAINT "label_parent_label_id_label_id_fk" FOREIGN KEY ("parent_label_id") REFERENCES "public"."label"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "label_project_id_idx" ON "label" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "label_parent_label_id_idx" ON "label" USING btree ("parent_label_id");