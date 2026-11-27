import type { FetchLike } from "@kaneo/importers";
import { Agent, fetch, type RequestInit as UndiciRequestInit } from "undici";
import { blockedDestinationError } from "../../import/blocked-destination-error";
import { createDestinationLookup } from "../../import/destination-lookup";
import { isDisallowedAddress } from "../../utils/assert-public-destination";

// Any member can make the server fetch a link they paste, so private
// addresses stay out even where operators let webhooks reach them. The socket
// lookup checks every DNS answer, so a host cannot rebind after a preflight.
const agent = new Agent({
  connect: { lookup: createDestinationLookup(undefined, () => false) },
});

export const previewFetch: FetchLike = async (input, init) => {
  // Literal addresses never reach the socket lookup.
  if (isDisallowedAddress(new URL(input).hostname))
    throw blockedDestinationError();
  const response = await fetch(input, {
    ...(init as UndiciRequestInit),
    dispatcher: agent,
  });
  return response as unknown as Response;
};
