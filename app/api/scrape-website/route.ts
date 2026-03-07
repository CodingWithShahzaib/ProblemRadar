import { NextResponse } from "next/server";

import { scrapeWebsite } from "@/lib/scrape";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { url?: string; includeHtml?: boolean };
    const url = typeof body.url === "string" ? body.url : "";
    if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

    const includeHtml = Boolean(body.includeHtml);
    const scraped = await scrapeWebsite(url);

    return NextResponse.json({
      inputUrl: scraped.inputUrl,
      finalUrl: scraped.finalUrl,
      title: scraped.title,
      description: scraped.description,
      metaKeywords: scraped.metaKeywords,
      headings: scraped.headings,
      mainText: scraped.mainText.slice(0, 40_000),
      html: includeHtml ? scraped.html : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scrape failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

