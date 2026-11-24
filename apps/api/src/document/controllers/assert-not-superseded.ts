import { HTTPException } from "hono/http-exception";
import type { DocumentStatus } from "../../database/schema";

// A superseded document is the record of what was once current.
export function assertNotSuperseded(doc: { status: DocumentStatus }) {
  if (doc.status === "superseded") {
    throw new HTTPException(409, {
      message: "A superseded document cannot be changed",
    });
  }
}
