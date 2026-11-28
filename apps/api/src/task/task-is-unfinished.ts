import { sql } from "drizzle-orm";
import { columnTable, taskTable } from "../database/schema";
import { taskIsCompleted } from "./task-is-completed";

// Open work: the task's own column is not final, or, outside a column, its
// status is not a final one.
export const taskIsUnfinished = sql<boolean>`not coalesce((
  select ${columnTable.isFinal} from ${columnTable}
  where ${columnTable.id} = ${taskTable.columnId}
    and ${columnTable.projectId} = ${taskTable.projectId}
), ${taskIsCompleted})`;
