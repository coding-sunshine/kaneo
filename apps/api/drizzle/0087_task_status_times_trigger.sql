-- Linear's workflow timestamps, kept by the database so every writer of
-- task.status (API, bulk edits, imports, integrations) stamps them the same way.
-- Twin of apps/web/src/lib/status-category.ts: columns carry no workflow type,
-- so it is read from the slug, then from is_final.
CREATE FUNCTION task_status_category(project text, status text) RETURNS text AS $$
  SELECT CASE
    WHEN status = 'triage' THEN 'triage'
    WHEN status = 'backlog' THEN 'backlog'
    WHEN status IN ('todo', 'to-do') THEN 'unstarted'
    WHEN status IN ('in-progress', 'in-review') THEN 'started'
    WHEN status = 'done' THEN 'completed'
    WHEN status IN ('canceled', 'cancelled') THEN 'canceled'
    WHEN EXISTS (
      SELECT 1 FROM "column" c
      WHERE c.project_id = project AND c.slug = status AND c.is_final
    ) THEN 'completed'
    ELSE 'started'
  END
$$ LANGUAGE sql STABLE;
--> statement-breakpoint
CREATE FUNCTION task_stamp_status_times() RETURNS trigger AS $$
DECLARE
  stamp timestamp := now() AT TIME ZONE 'utc';
  old_category text;
  new_category text := task_status_category(NEW.project_id, NEW.status);
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Many writes re-send the current status; only a new workflow type counts.
    old_category := task_status_category(OLD.project_id, OLD.status);
    IF new_category = old_category THEN
      RETURN NEW;
    END IF;
  ELSE
    -- Imports bring their own history; keep what the caller supplied.
    stamp := NULL;
  END IF;

  -- started_at survives completion and cancellation, and is cleared when the
  -- issue moves back to triage, backlog or unstarted.
  IF new_category = 'started' THEN
    NEW.started_at := coalesce(NEW.started_at, stamp, now() AT TIME ZONE 'utc');
  ELSIF new_category IN ('triage', 'backlog', 'unstarted') THEN
    NEW.started_at := NULL;
  END IF;

  IF new_category = 'completed' THEN
    NEW.completed_at := coalesce(stamp, NEW.completed_at, now() AT TIME ZONE 'utc');
  ELSE
    NEW.completed_at := NULL;
  END IF;

  -- started_triage_at is the latest entry into triage; triaged_at the latest exit.
  IF new_category = 'triage' THEN
    NEW.started_triage_at := coalesce(stamp, NEW.started_triage_at, now() AT TIME ZONE 'utc');
    NEW.triaged_at := NULL;
  ELSIF old_category = 'triage' THEN
    NEW.triaged_at := stamp;
  END IF;

  RETURN NEW;
END
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER task_stamp_status_times BEFORE INSERT OR UPDATE OF status, project_id ON task
  FOR EACH ROW EXECUTE FUNCTION task_stamp_status_times();
