import { and, count, desc, eq, gte, lte } from "drizzle-orm";

import { db } from "~/db";
import { user } from "~/db/auth-schema";
import { type Paginated, paginate } from "~/lib/pagination";
import { type AuditAction, type AuditLog, type AuditTargetType, auditLogs } from "~/db/audit-logs";

export type RecordAuditInput = {
  actorId: string;
  actorEmail: string;
  action: AuditAction;
  targetType?: AuditTargetType;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

export type AuditListFilters = { action?: string; actorId?: string; dateFrom?: string; dateTo?: string; page?: number; pageSize?: number };

type ActorIdentity = { actorName: string | null; actorUsername: string | null };

const serialize = (row: AuditLog, actor?: ActorIdentity) => ({
  id: row.id,
  actorId: row.actorId,
  actorEmail: row.actorEmail,
  actorName: actor?.actorName ?? null,
  actorUsername: actor?.actorUsername ?? null,
  action: row.action,
  targetType: row.targetType ?? null,
  targetId: row.targetId ?? null,
  metadata: row.metadata ?? null,
  createdAt: row.createdAt.toISOString(),
});

// Sole Drizzle touchpoint for the audit trail. `record` is called from every
// other module's service on mutation (spec §7.6 — writes live in the service
// layer, never the route).
export abstract class AuditService {
  static async record(input: RecordAuditInput) {
    await db.insert(auditLogs).values(input);
  }

  static async list(filters: AuditListFilters): Promise<Paginated<ReturnType<typeof serialize>>> {
    const conditions = [];
    if (filters.action) conditions.push(eq(auditLogs.action, filters.action as AuditAction));
    if (filters.actorId) conditions.push(eq(auditLogs.actorId, filters.actorId));
    if (filters.dateFrom) conditions.push(gte(auditLogs.createdAt, new Date(filters.dateFrom)));
    if (filters.dateTo) conditions.push(lte(auditLogs.createdAt, new Date(filters.dateTo)));

    const where = conditions.length ? and(...conditions) : undefined;
    const { page, pageSize, offset, limit } = paginate(filters.page, filters.pageSize);

    const [rows, [totalRow]] = await Promise.all([
      // Join the actor so the UI can show "First Last" over the username instead of a raw email.
      db
        .select({
          log: auditLogs,
          actorFirstName: user.firstName,
          actorLastName: user.lastName,
          actorFallbackName: user.name,
          actorUsername: user.username,
        })
        .from(auditLogs)
        .leftJoin(user, eq(auditLogs.actorId, user.id))
        .where(where)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(auditLogs).where(where),
    ]);

    return {
      rows: rows.map((r) =>
        serialize(r.log, {
          actorName: [r.actorFirstName, r.actorLastName].filter(Boolean).join(" ") || r.actorFallbackName || null,
          actorUsername: r.actorUsername ?? null,
        }),
      ),
      total: totalRow?.total ?? 0,
      page,
      pageSize,
    };
  }
}
