import { Elysia, sse } from "elysia";

import { authPlugin } from "~/plugins/auth";

// In-memory pub/sub for the admin live dashboard. No external
// broker — a single-process demo backend is fine to keep this in memory.
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

// GET /api/admin/events — SSE via Elysia's `sse()` helper, which owns both the
// text/event-stream headers and the wire framing. Never yield hand-rolled
// `event:`/`data:` strings here: Elysia wraps every yielded string in its own
// `data:` line, which destroys named-event framing — the dashboard listens for
// `donation.created` specifically and would never fire.
export const eventsPlugin = new Elysia({ name: "events" }).use(authPlugin).get(
  "/admin/events",
  async function* ({ request }) {
    const queue: { event: string; data: unknown }[] = [];
    let wake: (() => void) | null = null;

    const unsubscribe = subscribe((event, payload) => {
      queue.push({ event, data: payload });
      wake?.();
    });

    const heartbeat = setInterval(() => {
      queue.push({ event: "heartbeat", data: Date.now() });
      wake?.();
    }, HEARTBEAT_MS);

    try {
      yield sse({ event: "connected", data: Date.now() });

      while (!request.signal.aborted) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            wake = resolve;
            request.signal.addEventListener("abort", () => resolve(), { once: true });
          });
          wake = null;
        }

        while (queue.length > 0) {
          const next = queue.shift() as { event: string; data: unknown };
          yield sse({ event: next.event, data: next.data });
        }
      }
    } finally {
      clearInterval(heartbeat);
      unsubscribe();
    }
  },
  {
    auth: true,
    permissions: { donation: ["read"] },
    detail: { summary: "SSE stream: donation.created + heartbeat", tags: ["Admin", "Events"] },
  },
);
