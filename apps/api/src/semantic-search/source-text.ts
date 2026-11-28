import { sql } from "drizzle-orm";
import { chatMessageTable, documentTable, taskTable } from "../database/schema";

// The text embedded for each kind of source, cut to what one embedding call
// takes, and its md5 to tell when the source changed.
const MAX = sql.raw("8000");
export const messageText = sql<string>`left(${chatMessageTable.body}, ${MAX})`;
export const taskText = sql<string>`left(${taskTable.title} || E'\\n' || coalesce(${taskTable.description}, ''), ${MAX})`;
export const documentText = sql<string>`left(${documentTable.title} || E'\\n' || ${documentTable.content}, ${MAX})`;
export const md5 = (text: typeof messageText) => sql<string>`md5(${text})`;
