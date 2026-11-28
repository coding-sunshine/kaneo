import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import i18n from "i18next";
import getWebPushKey from "@/fetchers/push/get-web-push-key";
import registerWebPush, {
  type WebPushSubscriptionJson,
} from "@/fetchers/push/register-web-push";
import unregisterWebPush from "@/fetchers/push/unregister-web-push";
import { base64UrlBytes } from "@/lib/push/base64-url-bytes";
import { toast } from "@/lib/toast";
import { desktopPushState } from "./desktop-push-state";

const supported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

const subscriptionKey = ["web-push-subscription"];

async function currentSubscription() {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

const asJson = (subscription: PushSubscription) =>
  subscription.toJSON() as WebPushSubscriptionJson;

/** This browser's desktop push: whether it is on, and turning it on or off. */
export function useDesktopPush() {
  const queryClient = useQueryClient();
  const canPush = supported();
  const key = useQuery({
    queryKey: ["web-push-key"],
    queryFn: getWebPushKey,
    enabled: canPush,
  });
  const subscription = useQuery({
    queryKey: subscriptionKey,
    queryFn: async () => Boolean(await currentSubscription()),
    enabled: canPush,
  });
  const publicKey = key.data?.publicKey ?? null;

  const toggle = useMutation({
    mutationFn: async (on: boolean) => {
      const existing = await currentSubscription();
      if (existing) {
        // The server forgets it first, so no push lands after "off".
        await unregisterWebPush(asJson(existing));
        await existing.unsubscribe();
      }
      if (!on || !publicKey) return;
      if ((await Notification.requestPermission()) !== "granted") return;
      const registration = await navigator.serviceWorker.ready;
      const next = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlBytes(publicKey),
      });
      await registerWebPush(asJson(next));
    },
    onError: () =>
      toast.error(i18n.t("settings:notificationsPage.desktopFailed")),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: subscriptionKey }),
  });

  return {
    loading: canPush && (key.isLoading || subscription.isLoading),
    state: desktopPushState({
      supported: canPush,
      publicKey,
      permission: canPush ? Notification.permission : "default",
      subscribed: subscription.data ?? false,
    }),
    busy: toggle.isPending,
    setEnabled: (on: boolean) => toggle.mutate(on),
  };
}
