import { z } from "../openapi";
import { privateDestinationsAllowed } from "../utils/assert-public-destination";

const nativeToken = z.string().trim().min(1).max(4096);
const base64url = (bytes: number, first?: number) =>
  z
    .string()
    .regex(/^[A-Za-z0-9_-]+=*$/)
    .refine((value) => {
      const raw = Buffer.from(value, "base64url");
      return raw.length === bytes && (first === undefined || raw[0] === first);
    }, `Must be ${bytes} bytes, base64url`);

// Push services are public https hosts. Plain http is only for a dev setup
// that already allows private destinations.
const pushEndpoint = z
  .string()
  .url()
  .max(2048)
  .refine((value) => {
    const { protocol } = new URL(value);
    return (
      protocol === "https:" ||
      (protocol === "http:" && privateDestinationsAllowed())
    );
  }, "The push endpoint must use https");

const subscription = (endpoint: z.ZodType<string>) =>
  z
    .object({
      endpoint,
      keys: z.object({
        p256dh: base64url(65, 4),
        auth: base64url(16),
      }),
    })
    .openapi({
      description: "The browser's PushSubscription, as its toJSON() gives it.",
    });

export const registerDeviceBody = z.discriminatedUnion("platform", [
  z.object({
    platform: z.enum(["ios", "android"]),
    token: nativeToken.openapi({
      description: "The native APNs device token or FCM registration token.",
    }),
  }),
  z.object({
    platform: z.literal("web"),
    subscription: subscription(pushEndpoint),
  }),
]);

export const unregisterDeviceBody = z.union([
  z.object({ token: nativeToken }),
  z.object({ subscription: subscription(z.string().max(2048)) }),
]);

export const webPushKeySchema = z
  .object({
    publicKey: z.string().nullable().openapi({
      description:
        "The VAPID public key a browser subscribes with. Null while the operator has not set a key pair, so desktop push is off.",
    }),
  })
  .openapi("WebPushKey");

export const registeredDeviceSchema = z
  .object({
    delivering: z.boolean().openapi({
      description:
        "Whether this server can push to the platform now. False until the operator sets the APNs, FCM or VAPID key; the device stays registered.",
    }),
  })
  .openapi("PushDeviceRegistration");

export const unregisteredDeviceSchema = z
  .object({
    removed: z.boolean().openapi({
      description: "False when no device of yours had this token.",
    }),
  })
  .openapi("PushDeviceRemoval");

export const pushDeviceListSchema = z
  .array(
    z.object({
      id: z.string(),
      platform: z.enum(["ios", "android", "web"]),
      delivering: z.boolean().openapi({
        description: "Whether this server can push to the platform now.",
      }),
      createdAt: z.string(),
    }),
  )
  .openapi("PushDeviceList");
