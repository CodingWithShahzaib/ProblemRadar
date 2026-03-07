import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { assertSafeHttpUrl } from "@/lib/url";
import { runProjectPipeline } from "@/lib/pipeline";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { url?: string };
    const raw = typeof body.url === "string" ? body.url.trim() : "";
    if (!raw) return NextResponse.json({ error: "Missing url" }, { status: 400 });

    const url = (await assertSafeHttpUrl(raw)).toString();

    const project = await prisma.project.create({
      data: { url, status: "PENDING", stage: "QUEUED" },
      select: { id: true },
    });

    runProjectPipeline(project.id).catch(() => {
      // Pipeline errors are persisted to the project row.
    });

    return NextResponse.json({ projectId: project.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

