import { searchRedditPosts } from "@/lib/reddit";
import { searchOpenAIWebPosts } from "@/lib/search-openai-web";
import axios from "axios";

export type IngestionSource = "REDDIT" | "OPENAI_WEB" | "X" | "HACKER_NEWS" | "PRODUCT_HUNT" | "G2" | "APP_STORE";

export type NormalizedPost = {
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  upvotes: number;
  comments: number;
  post_url: string;
  created_at: string | null;
};

export async function fetchPostsFromSource(source: IngestionSource, keyword: string, limit = 10): Promise<NormalizedPost[]> {
  switch (source) {
    case "REDDIT": {
      const res = await searchRedditPosts({ keyword, limit, time: "year" });
      return res.map((p) => ({
        title: p.title,
        selftext: p.selftext,
        author: p.author,
        subreddit: p.subreddit,
        upvotes: p.upvotes,
        comments: p.comments,
        post_url: p.post_url,
        created_at: p.created_at,
      }));
    }
    case "HACKER_NEWS": {
      const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(keyword)}&tags=story&hitsPerPage=${limit}`;
      const res = await axios.get(url, { timeout: 10_000 });
      type HNHit = {
        title?: string;
        story_title?: string;
        story_text?: string;
        _highlightResult?: { comment_text?: { value?: string } };
        author?: string;
        points?: number;
        num_comments?: number;
        url?: string;
        objectID?: string;
        created_at?: string;
      };
      const hits = (res.data?.hits ?? []) as HNHit[];
      return hits.map((h) => ({
        title: String(h.title ?? h.story_title ?? "(untitled)"),
        selftext: String(h.story_text ?? h._highlightResult?.comment_text?.value ?? ""),
        author: String(h.author ?? "hn"),
        subreddit: "hackernews",
        upvotes: Number(h.points ?? 0),
        comments: Number(h.num_comments ?? 0),
        post_url: h.url || (h.objectID ? `https://news.ycombinator.com/item?id=${h.objectID}` : ""),
        created_at: typeof h.created_at === "string" ? h.created_at : null,
      }));
    }
    case "X":
      return searchOpenAIWebPosts({ keyword, limit, sourceHint: "Twitter/X" });
    case "PRODUCT_HUNT":
      return searchOpenAIWebPosts({ keyword, limit, sourceHint: "Product Hunt launches and comments" });
    case "G2":
      return searchOpenAIWebPosts({ keyword, limit, sourceHint: "G2 or Capterra reviews" });
    case "APP_STORE":
      return searchOpenAIWebPosts({ keyword, limit, sourceHint: "Apple App Store or Google Play reviews" });
    case "OPENAI_WEB":
    default:
      return searchOpenAIWebPosts({ keyword, limit });
  }
}
