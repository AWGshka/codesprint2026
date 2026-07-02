import { Elysia } from "elysia";

import { authPlugin } from "~/plugins/auth";

// In-memory pub/sub for the admin live dashboard (spec §7.7). No external
// broker - a single-process demo backend is fine to keep this in memory.
type EventName = "donation.created" | "reconciliation.updated";

type Subscriber = (event: EventName, payload: unknown) => void;

const subscribers = new Set<Subscriber>();

export const subscribe = (fn: Subscriber): (() => void) => {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
};

export const emit = (event: EventName, payload: unknown): void => {
  for (const fn of subscribers) fn(event, payload);
};

const HEARTBEAT_MS = 20_000;

// One SSE frame: `event:` + `data:` lines, blank line terminator. `data` is
// JSON-stringified regardless of payload shape.
const frame = (event: EventName, payload: unknown): string => `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;

// GET /api/admin/events - real text/event-stream framing via an async
// generator. Registers a subscriber, yields frames as they arrive, sends a
// heartbeat comment every ~20s so intermediaries don't close the connection,
// and unsubscribes when the client disconnects (generator return/throw).
export const eventsPlugin = new Elysia({ name: "events" }).use(authPlugin).get(
  "/admin/events",
  async function* ({ request }) {
    const queue: string[] = [];
    let wake: (() => void) | null = null;

    const unsubscribe = subscribe((event, payload) => {
      queue.push(frame(event, payload));
      wake?.();
    });

    const heartbeat = setInterval(() => {
      queue.push(": heartbeat\n\n");
      wake?.();
    }, HEARTBEAT_MS);

    try {
      yield ": connected\n\n";

      while (!request.signal.aborted) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            wake = resolve;
            request.signal.addEventListener("abort", () => resolve(), { once: true });
          });
          wake = null;
        }

        while (queue.length > 0) yield queue.shift() as string;
      }
    } finally {
      clearInterval(heartbeat);
      unsubscribe();
    }
  },
  {
    auth: true,
    permissions: { donation: ["read"] },
    set: { headers: { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" } },
    detail: { summary: "SSE stream: donation.created + heartbeat", tags: ["Admin", "Events"] },
  },
);
