import { createSignal, onCleanup } from "solid-js";

import { env } from "~/shared/config/env";
import type { DonationCreatedEvent } from "~/shared/api/types";

/** Subscribes to `GET /api/admin/events` (donation.created SSE) with auto-reconnect. Call inside a component (uses onCleanup). */
export const createDonationEvents = (onEvent: (event: DonationCreatedEvent) => void) => {
  const [connected, setConnected] = createSignal(false);
  let source: EventSource | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  const connect = () => {
    if (disposed) return;
    source = new EventSource(`${env.apiBaseUrl}/api/admin/events`, { withCredentials: true });

    source.addEventListener("open", () => setConnected(true));
    source.addEventListener("donation.created", (event) => {
      try {
        onEvent(JSON.parse((event as MessageEvent).data) as DonationCreatedEvent);
      } catch {
        // ignore malformed frames
      }
    });
    source.onerror = () => {
      setConnected(false);
      source?.close();
      if (!disposed) retryTimer = setTimeout(connect, 3000);
    };
  };

  connect();

  onCleanup(() => {
    disposed = true;
    if (retryTimer) clearTimeout(retryTimer);
    source?.close();
  });

  return { connected };
};
