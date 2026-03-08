import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { PLANS, getPlan, type PlanId } from "@/lib/plan";

function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing");
  return new Stripe(key, { apiVersion: "2024-11-20" });
}

function planFromPriceId(priceId: string | null | undefined): PlanId {
  if (!priceId) return "free";
  const match = (Object.values(PLANS) as typeof PLANS[keyof typeof PLANS][])
    .find((p) => p.priceId === priceId);
  return match?.id ?? "free";
}

export async function getOrCreateCustomer(orgId: string, email?: string | null) {
  const stripe = getStripeClient();
  const sub = await prisma.organizationSubscription.findUnique({
    where: { orgId },
    select: { stripeCustomerId: true },
  });
  if (sub?.stripeCustomerId) return sub.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: { orgId },
  });

  await prisma.organizationSubscription.upsert({
    where: { orgId },
    update: { stripeCustomerId: customer.id },
    create: { orgId, plan: "free", status: "INACTIVE", stripeCustomerId: customer.id },
  });

  return customer.id;
}

export async function createCheckoutSession(params: {
  orgId: string;
  planId: PlanId;
  email?: string | null;
  successUrl: string;
  cancelUrl: string;
}) {
  const stripe = getStripeClient();
  const plan = getPlan(params.planId);
  if (!plan.priceId) throw new Error("Plan is not purchasable via Stripe.");
  const customer = await getOrCreateCustomer(params.orgId, params.email);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: plan.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    subscription_data: {
      metadata: { orgId: params.orgId, planId: plan.id },
    },
    metadata: { orgId: params.orgId, planId: plan.id },
  });
  return session.url;
}

export async function createBillingPortal(params: { customerId: string; returnUrl: string }) {
  const stripe = getStripeClient();
  const portal = await stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });
  return portal.url;
}

export async function syncSubscriptionFromStripe(sub: Stripe.Subscription) {
  const orgId = (sub.metadata?.orgId as string | undefined) ?? undefined;
  if (!orgId) return;

  const priceId = sub.items.data[0]?.price?.id;
  const planId = planFromPriceId(priceId);
  const statusMap: Record<string, "ACTIVE" | "PAST_DUE" | "CANCELED" | "TRIAL"> = {
    trialing: "TRIAL",
    active: "ACTIVE",
    past_due: "PAST_DUE",
    canceled: "CANCELED",
    unpaid: "PAST_DUE",
    incomplete: "PAST_DUE",
    incomplete_expired: "CANCELED",
  };
  const mapped = statusMap[sub.status] ?? "PAST_DUE";

  await prisma.organizationSubscription.upsert({
    where: { orgId },
    update: {
      stripeSubId: sub.id,
      stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      plan: planId,
      status: mapped,
      currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
    },
    create: {
      orgId,
      plan: planId,
      status: mapped,
      stripeSubId: sub.id,
      stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
    },
  });
}

export async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscriptionFromStripe(event.data.object as Stripe.Subscription);
      break;
    default:
      break;
  }
}
