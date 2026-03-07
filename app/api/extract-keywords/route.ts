import { NextResponse } from "next/server";

import { scrapeWebsite } from "@/lib/scrape";
import { extractKeywordsFromWebsite } from "@/lib/keywords";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { url?: string };
    const url = typeof body.url === "string" ? body.url : "";
    if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

    const scraped = await scrapeWebsite(url);
    const { keywords } = extractKeywordsFromWebsite(scraped);

    return NextResponse.json({
      inputUrl: scraped.inputUrl,
      finalUrl: scraped.finalUrl,
      keywords,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Keyword extraction failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

