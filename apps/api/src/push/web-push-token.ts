export type WebPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/**
 * A browser subscription stored as a push_device token. The server writes it
 * in one fixed shape, so registering and removing the same subscription
 * always meet the same row.
 */
export function webPushToken({ endpoint, keys }: WebPushSubscription) {
  return JSON.stringify({ endpoint, p256dh: keys.p256dh, auth: keys.auth });
}

export function parseWebPushToken(token: string) {
  try {
    const { endpoint, p256dh, auth } = JSON.parse(token);
    if ([endpoint, p256dh, auth].every((part) => typeof part === "string"))
      return { endpoint, p256dh, auth } as {
        endpoint: string;
        p256dh: string;
        auth: string;
      };
  } catch {
    /* Not a browser subscription. */
  }
  return null;
}
