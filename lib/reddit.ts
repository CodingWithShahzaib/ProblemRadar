import axios from "axios";

export type RedditSearchResult = {
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  upvotes: number;
  comments: number;
  post_url: string;
  created_at: string; // ISO
};

type TokenCache = {
  token: string;
  expiresAtMs: number;
};

let tokenCache: TokenCache | null = null;

function requireEnv(name: string) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing ${name} env var.`);
  return val;
}

async function getAppAccessToken() {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAtMs - now > 30_000) return tokenCache.token;

  const clientId = requireEnv("REDDIT_CLIENT_ID");
  const secret = requireEnv("REDDIT_SECRET");
  const userAgent = requireEnv("REDDIT_USER_AGENT");

  const basic = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const res = await axios.post(
    "https://www.reddit.com/api/v1/access_token",
    new URLSearchParams({ grant_type: "client_credentials" }),
    {
      timeout: 15_000,
      headers: {
        authorization: `Basic ${basic}`,
        "user-agent": userAgent,
        "content-type": "application/x-www-form-urlencoded",
      },
    }
  );

  const token = String(res.data?.access_token ?? "");
  const expiresInSec = Number(res.data?.expires_in ?? 0);
  if (!token || !Number.isFinite(expiresInSec) || expiresInSec <= 0) {
    throw new Error("Failed to obtain Reddit access token.");
  }

  tokenCache = {
    token,
    expiresAtMs: Date.now() + expiresInSec * 1000,
  };
  return token;
}

export async function searchRedditPosts(params: {
  keyword: string;
  limit?: number;
  time?: "hour" | "day" | "week" | "month" | "year" | "all";
  sort?: "relevance" | "hot" | "top" | "new" | "comments";
}): Promise<RedditSearchResult[]> {
  const keyword = params.keyword.trim();
  if (!keyword) return [];

  const limit = Math.max(1, Math.min(100, params.limit ?? 20));
  const time = params.time ?? "year";
  const sort = params.sort ?? "relevance";

  const token = await getAppAccessToken();
  const userAgent = requireEnv("REDDIT_USER_AGENT");

  const res = await axios.get("https://oauth.reddit.com/search", {
    timeout: 20_000,
    headers: {
      authorization: `Bearer ${token}`,
      "user-agent": userAgent,
    },
    params: {
      q: keyword,
      limit,
      sort,
      t: time,
      type: "link",
      include_over_18: "on",
      raw_json: 1,
    },
    validateStatus: (s) => s >= 200 && s < 400,
  });

  const children: any[] = res.data?.data?.children ?? [];
  const normalized: RedditSearchResult[] = [];

  for (const c of children) {
    const d = c?.data;
    if (!d) continue;

    const title = String(d.title ?? "").trim();
    const selftext = String(d.selftext ?? "").trim();
    const author = String(d.author ?? "").trim();
    const subreddit = String(d.subreddit ?? "").trim();
    const upvotes = Number(d.ups ?? 0);
    const comments = Number(d.num_comments ?? 0);
    const permalink = String(d.permalink ?? "").trim();
    const post_url = permalink
      ? `https://www.reddit.com${permalink}`
      : String(d.url ?? "").trim();
    const createdUtc = Number(d.created_utc ?? 0);

    if (!title || !author || !subreddit || !post_url) continue;

    normalized.push({
      title,
      selftext,
      author,
      subreddit,
      upvotes: Number.isFinite(upvotes) ? upvotes : 0,
      comments: Number.isFinite(comments) ? comments : 0,
      post_url,
      created_at: new Date(
        Number.isFinite(createdUtc) && createdUtc > 0 ? createdUtc * 1000 : Date.now()
      ).toISOString(),
    });
  }

  // Dedupe by URL (API can return duplicates across kinds).
  const seen = new Set<string>();
  return normalized.filter((p) => {
    if (seen.has(p.post_url)) return false;
    seen.add(p.post_url);
    return true;
  });
}

