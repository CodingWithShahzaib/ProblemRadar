import { PostSource, ProjectStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { extractKeywordsFromUrlWithOpenAIWeb } from "@/lib/keywords-openai-web";
import { analyzePostsForProject } from "@/lib/problem-detection";
import { clusterProblemsForProject } from "@/lib/clustering";
import { fetchPostsFromSource, type IngestionSource } from "@/lib/sources";
import { bumpUsage, getOrgPlan, assertPostAndProblemLimits } from "@/lib/billing";
import { defaultPlan } from "@/lib/plan";
import { audit } from "@/lib/audit";
import { sendSlackAlert } from "@/lib/alerts";

async function setProjectState(projectId: string, data: Parameters<typeof prisma.project.update>[0]["data"]) {
  await prisma.project.update({ where: { id: projectId }, data });
}

async function setRunState(
  runId: string | null | undefined,
  data: Parameters<typeof prisma.projectRun.update>[0]["data"]
) {
  if (!runId) return;
  try {
    await prisma.projectRun.update({ where: { id: runId }, data });
  } catch {
    // ignore if run missing
  }
}

async function logRun(runId: string | null | undefined, stage: ProjectStage, message: string) {
  if (!runId) return;
  try {
    await prisma.projectRunLog.create({
      data: { runId, stage, message },
    });
  } catch {
    // swallow logging issues
  }
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export type PipelineStartStage =
  | "SCRAPE"
  | "KEYWORDS"
  | "REDDIT_FETCH"
  | "AI_EXTRACT"
  | "CLUSTER";

function safeDate(input: string | null | undefined) {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 3, baseDelay = 800) {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const delay = baseDelay * Math.pow(2, i) + Math.random() * 150;
      console.warn(`[pipeline:${label}] attempt ${i + 1} failed; retrying in ${delay}ms`);
      await sleep(delay);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(label ? `Failed after retries: ${label}` : "Failed after retries");
}

export async function runProjectPipeline(
  projectId: string,
  opts?: { startStage?: PipelineStartStage; resetData?: boolean; runId?: string }
) {
  try {
    if (opts?.resetData) {
      await prisma.problem.deleteMany({ where: { post: { projectId } } });
      await prisma.cluster.deleteMany({ where: { projectId } });
      await prisma.post.deleteMany({ where: { projectId } });
      await setProjectState(projectId, {
        postCount: 0,
        problemCount: 0,
        clusterCount: 0,
      });
    }

    await setProjectState(projectId, {
      status: "RUNNING",
      stage: "SCRAPE",
      errorMessage: null,
    });
    await setRunState(opts?.runId, { status: "RUNNING", stage: "SCRAPE", errorMessage: null });
    await logRun(opts?.runId, "SCRAPE", "Run started");

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        url: true,
        orgId: true,
        sourcesJson: true,
        keywordsJson: true,
      },
    });
    if (!project) throw new Error("Project not found.");
    const plan = project.orgId ? (await getOrgPlan(project.orgId)).plan : defaultPlan();
    const sources: IngestionSource[] = (() => {
      try {
        const parsed = project.sourcesJson ? (JSON.parse(project.sourcesJson) as string[]) : [];
        const validSources = parsed.filter((s): s is IngestionSource =>
          ["REDDIT", "OPENAI_WEB", "X", "HACKER_NEWS", "PRODUCT_HUNT", "G2", "APP_STORE"].includes(s)
        );
        return validSources.length > 0 ? validSources : ["REDDIT"];
      } catch {
        return ["REDDIT"];
      }
    })();

    const startStage = opts?.startStage ?? "SCRAPE";

    let keywords: string[] = [];
    const needsScrapeAndKeywords =
      startStage === "SCRAPE" || startStage === "KEYWORDS" || !project.keywordsJson;

    if (needsScrapeAndKeywords) {
      await setProjectState(projectId, { stage: "SCRAPE" });
      await logRun(opts?.runId, "SCRAPE", "Discovering website (OpenAI web search)");

      await setProjectState(projectId, { stage: "KEYWORDS" });
      await logRun(opts?.runId, "KEYWORDS", "Extracting keywords (OpenAI web search)");

      const keywordLimit = Number(process.env.KEYWORD_LIMIT) || 20;
      keywords = await withRetry(
        () => extractKeywordsFromUrlWithOpenAIWeb({ url: project.url, limit: keywordLimit }),
        "openai-keywords"
      );

      await setProjectState(projectId, {
        keywordsJson: JSON.stringify(keywords),
        keywordCount: keywords.length,
      });
    } else {
      try {
        const parsed = JSON.parse(project.keywordsJson ?? "[]") as unknown;
        keywords = Array.isArray(parsed)
          ? parsed.map((x) => String(x)).filter(Boolean).slice(0, 20)
          : [];
      } catch {
        keywords = [];
      }
    }

    await setProjectState(projectId, { stage: "REDDIT_FETCH" });
    const perKeywordLimit = 20;

    const hasPosts = (await prisma.post.count({ where: { projectId } })) > 0;
    const shouldFetchReddit =
      startStage === "SCRAPE" ||
      startStage === "KEYWORDS" ||
      startStage === "REDDIT_FETCH" ||
      (!hasPosts && (startStage === "AI_EXTRACT" || startStage === "CLUSTER"));

    if (shouldFetchReddit) {
      for (const keyword of keywords) {
        for (const source of sources) {
          await logRun(opts?.runId, "REDDIT_FETCH", `Searching ${source} for "${keyword}"`);
          const results = await withRetry(
            () => fetchPostsFromSource(source, keyword, perKeywordLimit),
            `source-${source.toLowerCase()}`
          );
          if (results.length === 0) continue;

          if (project.orgId) {
            await assertPostAndProblemLimits(project.orgId, plan, results.length);
          }
          for (const p of results) {
            const postUrl = p.post_url?.trim();
            if (!postUrl) continue;
            if ((p.selftext ?? "").length < 20 && (p.title ?? "").length < 10) continue; // spam filter

            await prisma.post.upsert({
              where: { projectId_postUrl: { projectId, postUrl } },
              create: {
                projectId,
                title: p.title,
                content: p.selftext,
                author: p.author,
                subreddit: p.subreddit,
                source: source as PostSource,
                upvotes: p.upvotes,
                comments: p.comments,
                postUrl,
                redditCreatedAt: safeDate(p.created_at),
                matchedKeyword: keyword,
              },
              update: {
                title: p.title,
                content: p.selftext,
                author: p.author,
                subreddit: p.subreddit,
                source: source as PostSource,
                upvotes: p.upvotes,
                comments: p.comments,
                redditCreatedAt: safeDate(p.created_at),
                matchedKeyword: keyword,
              },
            });
          }

          if (project.orgId) {
            await bumpUsage(project.orgId, { postsFetched: results.length });
          }
          const postCount = await prisma.post.count({ where: { projectId } });
          await setProjectState(projectId, { postCount });
          await setRunState(opts?.runId, { stage: "REDDIT_FETCH" });

          await sleep(250);
        }
      }
    }

    await setProjectState(projectId, { stage: "AI_EXTRACT" });
    await setRunState(opts?.runId, { stage: "AI_EXTRACT" });
    const hasProblems =
      (await prisma.problem.count({ where: { post: { projectId } } })) > 0;
    const shouldAnalyze =
      startStage === "SCRAPE" ||
      startStage === "KEYWORDS" ||
      startStage === "REDDIT_FETCH" ||
      startStage === "AI_EXTRACT" ||
      (!hasProblems && startStage === "CLUSTER");

    if (shouldAnalyze) {
      for (let i = 0; i < 200; i++) {
        const result = await analyzePostsForProject({
          projectId,
          batchSize: 10,
          concurrency: 5,
        });
        if (project.orgId && result.created > 0) {
          await bumpUsage(project.orgId, { problemsExtracted: result.created });
        }
        await logRun(
          opts?.runId,
          "AI_EXTRACT",
          `Analyzed batch (${result.created} new problems; done=${result.done})`
        );
        if (result.done) break;
      }
    }

    await setProjectState(projectId, { stage: "CLUSTER" });
    await clusterProblemsForProject({ projectId });
    await setRunState(opts?.runId, { stage: "CLUSTER" });
    await logRun(opts?.runId, "CLUSTER", "Clustering problems");

    await setProjectState(projectId, {
      status: "DONE",
      stage: "DONE",
    });
    await setRunState(opts?.runId, { status: "DONE", stage: "DONE" });
    await logRun(opts?.runId, "DONE", "Run completed");

    if (project.orgId) {
      await sendSlackAlert(`ProblemRadar run complete for ${project.url} (${project.orgId}). Clusters: ${(await prisma.cluster.count({ where: { projectId } }))}.`);
    }

    await audit({
      orgId: project.orgId ?? null,
      action: "pipeline.complete",
      target: projectId,
      metadata: { runId: opts?.runId ?? null },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pipeline failed.";
    await setProjectState(projectId, {
      status: "ERROR",
      stage: "ERROR",
      errorMessage: message,
    });
    await setRunState(opts?.runId, { status: "ERROR", stage: "ERROR", errorMessage: message });
    await logRun(opts?.runId, "ERROR", message);
  }
}

