import type { UserRole } from "~/shared/api/types";

// Mirrors the backend's RBAC table (spec §5.2) for UI capability-hiding only -
// the server is the actual enforcement point (see `permissions` macro).
export const can = {
  createCampaign: (role: UserRole | undefined) => role === "manager" || role === "admin",
  updateCampaign: (role: UserRole | undefined) => role === "manager" || role === "admin",
  deleteCampaign: (role: UserRole | undefined) => role === "admin",
  exportLedger: (role: UserRole | undefined) => role === "manager" || role === "admin",
  runReconciliation: (role: UserRole | undefined) => role === "manager" || role === "admin",
  manageUsers: (role: UserRole | undefined) => role === "admin",
};
