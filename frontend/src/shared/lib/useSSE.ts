import { createSignal, onCleanup } from "solid-js";

import { env } from "~/shared/config/env";
import type { DonationCreatedEvent, Supporter } from "~/shared/api/types";

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

// ---------------------------------------------------------------------------
// Shared per-slug EventSource pool for the public campaign stream.
//
// HTTP/1.1 browsers cap at ~6 connections per origin.  Each raw EventSource
// holds one of those slots permanently — two tabs on the same campaign page
// with two callers each (DonorCampaignContext + SupportersWall) would consume
// 4 slots, starving regular fetch requests (BIN lookup, donation POST, etc.).
//
// This pool ensures only **one EventSource per campaign slug** exists at any
// time.  `createSupporterEvents` adds a listener to the shared connection and
// removes it on cleanup; the EventSource itself is torn down only once the
// last listener for that slug unsubscribes.
// ---------------------------------------------------------------------------

type SupporterEvent = Supporter & { donorName: string | null };
type SupporterListener = (event: SupporterEvent) => void;

interface SlugConnection {
  source: EventSource | undefined;
  retryTimer: ReturnType<typeof setTimeout> | undefined;
  listeners: Set<SupporterListener>;
  connectedListeners: Set<(v: boolean) => void>;
  connected: boolean;
  disposed: boolean;
}

const pool = new Map<string, SlugConnection>();

function getOrCreateConnection(slug: string): SlugConnection {
  const existing = pool.get(slug);
  if (existing) return existing;

  const conn: SlugConnection = {
    source: undefined,
    retryTimer: undefined,
    listeners: new Set(),
    connectedListeners: new Set(),
    connected: false,
    disposed: false,
  };

  const setConnected = (v: boolean) => {
    conn.connected = v;
    for (const fn of conn.connectedListeners) fn(v);
  };

  const connect = () => {
    if (conn.disposed) return;
    conn.source = new EventSource(`${env.apiBaseUrl}/api/campaigns/${slug}/events`);

    conn.source.addEventListener("open", () => setConnected(true));
    conn.source.addEventListener("donation.created", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as SupporterEvent;
        for (const fn of conn.listeners) fn(data);
      } catch {
        // ignore malformed frames
      }
    });
    conn.source.onerror = () => {
      setConnected(false);
      conn.source?.close();
      if (!conn.disposed) conn.retryTimer = setTimeout(connect, 3000);
    };
  };

  connect();
  pool.set(slug, conn);
  return conn;
}

function removeListener(slug: string, conn: SlugConnection, listener: SupporterListener, connectedCb: (v: boolean) => void) {
  conn.listeners.delete(listener);
  conn.connectedListeners.delete(connectedCb);

  // Tear down the EventSource once the last listener for this slug is gone.
  if (conn.listeners.size === 0) {
    conn.disposed = true;
    if (conn.retryTimer) clearTimeout(conn.retryTimer);
    conn.source?.close();
    pool.delete(slug);
  }
}

/** Subscribes to the public per-campaign stream (`GET /api/campaigns/:slug/events`).
 * Multiple callers with the same slug **share one EventSource** so browser
 * connection slots aren't wasted.  Auto-reconnects; call inside a component
 * (uses onCleanup). */
export const createSupporterEvents = (slug: string, onEvent: SupporterListener) => {
  const conn = getOrCreateConnection(slug);
  conn.listeners.add(onEvent);

  // Per-caller connected signal — mirrors the shared connection state.
  const [connected, setConnected] = createSignal(conn.connected);
  conn.connectedListeners.add(setConnected);

  onCleanup(() => removeListener(slug, conn, onEvent, setConnected));

  return { connected };
};
