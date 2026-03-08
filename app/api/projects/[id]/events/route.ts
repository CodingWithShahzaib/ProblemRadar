import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const DEFAULT_INTERVAL = 2000;

function parseKeywords(json: string | null) {
  if (!json) return [];
  try {
    const arr = JSON.parse(json) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => String(x)).filter(Boolean).slice(0, 20);
  } catch {
    return [];
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let closeRef: null | (() => void) = null;
  const stream = new ReadableStream({
    start(controller) {
      let timer: ReturnType<typeof setInterval> | null = null;
      let alive = true;
      let inFlight = false;
      const encoder = new TextEncoder();

      const close = () => {
        if (!alive) return;
        alive = false;
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
        req.signal.removeEventListener("abort", close);
        try {
          controller.close();
        } catch {
          // ignore if already closed
        }
      };

      closeRef = close;
      req.signal.addEventListener("abort", close);

      const safeEnqueue = (chunk: string) => {
        if (!alive) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };

      const send = async () => {
        if (!alive || inFlight) return;
        inFlight = true;
        try {
          const project = await prisma.project.findUnique({
            where: { id },
            select: {
              id: true,
              url: true,
              createdAt: true,
              status: true,
              stage: true,
              errorMessage: true,
              keywordsJson: true,
              keywordCount: true,
              postCount: true,
              problemCount: true,
              clusterCount: true,
            },
          });
          if (!alive) return;
          if (!project) {
            safeEnqueue(`event: error\ndata: ${JSON.stringify({ error: "not_found" })}\n\n`);
            close();
            return;
          }

          const runs = await prisma.projectRun.findMany({
            where: { projectId: id },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              id: true,
              status: true,
              stage: true,
              errorMessage: true,
              createdAt: true,
              updatedAt: true,
            },
          });
          if (!alive) return;

          const { keywordsJson, ...rest } = project;
          const payload = { project: { ...rest, keywords: parseKeywords(keywordsJson) }, runs };
          safeEnqueue(`data: ${JSON.stringify(payload)}\n\n`);

          if (project.status === "DONE" || project.status === "ERROR") {
            close();
          }
        } catch (err) {
          safeEnqueue(
            `event: error\ndata: ${JSON.stringify({ error: (err as Error).message })}\n\n`
          );
        } finally {
          inFlight = false;
        }
      };

      safeEnqueue(": connected\n\n");
      void send().catch(() => close());
      timer = setInterval(() => {
        void send().catch(() => close());
      }, DEFAULT_INTERVAL);
    },
    cancel() {
      closeRef?.();
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

