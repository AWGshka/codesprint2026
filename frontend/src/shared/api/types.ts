export interface HealthResponse {
  status: "ok";
  uptime: number;
}

export type CurrencyCode = "EUR" | "USD" | "GBP";
export type CampaignStatus = "draft" | "active" | "paused" | "ended";
export type DonationFrequency = "one_time" | "monthly";
export type DonationStatus = "completed" | "declined" | "refunded" | "offline";
export type DonationSource = "web" | "kiosk";
export type DonationMethod = "card" | "tap";
/** Terminal tap simulation outcome; "cancelled" is handled client-side and never sent. */
export type TapOutcome = "approved" | "declined" | "offline";
export type UserRole = "auditor" | "volunteer" | "admin";
export type ReconciliationStatus = "matched" | "mismatched" | "missingInProcessor" | "missingInApp";

export interface CampaignPublic {
  id: string;
  slug: string;
  name: string;
  cause: string;
  description: string;
  story?: string | null;
  targetMinor: number;
  currency: CurrencyCode;
  status: CampaignStatus;
  brandColor: string;
  logoUrl?: string | null;
  heroImageUrl?: string | null;
  presetsMinor: number[];
  allowCustom: boolean;
  frequencies: DonationFrequency[];
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface CampaignWithProgress extends CampaignPublic {
  // Optional: the public campaigns LIST endpoint currently omits `progress` (backend fix
  // pending separately); the single-campaign GET endpoint does include it. Callers must
  // tolerate `undefined` (fall back to the campaign's own `targetMinor`/0 raised).
  progress?: { raisedMinor: number; targetMinor: number; donorCount: number };
}

export interface CampaignAdmin extends CampaignPublic {
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampaignBody {
  slug: string;
  name: string;
  cause: string;
  description: string;
  story?: string;
  targetMinor: number;
  currency: CurrencyCode;
  status: CampaignStatus;
  brandColor: string;
  logoUrl?: string;
  heroImageUrl?: string;
  presetsMinor: number[];
  allowCustom?: boolean;
  frequencies: DonationFrequency[];
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Donation {
  id: string;
  reference: string;
  campaignId: string;
  donorName?: string | null;
  donorEmail?: string | null;
  amountMinor: number;
  currency: CurrencyCode;
  frequency: DonationFrequency;
  status: DonationStatus;
  source: DonationSource;
  method: DonationMethod;
  roundedUp: boolean;
  giftAid: boolean;
  showOnWall: boolean;
  createdAt: string;
}

export interface DonationReceipt extends Donation {
  campaignName: string;
  campaignSlug: string;
  /** Sandbox/processor transaction id. */
  paymentRef: string;
}

export interface DonationLedgerRow extends Donation {
  paymentRef: string;
  campaignName: string;
}

export interface CreateDonationBody {
  amountMinor: number;
  currency: CurrencyCode;
  frequency: DonationFrequency;
  donorName?: string;
  donorEmail?: string;
  source: DonationSource;
  method?: DonationMethod;
  roundedUp?: boolean;
  giftAid?: boolean;
  showOnWall?: boolean;
  outcome?: TapOutcome;
  card?: { last4: string; pan?: string; expiryMonth?: number; expiryYear?: number; cvv?: string };
}

export interface CreateDonationResponse {
  reference: string;
  status: DonationStatus;
  donation: Donation;
}

export interface Supporter {
  donorName: string;
  amountMinor: number;
  currency: CurrencyCode;
  createdAt: string;
}

export interface SendReceiptBody {
  channel: "email" | "sms";
  to: string;
}

export interface DashboardStats {
  totalsByCurrency: { currency: CurrencyCode; totalMinor: number; count: number }[];
  totalEURMinor: number;
  donationCount: number;
  activeCampaignCount: number;
  /** Progress vs goal across active campaigns (EUR bridge). */
  goalEURMinor: number;
  goalRaisedEURMinor: number;
  goalProgressPct: number;
  topCampaigns: { campaignId: string; name: string; raisedEURMinor: number; targetEURMinor: number; donationCount: number }[];
  recentDonations: { reference: string; campaignName: string; amountMinor: number; currency: CurrencyCode; source: DonationSource; createdAt: string }[];
  trend: { date: string; totalEURMinor: number; count: number }[];
}

export interface Settlement {
  id: string;
  paymentRef: string;
  amountMinor: number;
  currency: CurrencyCode;
  status: "settled" | "failed";
  processedAt: string;
}

export interface ReconciliationRow {
  paymentRef: string;
  status: ReconciliationStatus;
  reference: string | null;
  donation: { amountMinor: number; currency: CurrencyCode; status: DonationStatus } | null;
  settlement: { amountMinor: number; currency: CurrencyCode; status: "settled" | "failed" } | null;
  reconciled: boolean;
  matchMethod: "auto" | "manual" | null;
  matchedAt: string | null;
  occurredAt: string | null;
}

export interface ReconciliationResult {
  summary: { matched: number; awaiting: number; matchRate: number; mismatched: number; missingInProcessor: number; missingInApp: number };
  rows: ReconciliationRow[];
}

export type AuditAction =
  | "campaign.create"
  | "campaign.update"
  | "campaign.delete"
  | "user.role_change"
  | "reconciliation.run"
  | "reconciliation.match"
  | "reconciliation.automatch"
  | "donation.recorded"
  | "ledger.export.csv"
  | "ledger.export.pdf"
  | "auth.login";

export interface AuditLog {
  id: string;
  actorId: string;
  actorEmail: string;
  actorName: string | null;
  actorUsername: string | null;
  action: AuditAction;
  targetType: string;
  targetId: string;
  metadata?: unknown;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  role: UserRole;
  banned: boolean;
  createdAt: string;
}

export interface CurrencyConfig {
  base: CurrencyCode;
  currencies: CurrencyCode[];
  rates: Record<CurrencyCode, number>;
  /** "live" when served from the Mastercard Currency Conversion API. */
  rateSource?: "live" | "static";
}

/** Card scheme/issuer hint from the Mastercard BIN Lookup (null when unknown/unconfigured). */
export interface BinDetails {
  scheme?: string;
  issuer?: string;
  country?: string;
  fundingSource?: string;
}

export interface DonationCreatedEvent {
  reference: string;
  campaignId: string;
  campaignSlug: string;
  campaignName: string;
  amountMinor: number;
  currency: CurrencyCode;
  source: DonationSource;
  /** Present only when the donor opted into the supporters wall. */
  donorName?: string | null;
  showOnWall?: boolean;
  createdAt: string;
}
