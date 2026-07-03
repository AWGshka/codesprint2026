import { Elysia, t } from "elysia";

import { ok } from "~/lib/response";
import { Unauthorized } from "~/lib/errors";

// Examples read env directly so the folder stays self-contained and deletable.
const secret = process.env.WEBHOOK_SECRET ?? "dev-webhook-secret";

// Bun.CryptoHasher does HMAC natively — no node:crypto. `type: "text"` keeps the
// body raw so the signature is computed over exact bytes; compare in constant time.
const sign = (raw: string) => new Bun.CryptoHasher("sha256", secret).update(raw).digest("hex");

const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export const webhookExample = new Elysia({ prefix: "/webhook" }).post(
  "/inbound",
  ({ body, headers }) => {
    const signature = headers["x-signature"];
    if (!signature || !safeEqual(sign(body), signature)) throw Unauthorized("Invalid signature");

    return ok({ received: true, payload: JSON.parse(body) as unknown });
  },
  { type: "text", body: t.String(), detail: { summary: "Verify an HMAC-signed webhook (raw body)", tags: ["Examples"] } },
);
