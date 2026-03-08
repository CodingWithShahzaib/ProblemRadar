import OpenAI from "openai";

function requireEnv(name: string) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing ${name} env var.`);
  return val;
}

const client = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });

export type OpenAIWebPost = {
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  upvotes: number;
  comments: number;
  post_url: string;
  created_at: string | null;
};

export async function searchOpenAIWebPosts(params: {
  keyword: string;
  limit?: number;
  sourceHint?: string;
}): Promise<OpenAIWebPost[]> {
  const keyword = params.keyword.trim();
  if (!keyword) return [];
  const limit = Math.max(3, Math.min(20, params.limit ?? 10));

  const prompt = [
    "Search the public web (Reddit allowed) for recent posts matching this keyword.",
    params.sourceHint ? `Prefer results from: ${params.sourceHint}.` : "",
    "Return EXACT JSON (no code fences, no markdown). Shape:",
    '[{ "title": string, "selftext": string, "author": string, "subreddit": string, "upvotes": number, "comments": number, "post_url": string, "created_at": string|null }]',
    `Rules (max ${limit} items):`,
    "- Prefer real Reddit results when available.",
    '- subreddit: if unknown, set to "web".',
    '- author: if unknown, set to "unknown".',
    "- created_at: ISO string if known, else null.",
  ].join("\n");

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    tools: [{ type: "web_search" }],
    input: [
      {
        role: "user",
        content: `keyword: ${keyword}\nReturn strict JSON array only.`,
      },
      {
        role: "system",
        content: prompt,
      },
    ],
    max_output_tokens: 2000,
  });

  const text = response.output_text || "";

  let parsed: unknown = [];
  try {
    parsed = JSON.parse(text);
  } catch {
    // If the model wrapped in an object, try to unwrap first array-like property.
    try {
      const maybeObj = JSON.parse(text);
      if (maybeObj && typeof maybeObj === "object") {
        const firstArray = Object.values(maybeObj).find((v) => Array.isArray(v));
        if (Array.isArray(firstArray)) parsed = firstArray;
      }
    } catch {
      parsed = [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  return (parsed as unknown[]).slice(0, limit).map((item) => {
    const obj = (typeof item === "object" && item ? item : {}) as Record<string, unknown>;
    return {
      title: String(obj.title ?? "").slice(0, 300) || "(untitled)",
      selftext: String(obj.selftext ?? ""),
      author: String(obj.author ?? "unknown"),
      subreddit: String(obj.subreddit ?? "web"),
      upvotes: Number.isFinite(obj.upvotes as number) ? Number(obj.upvotes) : 0,
      comments: Number.isFinite(obj.comments as number) ? Number(obj.comments) : 0,
      post_url: String(obj.post_url ?? ""),
      created_at: typeof obj.created_at === "string" ? (obj.created_at as string) : null,
    };
  });
}

