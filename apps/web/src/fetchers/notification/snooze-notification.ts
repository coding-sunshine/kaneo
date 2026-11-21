import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function snoozeNotification(id: string, until: Date | null) {
  const response = await client.notification[":id"].snooze.$patch({
    param: { id },
    json: { until: until?.toISOString() ?? null },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default snoozeNotification;
