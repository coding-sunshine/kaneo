export type OutOfOffice = { from: string; until: string };

export type PersonProfile = {
  jobTitle: string | null;
  department: string | null;
  location: string | null;
  timeZone: string | null;
  status: { text: string; clearsAt: string | null } | null;
  outOfOffice: OutOfOffice | null;
};
