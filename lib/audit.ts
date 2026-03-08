import { prisma } from "@/lib/prisma";

export async function audit(params: {
  orgId?: string | null;
  userId?: string | null;
  action: string;
  target?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        orgId: params.orgId ?? null,
        userId: params.userId ?? null,
        action: params.action,
        target: params.target ?? null,
        metadataJson: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  } catch {
    // best-effort
  }
}
