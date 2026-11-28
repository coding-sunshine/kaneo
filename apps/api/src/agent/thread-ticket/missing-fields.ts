import { and, eq } from "drizzle-orm";
import db from "../../database";
import { customFieldDefinitionTable } from "../../database/schema";
import { isCustomFieldValueEmpty } from "../../task/validate-task-fields";

export type FieldValue = { fieldId: string; value: string };
type FieldType = Parameters<typeof isCustomFieldValueEmpty>[1];

/**
 * The team's required fields a new ticket has no value for: no default to
 * fall back on, as the IT intake's Category, and none among `given`. The
 * person accepting a thread ticket is asked for these.
 */
export async function missingTicketFields(
  projectId: string,
  given: FieldValue[] = [],
) {
  const fields = await db
    .select({
      id: customFieldDefinitionTable.id,
      name: customFieldDefinitionTable.name,
      type: customFieldDefinitionTable.type,
      defaultValue: customFieldDefinitionTable.defaultValue,
    })
    .from(customFieldDefinitionTable)
    .where(
      and(
        eq(customFieldDefinitionTable.projectId, projectId),
        eq(customFieldDefinitionTable.required, true),
      ),
    )
    .orderBy(customFieldDefinitionTable.position);
  const empty = (value: string | null | undefined, type: string) =>
    value == null || isCustomFieldValueEmpty(value, type as FieldType);
  return fields.filter(
    (field) =>
      empty(field.defaultValue, field.type) &&
      empty(
        given.find((value) => value.fieldId === field.id)?.value,
        field.type,
      ),
  );
}
