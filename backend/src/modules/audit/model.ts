import { t } from "elysia";

// Full audit-action enum — every admin mutation writes one of these.
export const AuditActionSchema = t.Union([
  t.Literal("campaign.create"),
  t.Literal("campaign.update"),
  t.Literal("campaign.delete"),
  t.Literal("user.role_change"),
  t.Literal("reconciliation.run"),
  t.Literal("reconciliation.match"),
  t.Literal("reconciliation.automatch"),
  t.Literal("donation.recorded"),
  t.Literal("ledger.export.csv"),
  t.Literal("ledger.export.pdf"),
  t.Literal("auth.login"),
]);

// Restricted subset a client may self-report via POST /admin/audit/client-event.
export const ClientAuditActionSchema = t.Literal("ledger.export.pdf");

export const AuditLogSchema = t.Object({
  id: t.String(),
  actorId: t.String(),
  actorEmail: t.String(),
  actorName: t.Nullable(t.String()),
  actorUsername: t.Nullable(t.String()),
  action: AuditActionSchema,
  targetType: t.Nullable(t.String()),
  targetId: t.Nullable(t.String()),
  metadata: t.Nullable(t.Unknown()),
  createdAt: t.String(),
});

export const AuditListQuery = t.Object({
  action: t.Optional(t.String()),
  actorId: t.Optional(t.String()),
  dateFrom: t.Optional(t.String()),
  dateTo: t.Optional(t.String()),
  page: t.Optional(t.Numeric()),
  pageSize: t.Optional(t.Numeric()),
});

export const AuditListResponse = t.Object({ rows: t.Array(AuditLogSchema), total: t.Integer(), page: t.Integer(), pageSize: t.Integer() });

export const ClientEventBody = t.Object({ action: ClientAuditActionSchema, metadata: t.Optional(t.Unknown()) });
