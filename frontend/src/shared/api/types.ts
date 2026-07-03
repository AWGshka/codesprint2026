export interface HealthResponse {
  status: "ok";
  uptime: number;
}

export type CurrencyCode = "EUR" | "USD" | "GBP";
export type CampaignStatus = "draft" | "active" | "paused" | "ended";
export type DonationFrequency = "one_time" | "monthly" | "roundup";
export type DonationStatus = "completed" | "pending" | "failed";
export type DonationSource = "web" | "kiosk";
export type UserRole = "viewer" | "manager" | "admin";
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
  createdAt: string;
}

export interface DonationReceipt extends Donation {
  campaignName: string;
  campaignSlug: string;
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
  card?: { last4: string };
}

export interface CreateDonationResponse {
  reference: string;
  status: "completed";
  donation: Donation;
}

export interface DashboardStats {
  totalsByCurrency: { currency: CurrencyCode; totalMinor: number; count: number }[];
  totalEURMinor: number;
  donationCount: number;
  activeCampaignCount: number;
  topCampaigns: { campaignId: string; name: string; raisedEURMinor: number; donationCount: number }[];
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
}

export interface ReconciliationResult {
  summary: { matched: number; mismatched: number; missingInProcessor: number; missingInApp: number };
  rows: ReconciliationRow[];
}

export type AuditAction =
  | "campaign.create"
  | "campaign.update"
  | "campaign.delete"
  | "user.role_change"
  | "reconciliation.run"
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
  campaignName: string;
  amountMinor: number;
  currency: CurrencyCode;
  source: DonationSource;
  createdAt: string;
}
