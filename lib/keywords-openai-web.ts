import OpenAI from "openai";

import { assertSafeHttpUrl } from "@/lib/url";

function requireEnv(name: string) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing ${name} env var.`);
  return val;
}

let cached: OpenAI | null = null;
function getOpenAI() {
  if (cached) return cached;
  cached = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
  return cached;
}

function normalizeKeyword(input: string) {
  return input
    .trim()
    .replace(/^[-•\s"'`]+/, "")
    .replace(/["'`]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseStringArray(raw: string): string[] {
  const text = raw.trim();
  if (!text) return [];

  const tryParse = (candidate: string) => {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (!Array.isArray(parsed)) return null;
      return parsed.map((x) => (typeof x === "string" ? x : String(x))).filter(Boolean);
    } catch {
      return null;
    }
  };

  const direct = tryParse(text);
  if (direct) return direct;

  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    const bracketed = tryParse(text.slice(start, end + 1));
    if (bracketed) return bracketed;
  }

  // Fallback: line-based bullets.
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^[-•\d.]+\s*/, ""))
    .filter(Boolean);
}

export async function extractKeywordsFromUrlWithOpenAIWeb(params: {
  url: string;
  limit?: number;
}): Promise<string[]> {
  const safeUrl = await assertSafeHttpUrl(params.url);
  const limit = Math.max(5, Math.min(20, params.limit ?? 20));
  const model = process.env.OPENAI_MODEL ?? "gpt-4o";
  const openai = getOpenAI();

  const system = [
    "You extract search keywords for finding user discussions (e.g., on Reddit).",
    "Use the web_search tool to understand the website/product at the given URL.",
    "",
    "Return ONLY strict JSON (no markdown, no code fences) as an array of strings.",
    `Return exactly ${limit} items.`,
    "",
    "Rules:",
    "- Each keyword should be a short phrase (1–4 words).",
    "- Prefer concrete product/category/feature terms from the site.",
    "- Avoid generic words like: platform, solution, tool, AI, best, free, pricing.",
    "- Avoid duplicates and near-duplicates.",
    "- Do NOT include full URLs.",
  ].join("\n");

  const response = await openai.responses.create({
    model,
    tools: [{ type: "web_search" }],
    input: [
      {
        role: "user",
        content: `website_url: ${safeUrl.toString()}\nReturn strict JSON array only.`,
      },
      {
        role: "system",
        content: system,
      },
    ],
    max_output_tokens: 1200,
  });

  const raw = response.output_text || "";
  const parsed = parseStringArray(raw);

  const out: string[] = [];
  const seen = new Set<string>();
  for (const k of parsed) {
    const cleaned = normalizeKeyword(k);
    const key = cleaned.toLowerCase();
    if (!cleaned) continue;
    if (cleaned.length < 2 || cleaned.length > 60) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
    if (out.length >= limit) break;
  }

  return out;
}

