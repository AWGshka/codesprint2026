import forge from "node-forge";
import oauth from "mastercard-oauth1-signer";
import encryption from "mastercard-client-encryption";

/**
 * Mastercard sandbox clients — Donate (guest payments), BIN Lookup, Currency Conversion.
 *
 * Key material lives in `backend/mastercard/` (gitignored); env wires it up (see .env.example).
 * When the consumer key or keystore is unset, GiveTap keeps using its built-in mock processor
 * and static FX rates, so the app runs without credentials.
 *
 * Auth: OAuth 1.0a RSA-SHA256 body-hash signatures (`mastercard-oauth1-signer`) with the
 * private key from the signing .p12. Donate additionally requires the ENTIRE request body
 * to be field-level encrypted (config per the Donate docs: path $→$, HEX field encoding,
 * SHA-256 OAEP) using the client encryption certificate.
 */

const config = {
  consumerKey: process.env.MASTERCARD_CONSUMER_KEY,
  keystorePath: process.env.MASTERCARD_KEYSTORE_PATH,
  keystoreAlias: process.env.MASTERCARD_KEYSTORE_ALIAS ?? "keyalias",
  keystorePassword: process.env.MASTERCARD_KEYSTORE_PASSWORD ?? "keystorepassword",
  encryptionCertPath: process.env.MASTERCARD_CLIENT_ENC_CERT_PATH,
  donateBaseUrl: process.env.MASTERCARD_BASE_URL ?? "https://sandbox.api.mastercard.com/donations",
  binBaseUrl: process.env.MASTERCARD_BIN_BASE_URL ?? "https://sandbox.api.mastercard.com/bin-resources",
  currencyBaseUrl: process.env.MASTERCARD_CURRENCY_BASE_URL ?? "https://sandbox.api.mastercard.com/settlement/currencyrate",
  // X-Openapi-Clientid — mandatory per the Donate OAS; shown with the project's Donate credentials.
  clientId: process.env.MASTERCARD_CLIENT_ID,
  // Charity UUID onboarded on the Donate platform (sandbox value from your project/support).
  charityId: process.env.MASTERCARD_CHARITY_ID,
};

export const isMastercardConfigured = (): boolean => Boolean(config.consumerKey && config.keystorePath);

let cachedSigningKey: string | undefined;

/** Extracts the RSA private key (PEM) from the signing .p12 keystore (cached after first read). */
const signingKey = async (): Promise<string> => {
  if (cachedSigningKey) return cachedSigningKey;
  const der = forge.util.decode64(Buffer.from(await Bun.file(config.keystorePath as string).arrayBuffer()).toString("base64"));
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), false, config.keystorePassword);
  const bag = p12.getBags({ friendlyName: config.keystoreAlias, bagType: forge.pki.oids.pkcs8ShroudedKeyBag }).friendlyName?.[0];
  if (!bag?.key) throw new Error(`Alias "${config.keystoreAlias}" not found in Mastercard keystore`);
  cachedSigningKey = forge.pki.privateKeyToPem(bag.key);
  return cachedSigningKey;
};

let cachedFle: InstanceType<typeof encryption.FieldLevelEncryption> | undefined;

/** Donate whole-body field-level encryption (docs: $→$, HEX, SHA-256 OAEP, cert fingerprint). */
const fle = () =>
  (cachedFle ??= new encryption.FieldLevelEncryption({
    paths: [{ path: "/(guest-payments|donors|payments)", toEncrypt: [{ element: "$", obj: "$" }], toDecrypt: [] }],
    ivFieldName: "iv",
    encryptedKeyFieldName: "encryptedKey",
    encryptedValueFieldName: "encryptedData",
    publicKeyFingerprintFieldName: "publicKeyFingerprint",
    publicKeyFingerprintType: "certificate",
    oaepHashingAlgorithmFieldName: "oaepHashingAlgorithm",
    oaepPaddingDigestAlgorithm: "SHA-256",
    dataEncoding: "hex",
    encryptionCertificate: config.encryptionCertPath as string,
  }));

const request = async <T>(method: "GET" | "POST", url: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> => {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: oauth.getAuthorizationHeader(url, method, payload, config.consumerKey as string, await signingKey()),
      "Content-Type": "application/json",
      Accept: "application/json",
      ...headers,
    },
    body: payload,
  });

  if (!response.ok) throw new Error(`Mastercard ${method} ${url} failed: ${response.status} ${(await response.text().catch(() => "")).slice(0, 300)}`);
  return (await response.json()) as T;
};

export type MastercardGuestPaymentInput = {
  amountMinor: number;
  currency: string;
  donorName?: string;
  donorEmail?: string;
  /** GiveTap's own donation reference — kept for logging/tracing. */
  reference: string;
};

export type MastercardGuestPaymentResult = {
  /** Processor-side transaction identifier — stored as our `paymentRef`. */
  paymentId: string;
  raw: unknown;
};

// Documented Mastercard sandbox test PAN — no real card data ever flows here.
const SANDBOX_TEST_CARD = { primaryAccountNumber: "5506900140100305", cvc: "100", expiryInfo: { month: 1, year: 2030 } };

export abstract class MastercardDonateClient {
  /**
   * Guest (unregistered donor) donation — POST /guest-payments with the whole body encrypted.
   * Guest donations are donationType DISASTER per Mastercard's Donate API spec.
   */
  static guestPayment = async (input: MastercardGuestPaymentInput): Promise<MastercardGuestPaymentResult> => {
    const [firstName, ...rest] = (input.donorName ?? "Guest Donor").trim().split(/\s+/);
    const url = `${config.donateBaseUrl}/guest-payments`;
    const body = {
      donation: { charityId: config.charityId, amount: Number((input.amountMinor / 100).toFixed(2)), donationType: "DISASTER" },
      user: { firstName: firstName || "Guest", lastName: rest.join(" ") || "Donor", email: input.donorEmail ?? "guest@givetap.example" },
      card: SANDBOX_TEST_CARD,
      source: "Web",
    };
    const encrypted = fle().encrypt(url, {}, body).body as Record<string, unknown>;
    const raw = await request<Record<string, unknown>>("POST", url, encrypted, config.clientId ? { "X-Openapi-Clientid": config.clientId } : {});
    if (raw.transactionStatus === "FAILURE") throw new Error(`Mastercard Donate declined: ${raw.reasonMessage ?? raw.transactionMessage}`);
    const paymentId = (raw.transactionId ?? "") as string;
    if (!paymentId) throw new Error("Mastercard Donate response had no transaction identifier");
    return { paymentId, raw };
  };

  /**
   * Registers a donor on the Donate platform (POST /donors, whole body encrypted) and
   * returns the platform's donorId. Consent versions are the documented sandbox values.
   */
  static enrollDonor = async (input: { firstName: string; lastName: string; email: string }): Promise<{ donorId: string; raw: unknown }> => {
    const url = `${config.donateBaseUrl}/donors`;
    const body = {
      acceptedConsents: { marketingEmailSubscribed: "Y", privacyNoticeVersion: "PN.2-#-xr.en-us.99.01", tncVersion: "TC.##r#12.EN-Us.99.99" },
      userName: input.email,
      userType: "API",
      name: { firstName: input.firstName, lastName: input.lastName },
      emails: [{ type: "home", value: input.email }],
      locale: "en-us",
    };
    const encrypted = fle().encrypt(url, {}, body).body as Record<string, unknown>;
    const raw = await request<Record<string, unknown>>("POST", url, encrypted, config.clientId ? { "X-Openapi-Clientid": config.clientId } : {});
    const donorId = (raw.donorId ?? raw.id ?? "") as string;
    if (!donorId) throw new Error("Mastercard Donate enrollment returned no donorId");
    return { donorId, raw };
  };
}

export type BinDetails = { scheme?: string; issuer?: string; country?: string; fundingSource?: string };

export abstract class MastercardServices {
  /** Single BIN lookup — POST /bin-ranges/account-searches with the leading PAN digits. */
  static binLookup = async (accountRange: string): Promise<BinDetails | null> => {
    const rows = await request<Record<string, unknown>[]>("POST", `${config.binBaseUrl}/bin-ranges/account-searches`, { accountRange });
    const hit = rows?.[0];
    if (!hit) return null;
    return {
      scheme: (hit.acceptanceBrand ?? hit.brand) as string | undefined,
      issuer: hit.customerName as string | undefined,
      country: (hit.country as { alpha3?: string } | undefined)?.alpha3,
      fundingSource: hit.fundingSource as string | undefined,
    };
  };

  /** Daily conversion rate — GET /conversion-rate (Standard Currency Conversion Calculator). */
  static conversionRate = async (transCurr: string, crdhldBillCurr: string, transAmt = 1): Promise<number | null> => {
    const fxDate = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
    const qs = new URLSearchParams({ fxDate, transCurr, crdhldBillCurr, bankFee: "0", transAmt: String(transAmt) });
    const raw = await request<{ data?: { conversionRate?: number } }>("GET", `${config.currencyBaseUrl}/conversion-rate?${qs}`);
    return raw.data?.conversionRate ?? null;
  };
}
