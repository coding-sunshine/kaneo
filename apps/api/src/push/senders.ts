import { createApnsSender } from "./apns";
import type { PushPlatform } from "./devices";
import { createFcmSender } from "./fcm";
import { logPushOffOnce, readApnsConfig, readFcmConfig } from "./push-config";
import type { PushSender } from "./push-message";

// Senders hold a connection and a token, so one per configuration is kept.
const cache = new Map<string, PushSender>();

function cached<T>(
  platform: PushPlatform,
  config: T,
  make: (config: T) => PushSender,
) {
  const key = `${platform}:${JSON.stringify(config)}`;
  let sender = cache.get(key);
  if (!sender) {
    for (const old of cache.keys())
      if (old.startsWith(`${platform}:`)) cache.delete(old);
    sender = make(config);
    cache.set(key, sender);
  }
  return sender;
}

/** The sender for a platform, or null (and a log line once) while its key is missing. */
export function pushSender(platform: PushPlatform): PushSender | null {
  if (platform === "ios") {
    const config = readApnsConfig();
    if (config) return cached(platform, config, createApnsSender);
  } else {
    const config = readFcmConfig();
    if (config) return cached(platform, config, createFcmSender);
  }
  logPushOffOnce(platform);
  return null;
}
