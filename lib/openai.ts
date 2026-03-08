import OpenAI from "openai";

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

type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

function extractFirstJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function safeParseJson(text: string): JsonValue | null {
  const candidate = extractFirstJsonObject(text);
  if (!candidate) return null;
  try {
    return JSON.parse(candidate) as JsonValue;
  } catch {
    return null;
  }
}

export type ProblemExtraction = {
  problemText: string | null;
  confidenceScore: number | null;
};

export async function embedTexts(texts: string[]) {
  if (texts.length === 0) return [];
  const model = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
  const openai = getOpenAI();

  const res = await openai.embeddings.create({
    model,
    input: texts,
  });

  return (res.data ?? []).map((d) => d.embedding);
}

export async function extractProblemFromPost(input: {
  title: string;
  content: string;
  subreddit: string;
  source?: string;
  author: string;
  upvotes: number;
  comments: number;
  postUrl: string;
}): Promise<ProblemExtraction> {
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const openai = getOpenAI();

  const prompt = [
    "Extract the main problem or pain point expressed in this post.",
    "Sources can be Reddit, Hacker News, Product Hunt, G2, App Store, X/Twitter, or generic web.",
    "If no problem exists, return null for problemText and confidenceScore.",
    "",
    "Return ONLY valid JSON (no markdown, no extra keys) in this shape:",
    '{ "problemText": string|null, "confidenceScore": number|null }',
    "",
    "Guidelines:",
    "- problemText should be a concise, specific summary (<= 140 chars).",
    "- confidenceScore should be between 0 and 1.",
  ].join("\n");

  const user = [
    `subreddit: ${input.subreddit}`,
    `source: ${input.source ?? "unknown"}`,
    `author: ${input.author}`,
    `upvotes: ${input.upvotes}`,
    `comments: ${input.comments}`,
    `url: ${input.postUrl}`,
    "",
    `title: ${input.title}`,
    "",
    `content:\n${input.content || "(empty)"}`,
  ].join("\n");

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: user },
    ],
  });

  const text = completion.choices?.[0]?.message?.content ?? "";
  const parsed = safeParseJson(text);

  const fallback: ProblemExtraction = { problemText: null, confidenceScore: null };
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fallback;

  const obj = parsed as Record<string, JsonValue>;
  const problemText =
    typeof obj.problemText === "string" && obj.problemText.trim()
      ? obj.problemText.trim()
      : null;

  const confidenceRaw = obj.confidenceScore;
  const confidenceScore =
    typeof confidenceRaw === "number" && Number.isFinite(confidenceRaw)
      ? Math.max(0, Math.min(1, confidenceRaw))
      : null;

  if (!problemText) return fallback;
  return { problemText, confidenceScore: confidenceScore ?? 0.5 };
}

