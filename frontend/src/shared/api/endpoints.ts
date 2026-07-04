import { api } from "./client";
import type {
  AdminUser,
  AuditLog,
  BinDetails,
  CampaignAdmin,
  CampaignWithProgress,
  CreateCampaignBody,
  CreateDonationBody,
  CreateDonationResponse,
  CurrencyConfig,
  DashboardStats,
  DonationLedgerRow,
  DonationReceipt,
  Paged,
  ReconciliationResult,
  SendReceiptBody,
  Supporter,
  UserRole,
} from "./types";

import { env } from "~/shared/config/env";

const qs = (params: object) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, string | number | undefined | null>)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : "";
};

// ---- Public campaigns ----
export const listCampaigns = () => api.get<CampaignWithProgress[]>("/api/campaigns");
export const getCampaign = (slug: string) => api.get<CampaignWithProgress>(`/api/campaigns/${slug}`);

// ---- Public donations ----
export const createDonation = (slug: string, body: CreateDonationBody) => api.post<CreateDonationResponse>(`/api/campaigns/${slug}/donations`, body);
export const getReceipt = (slug: string, reference: string) => api.get<DonationReceipt>(`/api/campaigns/${slug}/donations/${reference}`);
export const sendReceipt = (slug: string, reference: string, body: SendReceiptBody) =>
  api.post<{ sent: boolean; channel: string; to: string }>(`/api/campaigns/${slug}/donations/${reference}/receipt`, body);
export const listSupporters = (slug: string) => api.get<Supporter[]>(`/api/campaigns/${slug}/supporters`);

// ---- Config ----
export const getCurrencyConfig = () => api.get<CurrencyConfig>("/api/config/currencies");
export const lookupBin = (bin: string) => api.get<BinDetails | null>(`/api/config/bin?bin=${bin}`);

// ---- Admin campaigns ----
export interface CampaignListQuery {
  status?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}
export const adminListCampaigns = (query: CampaignListQuery = {}) => api.get<Paged<CampaignAdmin>>(`/api/admin/campaigns${qs(query)}`);
export const adminGetCampaign = (id: string) => api.get<CampaignAdmin>(`/api/admin/campaigns/${id}`);
export const adminCreateCampaign = (body: CreateCampaignBody) => api.post<CampaignAdmin>("/api/admin/campaigns", body);
export const adminUpdateCampaign = (id: string, body: Partial<CreateCampaignBody>) => api.put<CampaignAdmin>(`/api/admin/campaigns/${id}`, body);
export const adminDeleteCampaign = (id: string) => api.del<{ deleted: true }>(`/api/admin/campaigns/${id}`);

export const adminUploadLogo = async (campaignId: string, file: File): Promise<{ logoUrl: string }> => {
  const form = new FormData();
  form.append("logo", file);
  const res = await fetch(`${env.apiBaseUrl}/api/admin/campaigns/${campaignId}/logo`, { method: "POST", body: form, credentials: "include" });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const json = await res.json();
  return json.data;
};

// ---- Admin donations / ledger ----
export interface LedgerQuery {
  campaignId?: string;
  currency?: string;
  status?: string;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
  /** Amount bounds in EUR minor units (converted server-side per row). */
  minEURMinor?: number;
  maxEURMinor?: number;
  q?: string;
  sort?: string;
  dir?: string;
  page?: number;
  pageSize?: number;
  /** Export-only page-range scoping (e.g. `"2"` or `"1-3,5"`) — see `shared/lib/pages.ts::parsePages`. */
  pages?: string;
}
export const adminListDonations = (query: LedgerQuery = {}) => api.get<Paged<DonationLedgerRow>>(`/api/admin/donations${qs(query)}`);
export const ledgerExportUrl = (query: LedgerQuery, apiBaseUrl: string) => `${apiBaseUrl}/api/admin/donations/export.csv${qs(query)}`;

// ---- Dashboard ----
export const getDashboardStats = () => api.get<DashboardStats>("/api/admin/dashboard");

// ---- Reconciliation ----
export const getReconciliation = () => api.get<ReconciliationResult>("/api/admin/reconciliation");
export const reconcileMatch = (paymentRef: string) =>
  api.post<{ matched: boolean; alreadyMatched: boolean }>("/api/admin/reconciliation/match", { paymentRef });
export const reconcileAutoMatch = () => api.post<{ matchedCount: number }>("/api/admin/reconciliation/automatch", {});

// ---- Audit ----
export interface AuditQuery {
  action?: string;
  actorId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}
export const adminListAudit = (query: AuditQuery = {}) => api.get<Paged<AuditLog>>(`/api/admin/audit${qs(query)}`);
export const recordClientEvent = (action: "ledger.export.pdf", metadata?: unknown) =>
  api.post<{ recorded: true }>("/api/admin/audit/client-event", { action, metadata });

// ---- Users ----
export const adminListUsers = () => api.get<{ rows: AdminUser[]; total: number }>("/api/admin/users");
export const adminSetUserRole = (id: string, role: UserRole) => api.patch<AdminUser>(`/api/admin/users/${id}/role`, { role });
