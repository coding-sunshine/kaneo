import { z } from "../openapi";

export const registerDeviceBody = z.object({
  platform: z.enum(["ios", "android"]),
  token: z.string().trim().min(1).max(4096).openapi({
    description: "The native APNs device token or FCM registration token.",
  }),
});

export const unregisterDeviceBody = z.object({
  token: z.string().trim().min(1).max(4096),
});

export const registeredDeviceSchema = z
  .object({
    delivering: z.boolean().openapi({
      description:
        "Whether this server can push to the platform now. False until the operator sets the APNs or FCM key; the device stays registered.",
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
