import { CircleCheck } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { onCompletionCelebration } from "@/lib/completion-celebration";
import { useUserPreferencesStore } from "@/store/user-preferences";

const DURATION_MS = 900;

/** Short check-mark pop when you complete an issue, if you turned it on. */
export function CompletionCelebration() {
  const enabled = useUserPreferencesStore((s) => s.completionAnimation);
  const [playId, setPlayId] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    return onCompletionCelebration(() => {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
        return;
      setPlayId(Date.now());
    });
  }, [enabled]);

  useEffect(() => {
    if (playId === null) return;
    const timer = setTimeout(() => setPlayId(null), DURATION_MS);
    return () => clearTimeout(timer);
  }, [playId]);

  if (playId === null) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 bottom-10 z-50 flex justify-center"
    >
      <motion.div
        key={playId}
        data-testid="completion-celebration"
        className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
        initial={{ opacity: 0, scale: 0.6, y: 8 }}
        animate={{
          opacity: [0, 1, 1, 0],
          scale: [0.6, 1.1, 1, 1],
          y: [8, 0, 0, -8],
        }}
        transition={{
          duration: DURATION_MS / 1000,
          times: [0, 0.25, 0.75, 1],
          ease: "easeOut",
        }}
      >
        <CircleCheck className="size-7" />
      </motion.div>
    </div>
  );
}
