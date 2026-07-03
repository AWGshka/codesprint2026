/**
 * Tap to Pay integration point — Stripe Terminal via @capacitor-community/stripe-terminal.
 *
 * This is the prepared base for real contactless acceptance (the current web kiosk simulates
 * the tap). Certified EMV contactless is only possible through a Tap to Phone SDK; Stripe
 * Terminal's "Tap to Pay" is the most portable option (Android NFC + iPhone via Apple's
 * entitlement, which Stripe already holds).
 *
 * Wiring still required when this goes live:
 *   1. Backend: POST /api/kiosk/connection-token — creates a Stripe Terminal connection token
 *      with the Stripe secret key (never ship that key in the app).
 *   2. Backend: POST /api/kiosk/payment-intent — creates a PaymentIntent for the chosen
 *      amount/currency, returns its client secret; on the `payment_intent.succeeded` webhook
 *      record the donation exactly like the web flow does (same /donations service).
 *   3. This app: replace the web kiosk's "emulate tap" with `collectTapToPay()` below.
 */
import { StripeTerminal, TerminalConnectTypes } from "@capacitor-community/stripe-terminal";

export const initTerminal = async (apiBaseUrl: string): Promise<void> => {
  await StripeTerminal.initialize({
    // The plugin calls this endpoint whenever it needs a fresh connection token.
    tokenProviderEndpoint: `${apiBaseUrl}/api/kiosk/connection-token`,
    isTest: true,
  });
  // Tap to Pay = the phone itself is the reader.
  const { readers } = await StripeTerminal.discoverReaders({ type: TerminalConnectTypes.TapToPay });
  if (!readers?.length) throw new Error("This device does not support Tap to Pay");
  await StripeTerminal.connectReader({ reader: readers[0] });
};

/** Collects one contactless payment for a prepared PaymentIntent client secret. */
export const collectTapToPay = async (paymentIntentClientSecret: string): Promise<void> => {
  await StripeTerminal.collectPaymentMethod({ paymentIntent: paymentIntentClientSecret });
  await StripeTerminal.confirmPaymentIntent();
};
