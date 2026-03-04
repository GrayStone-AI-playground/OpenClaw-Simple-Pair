export type Role = "owner" | "viewer";

export type PairState =
  | "issued"
  | "claimed"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "expired";

export interface PairSession {
  sessionId: string;
  shortCode: string;
  createdAt: string;
  expiresAt: string;
  state: PairState;
  createdBy: { type: "dashboard" | "telegram"; id: string };
  claimMeta?: { ip?: string; ua?: string; clientKind?: string; deviceName?: string };
  requestId?: string;
  gatewayRequestId?: string;
}
