import { addDays, startOfDay, startOfMonth } from "date-fns";
import { prisma } from "@/lib/prisma";
import { defaultPlan, getPlan, Plan } from "@/lib/plan";
import { SAMPLE_PROJECT_URL } from "@/lib/sample";
import type { OrgRole, SubscriptionStatus } from "@prisma/client";

type UsageDelta = {
  projectsCreated?: number;
  runsStarted?: number;
  postsFetched?: number;
  problemsExtracted?: number;
  exportsCount?: number;
};

function usageWindow(now: Date = new Date()) {
  const start = startOfMonth(now);
  const end = addDays(start, 32);
  end.setDate(0); // end of month
  return { start, end };
}

export async function ensureOrgForUser(userId: string, userEmail?: string | null) {
  const membership = await prisma.membership.findFirst({ where: { userId }, select: { orgId: true } });
  if (membership) return membership.orgId;

  const name = userEmail ? `${userEmail.split("@")[0]}'s Org` : "My Organization";
  const { start, end } = usageWindow();

  const org = await prisma.organization.create({
    data: { name, ownerId: userId },
    select: { id: true },
  });

  await prisma.membership.create({
    data: { userId, orgId: org.id, role: "OWNER" },
  });

  await prisma.organizationSubscription.create({
    data: {
      orgId: org.id,
      status: "TRIAL",
      plan: "free",
      trialEndsAt: addDays(new Date(), 14),
    },
  });

  await prisma.organizationUsage.create({
    data: {
      orgId: org.id,
      periodStart: start,
      periodEnd: end,
    },
  });

  return org.id;
}

export async function getMembershipForUser(userId: string) {
  const membership = await prisma.membership.findFirst({
    where: { userId },
    select: { orgId: true, role: true },
  });
  return membership;
}

export async function requireOrgContext(userId: string) {
  const membership = await getMembershipForUser(userId);
  if (!membership) {
    const orgId = await ensureOrgForUser(userId);
    return { orgId, role: "OWNER" as OrgRole };
  }
  return { orgId: membership.orgId, role: membership.role };
}

export async function getOrgPlan(orgId: string): Promise<{ plan: Plan; status: SubscriptionStatus }> {
  const sub = await prisma.organizationSubscription.findUnique({
    where: { orgId },
    select: { plan: true, status: true, trialEndsAt: true },
  });

  if (!sub) return { plan: defaultPlan(), status: "INACTIVE" };

  const now = new Date();
  if (sub.trialEndsAt && sub.trialEndsAt > now && sub.status === "TRIAL") {
    return { plan: getPlan(sub.plan), status: "TRIAL" };
  }

  return { plan: getPlan(sub.plan), status: sub.status };
}

async function ensureUsage(orgId: string) {
  const existing = await prisma.organizationUsage.findUnique({ where: { orgId } });
  const { start, end } = usageWindow();

  if (!existing) {
    return prisma.organizationUsage.create({
      data: { orgId, periodStart: start, periodEnd: end },
    });
  }

  if (existing.periodEnd < new Date()) {
    return prisma.organizationUsage.update({
      where: { orgId },
      data: {
        periodStart: start,
        periodEnd: end,
        projectsCreated: 0,
        runsStarted: 0,
        postsFetched: 0,
        problemsExtracted: 0,
        exportsCount: 0,
      },
    });
  }

  return existing;
}

export async function getUsage(orgId: string) {
  return ensureUsage(orgId);
}

export async function bumpUsage(orgId: string, delta: UsageDelta) {
  await ensureUsage(orgId);
  await prisma.organizationUsage.update({
    where: { orgId },
    data: {
      projectsCreated: { increment: delta.projectsCreated ?? 0 },
      runsStarted: { increment: delta.runsStarted ?? 0 },
      postsFetched: { increment: delta.postsFetched ?? 0 },
      problemsExtracted: { increment: delta.problemsExtracted ?? 0 },
      exportsCount: { increment: delta.exportsCount ?? 0 },
    },
  });
}

export async function assertProjectQuota(orgId: string, plan: Plan) {
  const count = await prisma.project.count({ where: { orgId, NOT: { url: SAMPLE_PROJECT_URL } } });
  if (count >= plan.limits.maxProjects) {
    throw new Error(`Plan limit reached: ${plan.limits.maxProjects} projects. Upgrade to add more.`);
  }
}

export async function assertRunQuota(orgId: string, plan: Plan) {
  const since = startOfDay(new Date());
  const runsToday = await prisma.projectRun.count({
    where: { orgId, createdAt: { gte: since } },
  });
  if (runsToday >= plan.limits.maxRunsPerDay) {
    throw new Error(`Daily run limit reached (${plan.limits.maxRunsPerDay}). Upgrade to run more.`);
  }
}

export async function assertSourceAllowed(orgId: string, plan: Plan, sources: string[]) {
  const invalid = sources.filter((s) => !plan.limits.allowedSources.includes(s));
  if (invalid.length > 0) {
    throw new Error(`Your plan does not allow: ${invalid.join(", ")}. Upgrade to enable these sources.`);
  }
}

export async function assertPostAndProblemLimits(orgId: string, plan: Plan, incomingPosts: number) {
  const usage = await ensureUsage(orgId);
  if (usage.postsFetched + incomingPosts > plan.limits.maxPosts) {
    throw new Error(`Plan limit reached: ${plan.limits.maxPosts} posts/month. Upgrade to continue.`);
  }
  if (usage.problemsExtracted > plan.limits.maxProblems) {
    throw new Error(`Plan limit reached: ${plan.limits.maxProblems} problems/month. Upgrade to continue.`);
  }
}
