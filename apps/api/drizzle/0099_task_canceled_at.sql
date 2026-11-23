ALTER TABLE "task" ADD COLUMN "canceled_at" timestamp;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION task_stamp_status_times()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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

  -- canceled_at mirrors completed_at for the canceled category.
  IF new_category = 'canceled' THEN
    NEW.canceled_at := coalesce(stamp, NEW.canceled_at, now() AT TIME ZONE 'utc');
  ELSE
    NEW.canceled_at := NULL;
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
$function$;
