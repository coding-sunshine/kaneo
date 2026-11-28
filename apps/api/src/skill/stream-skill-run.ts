import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { streamSSE } from "hono/streaming";

/**
 * How often a running skill sends a ping. A proxy in front of the API may
 * close a request that sends nothing for 60 seconds, as nginx does by
 * default, and a long run must outlast it.
 */
export const skillStream = { pingMs: 15_000 };

/**
 * Answers with server-sent events while `run` works: `ping` every few
 * seconds, then `result` with the answer, or `error` with the status and
 * message the plain route would have answered.
 */
export function streamSkillRun(c: Context, run: () => Promise<unknown>) {
  // Tells nginx to pass each event on instead of buffering the response.
  c.header("X-Accel-Buffering", "no");
  return streamSSE(c, async (stream) => {
    const send = (event: object) =>
      stream.writeSSE({ data: JSON.stringify(event) }).catch(() => undefined);
    const timer = setInterval(
      () => void send({ type: "ping" }),
      skillStream.pingMs,
    );
    try {
      await send({ type: "result", result: await run() });
    } catch (error) {
      const known = error instanceof HTTPException;
      if (!known) console.error("A skill run failed:", error);
      await send({
        type: "error",
        status: known ? error.status : 502,
        message: known ? error.message : "The skill run failed. Try again.",
      });
    } finally {
      clearInterval(timer);
    }
  });
}
