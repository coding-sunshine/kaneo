import { userProfileTable } from "../../database/schema";

export const profileColumns = {
  jobTitle: userProfileTable.jobTitle,
  department: userProfileTable.department,
  location: userProfileTable.location,
  timeZone: userProfileTable.timeZone,
  statusText: userProfileTable.statusText,
  statusClearsAt: userProfileTable.statusClearsAt,
  outOfOfficeFrom: userProfileTable.outOfOfficeFrom,
  outOfOfficeUntil: userProfileTable.outOfOfficeUntil,
};
