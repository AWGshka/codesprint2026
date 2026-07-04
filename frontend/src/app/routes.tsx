import AdminLayout from "./layouts/AdminLayout";
import DonorLayout from "./layouts/DonorLayout";
import PublicLayout from "./layouts/PublicLayout";

import type { RouteDefinition } from "@solidjs/router";

import { lazy } from "solid-js";

import { RequireRole } from "~/shared/auth";

const HomePage = lazy(() => import("~/pages/HomePage"));
const NotFoundPage = lazy(() => import("~/pages/NotFoundPage"));

// Donor
const DiscoverPage = lazy(() => import("~/pages/donor/DiscoverPage"));
const CampaignLandingPage = lazy(() => import("~/pages/donor/CampaignLandingPage"));
const GivePage = lazy(() => import("~/pages/donor/GivePage"));
const ThanksPage = lazy(() => import("~/pages/donor/ThanksPage"));
const KioskPage = lazy(() => import("~/pages/donor/KioskPage"));

// Admin
const AdminLoginPage = lazy(() => import("~/pages/admin/AdminLoginPage"));
const AdminDashboardPage = lazy(() => import("~/pages/admin/DashboardPage"));
const CampaignsListPage = lazy(() => import("~/pages/admin/CampaignsListPage"));
const CampaignFormPage = lazy(() => import("~/pages/admin/CampaignFormPage"));
const CampaignDetailPage = lazy(() => import("~/pages/admin/CampaignDetailPage"));
const LedgerPage = lazy(() => import("~/pages/admin/LedgerPage"));
const ReconciliationPage = lazy(() => import("~/pages/admin/ReconciliationPage"));
const AuditPage = lazy(() => import("~/pages/admin/AuditPage"));
const UsersPage = lazy(() => import("~/pages/admin/UsersPage"));
const ImpactPage = lazy(() => import("~/pages/admin/ImpactPage"));

export const routes: RouteDefinition[] = [
  {
    component: PublicLayout,
    children: [
      { path: "/", component: HomePage },
      { path: "/discover", component: DiscoverPage },
    ],
  },
  {
    path: "/c/:slug",
    component: DonorLayout,
    children: [
      { path: "/", component: CampaignLandingPage },
      { path: "/give", component: GivePage },
      { path: "/thanks/:reference", component: ThanksPage },
    ],
  },
  { path: "/kiosk/:slug", component: KioskPage },
  { path: "/admin/login", component: AdminLoginPage },
  {
    path: "/admin",
    component: AdminLayout,
    children: [
      { path: "/", component: AdminDashboardPage },
      { path: "/campaigns", component: CampaignsListPage },
      {
        // Campaign management is Charity-Admin-only (auditors/volunteers can still view the list).
        path: "/campaigns/new",
        component: () => (
          <RequireRole roles={["admin"]}>
            <CampaignFormPage />
          </RequireRole>
        ),
      },
      { path: "/campaigns/:id", component: CampaignDetailPage },
      {
        path: "/campaigns/:id/edit",
        component: () => (
          <RequireRole roles={["admin"]}>
            <CampaignFormPage />
          </RequireRole>
        ),
      },
      { path: "/ledger", component: LedgerPage },
      { path: "/reconciliation", component: ReconciliationPage },
      { path: "/audit", component: AuditPage },
      { path: "/impact", component: ImpactPage },
      {
        path: "/users",
        component: () => (
          <RequireRole roles={["admin"]}>
            <UsersPage />
          </RequireRole>
        ),
      },
    ],
  },
  { path: "*404", component: NotFoundPage },
];
