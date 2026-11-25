CREATE TABLE "document_lineage" (
	"document_id" text PRIMARY KEY NOT NULL,
	"source_document_id" text NOT NULL,
	"overlap" integer NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"decided_by" text,
	"decided_at" timestamp,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "fingerprint" integer[];--> statement-breakpoint
ALTER TABLE "document_lineage" ADD CONSTRAINT "document_lineage_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document_lineage" ADD CONSTRAINT "document_lineage_source_document_id_document_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document_lineage" ADD CONSTRAINT "document_lineage_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "document_lineage_source_idx" ON "document_lineage" USING btree ("source_document_id");--> statement-breakpoint
-- The API writes document.fingerprint together with the text. A writer that
-- changes the text past the API (imports, sync scripts) would leave the old
-- fingerprint behind, so the database clears it there and the next comparison
-- fills it in again.
CREATE FUNCTION document_fingerprint_stale() RETURNS trigger AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content
    AND NEW.fingerprint IS NOT DISTINCT FROM OLD.fingerprint THEN
    NEW.fingerprint := NULL;
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER document_fingerprint_stale BEFORE UPDATE OF content ON "document"
  FOR EACH ROW EXECUTE FUNCTION document_fingerprint_stale();
