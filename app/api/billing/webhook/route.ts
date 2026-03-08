import { NextResponse } from "next/server";
import Stripe from "stripe";

import { handleStripeEvent } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!secret || !stripeKey) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const body = await req.text();
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-11-20" });

  try {
    const event = stripe.webhooks.constructEvent(body, sig, secret);
    await handleStripeEvent(event);
    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
