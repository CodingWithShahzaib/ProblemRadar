export type PlanId = "free" | "pro" | "team";

export type PlanLimits = {
  maxProjects: number;
  maxRunsPerDay: number;
  maxPosts: number;
  maxProblems: number;
  allowedSources: string[];
  seats: number;
};

export type Plan = {
  id: PlanId;
  name: string;
  priceId: string | null;
  trialDays?: number;
  limits: PlanLimits;
  cta?: string;
};

const sourcesAll = ["REDDIT", "OPENAI_WEB", "X", "HACKER_NEWS", "PRODUCT_HUNT", "G2", "APP_STORE"];

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Starter",
    priceId: null,
    limits: {
      maxProjects: 2,
      maxRunsPerDay: 3,
      maxPosts: 400,
      maxProblems: 200,
      seats: 1,
      allowedSources: ["REDDIT", "OPENAI_WEB"],
    },
    cta: "Start for free",
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceId: process.env.STRIPE_PRICE_PRO ?? null,
    trialDays: 14,
    limits: {
      maxProjects: 10,
      maxRunsPerDay: 25,
      maxPosts: 4000,
      maxProblems: 2000,
      seats: 5,
      allowedSources: sourcesAll,
    },
    cta: "Upgrade to Pro",
  },
  team: {
    id: "team",
    name: "Team",
    priceId: process.env.STRIPE_PRICE_TEAM ?? null,
    limits: {
      maxProjects: 30,
      maxRunsPerDay: 60,
      maxPosts: 12000,
      maxProblems: 8000,
      seats: 20,
      allowedSources: sourcesAll,
    },
    cta: "Talk to sales",
  },
};

export function getPlan(id: string | null | undefined): Plan {
  if (id === "pro") return PLANS.pro;
  if (id === "team") return PLANS.team;
  return PLANS.free;
}

export function defaultPlan(): Plan {
  return PLANS.free;
}
