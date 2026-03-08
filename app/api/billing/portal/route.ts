import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { requireOrgContext } from "@/lib/billing";
import { createBillingPortal } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { orgId } = await requireOrgContext(session.user.id);
    const sub = await prisma.organizationSubscription.findUnique({
      where: { orgId },
      select: { stripeCustomerId: true },
    });
    if (!sub?.stripeCustomerId) {
      return NextResponse.json({ error: "No billing customer found." }, { status: 404 });
    }
    const returnUrl = `${process.env.NEXTAUTH_URL ?? ""}/dashboard`;
    const url = await createBillingPortal({ customerId: sub.stripeCustomerId, returnUrl });
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to open billing portal.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
