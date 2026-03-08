import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { requireOrgContext } from "@/lib/billing";
import { createCheckoutSession } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { orgId } = await requireOrgContext(session.user.id);
    const body = (await req.json()) as { planId?: string; successUrl?: string; cancelUrl?: string };
    const planId = (body.planId ?? "pro") as "free" | "pro" | "team";
    const successUrl = body.successUrl ?? `${process.env.NEXTAUTH_URL ?? ""}/dashboard`;
    const cancelUrl = body.cancelUrl ?? `${process.env.NEXTAUTH_URL ?? ""}/pricing`;

    const url = await createCheckoutSession({
      orgId,
      planId,
      email: session.user.email ?? null,
      successUrl,
      cancelUrl,
    });

    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start checkout.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
