import { isSmtpConfigured } from "@kaneo/email";
import { eq } from "drizzle-orm";
import db from "../database";
import { emailIntakeTable, projectTable } from "../database/schema";
import { ApiError } from "../errors/api-error";
import { publishEvent } from "../events";
import { ensureTriageColumn } from "../team-automation/ensure-triage-column";
import { readEmailIntakeConfig, teamIntakeAddress } from "./config";
import { createIntakeToken, hashIntakeToken } from "./intake-token";

export function intakeOff() {
  return new ApiError(409, {
    message:
      "Email intake is not set up on this instance. An administrator must add the intake mailbox settings.",
    code: "EMAIL_INTAKE_NOT_CONFIGURED",
  });
}

export async function getTeamIntake(projectId: string) {
  const config = readEmailIntakeConfig();
  const [intake] = await db
    .select({ token: emailIntakeTable.token })
    .from(emailIntakeTable)
    .where(eq(emailIntakeTable.projectId, projectId));
  return {
    available: Boolean(config),
    repliesAvailable: isSmtpConfigured(),
    address: config && intake ? teamIntakeAddress(config, intake.token) : null,
  };
}

/** Gives the team an address and the Triage status its mail is filed into. */
export async function enableTeamIntake(projectId: string) {
  if (!readEmailIntakeConfig()) throw intakeOff();
  await db.transaction(async (tx) => {
    const [project] = await tx
      .select({ id: projectTable.id })
      .from(projectTable)
      .where(eq(projectTable.id, projectId));
    if (!project)
      throw new ApiError(404, { message: "Team not found", code: "NOT_FOUND" });
    await ensureTriageColumn(tx, projectId);
    const token = createIntakeToken();
    await tx
      .insert(emailIntakeTable)
      .values({ projectId, token, tokenHash: hashIntakeToken(token) })
      .onConflictDoNothing({ target: emailIntakeTable.projectId });
  });
  // The team may have gained a Triage status.
  await publishEvent("project.updated", { projectId });
  return getTeamIntake(projectId);
}

/** Mail to the old address is no longer filed; turning intake on again gives a new one. */
export async function disableTeamIntake(projectId: string) {
  await db
    .delete(emailIntakeTable)
    .where(eq(emailIntakeTable.projectId, projectId));
  return getTeamIntake(projectId);
}
