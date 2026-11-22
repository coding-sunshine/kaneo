import { AsyncLocalStorage } from "node:async_hooks";
import { EventEmitter } from "node:events";

const EVENTS = new EventEmitter();
EVENTS.setMaxListeners(100);
export const eventContext = new AsyncLocalStorage<{ initiatorId: string }>();

export type EventPayload<T = unknown> = {
  type: string;
  data: T;
  timestamp: string;
};

// Handlers run detached from emit(), so tests await this instead of polling.
const inFlight = new Set<Promise<void>>();

export async function settleEvents(): Promise<void> {
  while (inFlight.size) await Promise.all([...inFlight]);
}

export async function shutdownEventBus(): Promise<void> {
  EVENTS.removeAllListeners();
}

export async function publishEvent(
  eventType: string,
  data: unknown,
  options?: { waitForHandlers?: boolean },
): Promise<void> {
  let enhancedData = null;
  if (typeof data === "object" && data !== null) {
    const store = eventContext.getStore();
    enhancedData = { ...data, initiatorId: store?.initiatorId };
  }

  const payload: EventPayload = {
    type: eventType,
    data: enhancedData || data,
    timestamp: new Date().toISOString(),
  };

  try {
    if (options?.waitForHandlers) {
      // EventEmitter.emit discards promises. Bounded producers must await the
      // actual subscriber wrappers before starting their next item.
      for (const listener of EVENTS.listeners(eventType))
        await listener(payload);
    } else {
      EVENTS.emit(eventType, payload);
    }
  } catch (error) {
    console.error("Failed to publish event:", error);
    throw error;
  }
}

export async function subscribeToEvent<T>(
  eventType: string,
  handler: (data: T) => Promise<void>,
): Promise<void> {
  try {
    EVENTS.on(eventType, (payload: EventPayload<T>) => {
      const run = (async () => {
        try {
          await handler(payload.data);
        } catch (error) {
          console.error(`Error processing event ${eventType}:`, error);
        }
      })();
      inFlight.add(run);
      return run.finally(() => inFlight.delete(run));
    });
  } catch (error) {
    console.error("Failed to subscribe to event:", error);
    throw error;
  }
}

process.on("SIGTERM", () => {
  shutdownEventBus().catch(console.error);
});
