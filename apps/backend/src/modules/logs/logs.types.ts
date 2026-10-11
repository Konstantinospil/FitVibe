/**
 * Logs module types
 */

export interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  actorUsername: string | null;
  entityType: string;
  action: string;
  entityId: string | null;
  outcome: string;
  requestId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  severity: "info" | "warning" | "error" | "critical";
  resolvedAt: string | null;
}

export interface ListAuditLogsQuery {
  action?: string | string[];
  entityType?: string;
  actorUserId?: string;
  outcome?: string;
  limit?: number;
  offset?: number;
  requestId?: string;
  severity?: string;
  resolved?: boolean;
  createdFrom?: string;
  createdTo?: string;
}
