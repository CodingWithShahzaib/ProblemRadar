import { NextResponse } from "next/server";

import { extractKeywordsFromUrlWithOpenAIWeb } from "@/lib/keywords-openai-web";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { url?: string; limit?: unknown };
    const url = typeof body.url === "string" ? body.url : "";
    if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

    const rawLimit = body.limit;
    const parsedLimit =
      typeof rawLimit === "number"
        ? rawLimit
        : typeof rawLimit === "string"
          ? Number(rawLimit)
          : Number.NaN;
    const requestedLimit = Number.isFinite(parsedLimit) ? parsedLimit : undefined;
    const defaultLimit = Number(process.env.KEYWORD_LIMIT) || 20;

    const keywords = await extractKeywordsFromUrlWithOpenAIWeb({
      url,
      limit: requestedLimit ?? defaultLimit,
    });

    return NextResponse.json({
      inputUrl: url,
      finalUrl: url,
      keywords,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Keyword extraction failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

