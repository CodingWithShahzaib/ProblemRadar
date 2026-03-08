"use client";

import { useState } from "react";
import { Check, Shield, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const plans = [
  {
    id: "free",
    name: "Starter",
    price: "$0",
    desc: "2 projects, Reddit/OpenAI sources, CSV export",
    features: ["2 projects", "3 runs/day", "Reddit + OpenAI web", "CSV export"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$39/mo",
    desc: "All sources + higher limits",
    features: ["10 projects", "25 runs/day", "All sources", "Slack/webhook alerts"],
    highlight: "Most popular",
    cta: "Upgrade",
  },
  {
    id: "team",
    name: "Team",
    price: "Contact",
    desc: "Seats, SSO, SLA",
    features: ["Seats & SSO", "Usage add-ons", "Admin controls", "Priority support"],
    cta: "Talk to us",
  },
];

export default function PricingPage() {
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  async function startCheckout(planId: string) {
    setBusyPlan(planId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? "Failed to start checkout");
      }
    } finally {
      setBusyPlan(null);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <div className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground w-fit">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          Production-ready billing, with upgrades in one click.
        </div>
        <h1 className="text-3xl font-semibold">Pricing</h1>
        <p className="text-muted-foreground">Built for founders—start free, upgrade when you need more runs, sources, or compliance.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`relative ${plan.id === "pro" ? "border-primary/50 shadow-lg shadow-primary/10" : ""}`}
          >
            {plan.highlight ? (
              <Badge className="absolute right-3 top-3" variant="secondary">
                {plan.highlight}
              </Badge>
            ) : null}
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl">{plan.name}</CardTitle>
              <div className="text-2xl font-semibold">{plan.price}</div>
              <p className="text-sm text-muted-foreground">{plan.desc}</p>
            </CardHeader>
            <CardContent className="grid gap-2">
              <ul className="grid gap-2 text-sm text-muted-foreground">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-3"
                variant={plan.id === "free" ? "outline" : "default"}
                disabled={busyPlan !== null}
                onClick={() => {
                  if (plan.id === "team") {
                    window.location.href = "mailto:sales@problemradar.local";
                    return;
                  }
                  if (plan.id === "free") {
                    window.location.href = "/dashboard";
                    return;
                  }
                  void startCheckout(plan.id);
                }}
              >
                {plan.id === "free" ? "Stay on free" : plan.cta ?? "Upgrade"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Plan comparison</CardTitle>
          <Badge variant="secondary">All plans include exports + reruns</Badge>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground">
          <div className="grid gap-2 rounded-2xl border bg-muted/30 p-3 sm:grid-cols-4">
            <div className="font-medium text-foreground">Projects</div>
            <div>Starter: 2</div>
            <div>Pro: 10</div>
            <div>Team: custom</div>
          </div>
          <div className="grid gap-2 rounded-2xl border bg-muted/30 p-3 sm:grid-cols-4">
            <div className="font-medium text-foreground">Runs per day</div>
            <div>Starter: 3</div>
            <div>Pro: 25</div>
            <div>Team: custom with burst</div>
          </div>
          <div className="grid gap-2 rounded-2xl border bg-muted/30 p-3 sm:grid-cols-4">
            <div className="font-medium text-foreground">Sources</div>
            <div>Starter: Reddit + OpenAI web</div>
            <div>Pro: All sources unlocked</div>
            <div>Team: Custom feeds + SSO</div>
          </div>
          <div className="grid gap-2 rounded-2xl border bg-muted/30 p-3 sm:grid-cols-4">
            <div className="font-medium text-foreground">Support</div>
            <div>Starter: community</div>
            <div>Pro: email within 1 business day</div>
            <div>Team: SLA & success channel</div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>FAQs</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground">How do upgrades work?</p>
              <p>Pro bills monthly and unlocks all sources instantly. Team is invoiced with custom limits.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Can I rerun without losing data?</p>
              <p>Yes—BullMQ worker + retry-safe pipeline lets you rerun from any stage without wiping posts.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Do you support exports?</p>
              <p>CSV is built-in. Webhook delivery is available on all plans to feed Slack/CRM.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Need SSO or SOC2?</p>
              <p>Choose Team and we will scope SSO, audit logs, and enterprise terms.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/40 shadow-lg shadow-primary/10">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Talk to us</CardTitle>
              <p className="text-sm text-muted-foreground">Security review or volume pricing.</p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <span>Under 24h response for Team inquiries.</span>
            </div>
            <Button asChild>
              <a href="mailto:sales@problemradar.local">Contact sales</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="https://status.problemradar.local" target="_blank" rel="noreferrer">
                Status page
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
