import { NextResponse } from "next/server";

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getOrgPlan, requireOrgContext, getUsage } from "@/lib/billing";
import { SAMPLE_PROJECT_URL } from "@/lib/sample";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await requireOrgContext(session.user.id);
  const { plan } = await getOrgPlan(orgId);
  const usage = await getUsage(orgId);

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    where: { orgId, NOT: { url: SAMPLE_PROJECT_URL } },
    select: {
      id: true,
      url: true,
      createdAt: true,
      status: true,
      stage: true,
      errorMessage: true,
      keywordCount: true,
      postCount: true,
      problemCount: true,
      clusterCount: true,
    },
  });

  return NextResponse.json({ projects, orgId, plan, usage });
}

