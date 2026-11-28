import { useCallback, useEffect, useRef, useState } from "react";

// Longer than the typist's keep-alive, so only a lost stop signal expires.
const EXPIRY_MS = 6000;

/** Who else is typing in the open channel, oldest first. */
export function useTypingUsers(channelId: string, currentUserId?: string) {
  const [typing, setTyping] = useState<string[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const forget = useCallback((userId: string) => {
    clearTimeout(timers.current.get(userId));
    timers.current.delete(userId);
    setTyping((ids) => ids.filter((id) => id !== userId));
  }, []);

  const onTyping = useCallback(
    (userId: string, on: boolean) => {
      if (userId === currentUserId) return;
      if (!on) return forget(userId);
      clearTimeout(timers.current.get(userId));
      timers.current.set(
        userId,
        setTimeout(() => forget(userId), EXPIRY_MS),
      );
      setTyping((ids) => (ids.includes(userId) ? ids : [...ids, userId]));
    },
    [currentUserId, forget],
  );

  useEffect(() => {
    const pending = timers.current;
    setTyping([]);
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, [channelId]);

  return { typing, onTyping };
}
