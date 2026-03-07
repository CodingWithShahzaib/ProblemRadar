import { prisma } from "@/lib/prisma";
import { scrapeWebsite } from "@/lib/scrape";
import { extractKeywordsFromWebsite } from "@/lib/keywords";
import { searchRedditPosts } from "@/lib/reddit";
import { analyzePostsForProject } from "@/lib/problem-detection";
import { clusterProblemsForProject } from "@/lib/clustering";

async function setProjectState(projectId: string, data: Parameters<typeof prisma.project.update>[0]["data"]) {
  await prisma.project.update({ where: { id: projectId }, data });
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

export async function runProjectPipeline(
  projectId: string,
  opts?: { startStage?: PipelineStartStage; resetData?: boolean }
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

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error("Project not found.");

    const startStage = opts?.startStage ?? "SCRAPE";

    let keywords: string[] = [];
    const needsScrapeAndKeywords =
      startStage === "SCRAPE" || startStage === "KEYWORDS" || !project.keywordsJson;

    if (needsScrapeAndKeywords) {
      await setProjectState(projectId, { stage: "SCRAPE" });
      const scraped = await scrapeWebsite(project.url);

      await setProjectState(projectId, { stage: "KEYWORDS" });
      const extracted = extractKeywordsFromWebsite(scraped);
      keywords = extracted.keywords;

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
        const results = await searchRedditPosts({ keyword, limit: perKeywordLimit });
        if (results.length === 0) continue;

        for (const p of results) {
          await prisma.post.upsert({
            where: { projectId_postUrl: { projectId, postUrl: p.post_url } },
            create: {
              projectId,
              title: p.title,
              content: p.selftext,
              author: p.author,
              subreddit: p.subreddit,
              upvotes: p.upvotes,
              comments: p.comments,
              postUrl: p.post_url,
              redditCreatedAt: new Date(p.created_at),
              matchedKeyword: keyword,
            },
            update: {
              title: p.title,
              content: p.selftext,
              author: p.author,
              subreddit: p.subreddit,
              upvotes: p.upvotes,
              comments: p.comments,
              redditCreatedAt: new Date(p.created_at),
              matchedKeyword: keyword,
            },
          });
        }

        const postCount = await prisma.post.count({ where: { projectId } });
        await setProjectState(projectId, { postCount });

        // Small delay to reduce rate-limit risk.
        await sleep(350);
      }
    }

    await setProjectState(projectId, { stage: "AI_EXTRACT" });
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
        if (result.done) break;
      }
    }

    await setProjectState(projectId, { stage: "CLUSTER" });
    await clusterProblemsForProject({ projectId });

    await setProjectState(projectId, {
      status: "DONE",
      stage: "DONE",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pipeline failed.";
    await setProjectState(projectId, {
      status: "ERROR",
      stage: "ERROR",
      errorMessage: message,
    });
  }
}

