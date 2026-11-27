import i18n from "i18next";
import type { Room } from "livekit-client";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { useCallStore } from "@/store/call";
import { joinLiveKitRoom } from "./join-livekit-room";

/** The call this tab is in, docked over the page until hang up. */
export function CallRoom() {
  const { t } = useTranslation();
  const session = useCallStore((state) => state.session);
  const setSession = useCallStore((state) => state.setSession);
  const titleId = useId();
  const media = useRef<HTMLDivElement>(null);
  const room = useRef<Room | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);

  useEffect(() => {
    if (!session) return;
    let left = false;
    const show = (element: HTMLMediaElement) => {
      element.className = "max-h-48 w-full rounded bg-black object-cover";
      media.current?.appendChild(element);
    };
    setMicOn(true);
    setCameraOn(false);
    joinLiveKitRoom(session, show, () => setSession(null))
      .then((joined) => {
        if (left) void joined.disconnect();
        else room.current = joined;
      })
      .catch((error: unknown) => {
        if (left) return;
        toast.error(i18n.t("navigation:chat.callFailed"), {
          description: error instanceof Error ? error.message : undefined,
        });
        setSession(null);
      });
    return () => {
      left = true;
      void room.current?.disconnect();
      room.current = null;
    };
  }, [session, setSession]);

  if (!session) return null;

  const toggleMic = async () => {
    await room.current?.localParticipant.setMicrophoneEnabled(!micOn);
    setMicOn(!micOn);
  };
  const toggleCamera = async () => {
    await room.current?.localParticipant.setCameraEnabled(!cameraOn);
    setCameraOn(!cameraOn);
  };
  const leave = async () => {
    await room.current?.disconnect();
    setSession(null);
  };

  return (
    <section
      aria-labelledby={titleId}
      className="fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2 rounded-lg border bg-background p-3 shadow-lg"
    >
      <h2 id={titleId} className="truncate text-sm font-semibold">
        <span className="sr-only">{t("navigation:chat.callTitle")} </span>
        {session.channelName}
      </h2>
      <div ref={media} className="flex flex-col gap-2" />
      <div className="flex justify-center gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t("navigation:chat.microphone")}
          aria-pressed={micOn}
          onClick={toggleMic}
        >
          {micOn ? <Mic /> : <MicOff />}
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t("navigation:chat.camera")}
          aria-pressed={cameraOn}
          onClick={toggleCamera}
        >
          {cameraOn ? <Video /> : <VideoOff />}
        </Button>
        <Button
          variant="destructive"
          size="icon-sm"
          aria-label={t("navigation:chat.leaveCall")}
          onClick={leave}
        >
          <PhoneOff />
        </Button>
      </div>
    </section>
  );
}
