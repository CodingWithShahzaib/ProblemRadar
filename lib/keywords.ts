import type { ScrapedWebsite } from "@/lib/scrape";

const STOPWORDS = new Set(
  [
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "but",
    "by",
    "can",
    "could",
    "do",
    "does",
    "for",
    "from",
    "has",
    "have",
    "how",
    "i",
    "if",
    "in",
    "into",
    "is",
    "it",
    "its",
    "just",
    "may",
    "more",
    "my",
    "no",
    "not",
    "of",
    "on",
    "or",
    "our",
    "s",
    "so",
    "such",
    "t",
    "than",
    "that",
    "the",
    "their",
    "then",
    "there",
    "these",
    "they",
    "this",
    "to",
    "too",
    "us",
    "use",
    "using",
    "was",
    "we",
    "were",
    "what",
    "when",
    "where",
    "which",
    "who",
    "will",
    "with",
    "you",
    "your",
  ].map((w) => w.toLowerCase())
);

function normalizeToken(t: string) {
  return t
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(text: string) {
  const normalized = normalizeToken(text);
  if (!normalized) return [];
  return normalized
    .split(/\s+/g)
    .map((w) => w.trim())
    .filter(Boolean)
    .filter((w) => w.length >= 2 && w.length <= 24)
    .filter((w) => !STOPWORDS.has(w));
}

function addScore(map: Map<string, number>, phrase: string, score: number) {
  const key = phrase.trim().replace(/\s+/g, " ");
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + score);
}

function ngrams(tokens: string[], n: number) {
  const out: string[] = [];
  for (let i = 0; i + n <= tokens.length; i++) {
    const slice = tokens.slice(i, i + n);
    if (slice.some((t) => STOPWORDS.has(t))) continue;
    out.push(slice.join(" "));
  }
  return out;
}

function preferHumanPhrase(phrase: string) {
  // Title-case acronyms lightly (e.g. "ats" -> "ATS") without heavy NLP.
  return phrase.replace(/\bats\b/gi, "ATS").trim();
}

export type KeywordExtractionResult = {
  keywords: string[];
};

export function extractKeywordsFromWebsite(website: ScrapedWebsite): KeywordExtractionResult {
  const scores = new Map<string, number>();

  // Strong signals: meta keywords, title, headings, description.
  for (const kw of website.metaKeywords) {
    const toks = tokenize(kw);
    if (toks.length === 0) continue;
    addScore(scores, toks.slice(0, 4).join(" "), 8);
  }

  if (website.title) {
    const toks = tokenize(website.title);
    for (const p of [...ngrams(toks, 2), ...ngrams(toks, 3)]) addScore(scores, p, 6);
    for (const t of toks.slice(0, 10)) addScore(scores, t, 2);
  }

  if (website.description) {
    const toks = tokenize(website.description);
    for (const p of [...ngrams(toks, 2), ...ngrams(toks, 3)]) addScore(scores, p, 3);
  }

  for (const h of website.headings) {
    const toks = tokenize(h);
    for (const p of [...ngrams(toks, 2), ...ngrams(toks, 3)]) addScore(scores, p, 5);
    for (const t of toks.slice(0, 8)) addScore(scores, t, 1.5);
  }

  // Main text: TF-style scoring, with slight downweight to avoid noisy terms.
  const bodyTokens = tokenize(website.mainText);
  const tf = new Map<string, number>();
  for (const t of bodyTokens) tf.set(t, (tf.get(t) ?? 0) + 1);

  for (const [term, count] of tf) {
    const capped = Math.min(count, 30);
    addScore(scores, term, Math.log(1 + capped));
  }

  for (const p of ngrams(bodyTokens.slice(0, 3_000), 2)) addScore(scores, p, 0.9);
  for (const p of ngrams(bodyTokens.slice(0, 3_000), 3)) addScore(scores, p, 0.7);

  const sorted = [...scores.entries()]
    .filter(([k]) => k.length >= 3 && k.length <= 60)
    .sort((a, b) => b[1] - a[1]);

  const selected: string[] = [];
  const seen = new Set<string>();

  for (const [phrase] of sorted) {
    const normalized = phrase.toLowerCase();
    if (seen.has(normalized)) continue;

    // Avoid near-duplicates where one phrase contains another (simple heuristic).
    if (selected.some((s) => s.toLowerCase().includes(normalized) || normalized.includes(s.toLowerCase())))
      continue;

    selected.push(preferHumanPhrase(phrase));
    seen.add(normalized);
    if (selected.length >= 10) break;
  }

  return { keywords: selected };
}

