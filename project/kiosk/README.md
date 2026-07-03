# GiveTap Kiosk (native shell)

Capacitor app that packages the existing web kiosk (`/kiosk/:slug` in `project/frontend`)
as an installable Android/iOS app, and hosts the base for **real Tap to Pay** so we can move
fast if the actual task sheet asks for it.

## Why this stack

- **Capacitor** wraps the Solid kiosk UI we already have - one codebase, native packaging,
  access to device APIs (screen pinning, keep-awake, NFC).
- **Stripe Terminal - Tap to Pay** (`@capacitor-community/stripe-terminal`) is the practical
  path to certified contactless acceptance: raw NFC APIs cannot accept EMV cards, and on
  iPhone contactless acceptance is only available through Apple's Tap to Pay entitlement,
  which Stripe holds. The phone itself becomes the card reader - no extra hardware.
- Tauri mobile / bare native were considered and rejected: no payment-SDK ecosystem (Tauri)
  or a whole second codebase (native) for no benefit at this stage.

## Layout

- `www/index.html` - launcher shell: asks for the GiveTap server URL + campaign slug once
  (persisted), then loads the web kiosk route. All kiosk UI stays in `project/frontend`.
- `src/tap-to-pay.ts` - the Stripe Terminal integration point (init, discover Tap to Pay
  reader, collect payment) with the backend endpoints it expects documented inline.
- `capacitor.config.ts` - app id/name; a commented `server.url` option points the webview at
  a dev frontend for live-reload development.

## Getting started (when native work begins)

```sh
cd project/kiosk
bun install
bunx cap add android      # and/or: bunx cap add ios (macOS + Xcode required)
bunx cap sync
bunx cap run android
```

## Backend work required for real Tap to Pay

1. `POST /api/kiosk/connection-token` - mint a Stripe Terminal connection token (Stripe
   secret key stays server-side).
2. `POST /api/kiosk/payment-intent` - create a PaymentIntent for the selected amount and
   currency, return the client secret.
3. Stripe webhook (`payment_intent.succeeded`) - record the donation through the same
   donations service the web flow uses, so ledger/reconciliation/SSE all behave identically.

Until then, the packaged app runs the simulated tap-to-pay kiosk unchanged.
