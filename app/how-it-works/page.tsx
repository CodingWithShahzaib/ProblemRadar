import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const steps = [
  { title: "1) Crawl & extract", copy: "We scrape your marketing page for headings, meta, and keywords to seed the search." },
  { title: "2) Search streams", copy: "Reddit API or OpenAI web search with retries/backoff. Sources stay configurable per run." },
  { title: "3) AI extraction", copy: "We summarize posts, score severity/confidence, and attach contact hints." },
  { title: "4) Cluster & ship", copy: "Embeddings + cosine clustering to group problems. Export CSV or webhook to Slack/CRM." },
];

export default function HowItWorksPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Badge variant="secondary" className="w-fit">Workflow</Badge>
        <h1 className="text-3xl font-semibold">How ProblemRadar works</h1>
        <p className="text-muted-foreground">Technical overview of the pipeline powering your runs.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {steps.map((step) => (
          <Card key={step.title}>
            <CardHeader>
              <CardTitle className="text-lg">{step.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{step.copy}</CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Architecture quick notes</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground grid gap-2">
          <p>Queue-backed worker (BullMQ) with retry-safe jobs, SSE status, and resumable runs.</p>
          <p>Exports: CSV plus webhook endpoint ready for Slack/CRM automations.</p>
          <p>Auth-ready: GitHub or email; secrets pulled from env; no PII stored by default.</p>
        </CardContent>
      </Card>
    </div>
  );
}
