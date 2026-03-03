export type AuditEventType =
  | "simple_pair_started"
  | "pair_code_resolved"
  | "pair_claimed"
  | "pair_approved"
  | "pair_expired";

export interface AuditEvent {
  type: AuditEventType;
  at: string;
  actor?: string;
  sessionId?: string;
  requestId?: string;
  ip?: string;
  ua?: string;
}

export class AuditLog {
  private events: AuditEvent[] = [];

  record(event: Omit<AuditEvent, "at">) {
    this.events.push({ ...event, at: new Date().toISOString() });
  }

  list(limit = 100) {
    return this.events.slice(-limit).reverse();
  }
}
