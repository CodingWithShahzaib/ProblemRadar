import { prisma } from "@/lib/prisma";
import { embedTexts } from "@/lib/openai";

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let a2 = 0;
  let b2 = 0;
  for (let i = 0; i < a.length && i < b.length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    a2 += x * x;
    b2 += y * y;
  }
  if (a2 === 0 || b2 === 0) return 0;
  return dot / (Math.sqrt(a2) * Math.sqrt(b2));
}

function addVec(a: number[], b: number[]) {
  const out = new Array<number>(Math.max(a.length, b.length)).fill(0);
  for (let i = 0; i < out.length; i++) out[i] = (a[i] ?? 0) + (b[i] ?? 0);
  return out;
}

function scaleVec(a: number[], s: number) {
  return a.map((v) => v * s);
}

function safeParseEmbedding(json: string | null) {
  if (!json) return null;
  try {
    const arr = JSON.parse(json) as unknown;
    if (!Array.isArray(arr)) return null;
    const nums = arr.map((n) => Number(n)).filter((n) => Number.isFinite(n));
    return nums.length > 0 ? nums : null;
  } catch {
    return null;
  }
}

const CLUSTER_STOPWORDS = new Set(
  [
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "can",
    "cannot",
    "could",
    "do",
    "does",
    "for",
    "from",
    "has",
    "have",
    "i",
    "in",
    "is",
    "it",
    "its",
    "of",
    "on",
    "or",
    "that",
    "the",
    "their",
    "this",
    "to",
    "too",
    "was",
    "we",
    "with",
    "you",
    "your",
  ].map((w) => w.toLowerCase())
);

function clusterNameFromTexts(texts: string[]) {
  const counts = new Map<string, number>();
  for (const t of texts) {
    const tokens = t
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, " ")
      .split(/\s+/g)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((w) => w.length >= 3 && w.length <= 18)
      .filter((w) => !CLUSTER_STOPWORDS.has(w));

    for (const tok of tokens) counts.set(tok, (counts.get(tok) ?? 0) + 1);
  }

  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([w]) => w);

  if (top.length === 0) return "General";
  return top.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

type ProblemVector = {
  id: string;
  problemText: string;
  embedding: number[];
};

export async function clusterProblemsForProject(params: {
  projectId: string;
  similarityThreshold?: number;
}) {
  const threshold = Math.max(0.5, Math.min(0.95, params.similarityThreshold ?? 0.82));

  // Reset previous clustering for a deterministic rerun.
  await prisma.problem.updateMany({
    where: { post: { projectId: params.projectId } },
    data: { clusterId: null },
  });
  await prisma.cluster.deleteMany({ where: { projectId: params.projectId } });

  // Embed any new problems without an embedding.
  const missing = await prisma.problem.findMany({
    where: {
      post: { projectId: params.projectId },
      embeddingJson: null,
    },
    select: { id: true, problemText: true },
    orderBy: { createdAt: "asc" },
    take: 500,
  });

  const embedBatchSize = 100;
  for (let i = 0; i < missing.length; i += embedBatchSize) {
    const batch = missing.slice(i, i + embedBatchSize);
    const vectors = await embedTexts(batch.map((p) => p.problemText));

    await Promise.all(
      batch.map((p, idx) =>
        prisma.problem.update({
          where: { id: p.id },
          data: { embeddingJson: JSON.stringify(vectors[idx] ?? []) },
        })
      )
    );
  }

  const problems = await prisma.problem.findMany({
    where: { post: { projectId: params.projectId } },
    select: { id: true, problemText: true, embeddingJson: true },
    orderBy: { createdAt: "asc" },
    take: 2000,
  });

  const vectors: ProblemVector[] = problems
    .map((p) => {
      const emb = safeParseEmbedding(p.embeddingJson);
      if (!emb) return null;
      return { id: p.id, problemText: p.problemText, embedding: emb };
    })
    .filter(Boolean) as ProblemVector[];

  type ClusterAcc = {
    memberIds: string[];
    memberTexts: string[];
    centroid: number[];
  };

  const clusters: ClusterAcc[] = [];

  for (const v of vectors) {
    let bestIdx = -1;
    let bestSim = -1;
    for (let i = 0; i < clusters.length; i++) {
      const sim = cosineSimilarity(v.embedding, clusters[i].centroid);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }

    if (bestIdx === -1 || bestSim < threshold) {
      clusters.push({
        memberIds: [v.id],
        memberTexts: [v.problemText],
        centroid: v.embedding,
      });
    } else {
      const c = clusters[bestIdx];
      c.memberIds.push(v.id);
      c.memberTexts.push(v.problemText);
      const n = c.memberIds.length;
      // centroid = (prev_sum + v) / n  (avoid storing sum separately)
      c.centroid = scaleVec(addVec(scaleVec(c.centroid, n - 1), v.embedding), 1 / n);
    }
  }

  // Persist clusters and assignments.
  for (const c of clusters) {
    const cluster = await prisma.cluster.create({
      data: {
        projectId: params.projectId,
        clusterName: clusterNameFromTexts(c.memberTexts),
      },
      select: { id: true },
    });

    await prisma.problem.updateMany({
      where: { id: { in: c.memberIds } },
      data: { clusterId: cluster.id },
    });
  }

  const clusterCount = await prisma.cluster.count({ where: { projectId: params.projectId } });
  await prisma.project.update({
    where: { id: params.projectId },
    data: { clusterCount },
  });

  return { clusterCount };
}

