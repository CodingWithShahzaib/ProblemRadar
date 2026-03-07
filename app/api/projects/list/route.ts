import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
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

  return NextResponse.json({ projects });
}

