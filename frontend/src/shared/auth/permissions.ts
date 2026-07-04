import type { UserRole } from "~/shared/api/types";

// Mirrors the backend's RBAC ladder (Auditor < Volunteer < Charity Admin) for
// UI capability-hiding only — the server is the actual enforcement point
// (see the `permissions` macro).
export const can = {
  createCampaign: (role: UserRole | undefined) => role === "admin",
  updateCampaign: (role: UserRole | undefined) => role === "admin",
  deleteCampaign: (role: UserRole | undefined) => role === "admin",
  /** Volunteer+: take donations at the terminal (shows the console's terminal launcher). */
  recordDonation: (role: UserRole | undefined) => role === "volunteer" || role === "admin",
  exportLedger: (role: UserRole | undefined) => role === "volunteer" || role === "admin",
  /** Reconciliation actions (auto-match / per-row reconcile); viewing is open to every role. */
  reconcile: (role: UserRole | undefined) => role === "admin",
  manageUsers: (role: UserRole | undefined) => role === "admin",
};
