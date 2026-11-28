import { z } from "../../openapi";

const FIELD_MAX = 100;

function isTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// Blank text clears the field: an empty field is not shown.
const optionalText = z
  .string()
  .max(FIELD_MAX)
  .nullable()
  .optional()
  .transform((value) =>
    value === undefined ? undefined : value?.trim() || null,
  );

export const updateProfileBody = z
  .object({
    jobTitle: optionalText,
    department: optionalText,
    location: optionalText,
    timeZone: z
      .string()
      .max(FIELD_MAX)
      .refine((value) => value.trim() === "" || isTimeZone(value.trim()), {
        message: "Unknown time zone",
      })
      .nullable()
      .optional()
      .transform((value) =>
        value === undefined ? undefined : value?.trim() || null,
      )
      .openapi({ description: "An IANA time zone, such as Europe/Berlin." }),
    status: z
      .object({
        text: z.string().trim().min(1).max(FIELD_MAX),
        clearsAt: z.iso
          .datetime({ offset: true })
          .nullable()
          .optional()
          .openapi({
            description:
              "When the status clears itself. Left out, it clears when the out-of-office range sent with it ends, or never.",
          }),
      })
      .nullable()
      .optional(),
    outOfOffice: z
      .object({
        from: z.iso.datetime({ offset: true }),
        until: z.iso.datetime({ offset: true }),
      })
      .refine((range) => new Date(range.from) < new Date(range.until), {
        message: "The out-of-office range must end after it starts",
      })
      .nullable()
      .optional(),
  })
  .openapi("UpdateProfileBody");

export const profileSchema = z
  .object({
    jobTitle: z.string().nullable(),
    department: z.string().nullable(),
    location: z.string().nullable(),
    timeZone: z.string().nullable(),
    status: z
      .object({ text: z.string(), clearsAt: z.string().nullable() })
      .nullable()
      .openapi({ description: "Null once the status has cleared." }),
    outOfOffice: z
      .object({ from: z.string(), until: z.string() })
      .nullable()
      .openapi({ description: "Null once the range has ended." }),
  })
  .openapi("PersonProfile");
