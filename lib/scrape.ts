import axios from "axios";
import * as cheerio from "cheerio";

import { assertSafeHttpUrl } from "@/lib/url";

export type ScrapedWebsite = {
  inputUrl: string;
  finalUrl: string;
  title: string | null;
  description: string | null;
  metaKeywords: string[];
  headings: string[];
  mainText: string;
  html: string;
};

function cleanText(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

function pickMeta($: cheerio.CheerioAPI, selectors: string[]) {
  for (const sel of selectors) {
    const val = $(sel).attr("content");
    if (val && val.trim()) return cleanText(val);
  }
  return null;
}

export async function scrapeWebsite(inputUrl: string): Promise<ScrapedWebsite> {
  const safeUrl = await assertSafeHttpUrl(inputUrl);

  const res = await axios.get<string>(safeUrl.toString(), {
    timeout: 20_000,
    maxRedirects: 5,
    headers: {
      "user-agent":
        "ProblemRadarBot/0.1 (+https://example.com; contact: founder@problemradar.local)",
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    validateStatus: (s) => s >= 200 && s < 400,
    responseType: "text",
  });

  const html = typeof res.data === "string" ? res.data : String(res.data);
  const finalUrl = String(res.request?.res?.responseUrl ?? safeUrl.toString());

  const $ = cheerio.load(html);

  const title =
    cleanText($("title").first().text()) ||
    pickMeta($, ['meta[property="og:title"]', 'meta[name="twitter:title"]']);

  const description = pickMeta($, [
    'meta[name="description"]',
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
  ]);

  const metaKeywords = cleanText($('meta[name="keywords"]').attr("content") ?? "")
    .split(",")
    .map((s) => cleanText(s))
    .filter(Boolean)
    .slice(0, 30);

  const headings = $("h1, h2, h3")
    .toArray()
    .map((el) => cleanText($(el).text()))
    .filter(Boolean)
    .filter((h) => h.length >= 3 && h.length <= 140)
    .slice(0, 80);

  $("script, style, noscript, svg, canvas").remove();
  const mainText = cleanText(
    $("main, article, body")
      .first()
      .text()
      .replace(/\s+/g, " ")
  );

  return {
    inputUrl,
    finalUrl,
    title: title || null,
    description,
    metaKeywords,
    headings,
    mainText,
    html,
  };
}

