import { Queue } from "bullmq";

const redisUrl = process.env.REDIS_URL;
const isProd = process.env.NODE_ENV === "production";
const useQueue = isProd || process.env.USE_QUEUE === "true";

if (isProd && !redisUrl) {
  throw new Error("REDIS_URL is required in production for BullMQ queue processing.");
}

if (!useQueue) {
  // In dev, prefer the in-process pipeline unless explicitly enabled.
  console.warn("BullMQ queue disabled (dev default). Set USE_QUEUE=true to enable queue processing.");
} else if (!redisUrl) {
  console.warn("REDIS_URL not set. Queue is disabled (falling back to in-process pipeline).");
}

export const pipelineQueue = redisUrl && useQueue
  ? new Queue("pipeline", {
      connection: { url: redisUrl },
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
    })
  : null;

export type PipelineJobData = {
  projectId: string;
  runId: string;
  startStage?: "SCRAPE" | "KEYWORDS" | "REDDIT_FETCH" | "AI_EXTRACT" | "CLUSTER";
  resetData?: boolean;
  orgId?: string;
};

