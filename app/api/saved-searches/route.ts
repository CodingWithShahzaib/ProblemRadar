import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { requireOrgContext } from "@/lib/billing";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { orgId } = await requireOrgContext(session.user.id);
  const searches = await prisma.savedSearch.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ searches });
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { orgId } = await requireOrgContext(session.user.id);
    const body = (await req.json()) as { name?: string; keywords?: string[]; sources?: string[] };
    const name = body.name?.trim() || "Saved search";
    const keywords = Array.isArray(body.keywords) ? body.keywords : [];
    const sources = Array.isArray(body.sources) ? body.sources : ["REDDIT"];
    const saved = await prisma.savedSearch.create({
      data: {
        name,
        orgId,
        keywordsJson: JSON.stringify(keywords),
        sourcesJson: JSON.stringify(sources),
        createdByUserId: session.user.id,
      },
    });
    return NextResponse.json({ saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save search.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
