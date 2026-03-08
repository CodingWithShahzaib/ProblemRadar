import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const sections = [
  { title: "Getting started", copy: "Create a project from the home page. Choose sources (Reddit/OpenAI web) and watch the queue update in real time." },
  { title: "Reruns", copy: "Use the project page to retry from the suggested stage or restart from scratch after fixing inputs." },
  { title: "Exports", copy: "CSV export is available for every project. Webhook delivery can push leads/problems into your stack." },
  { title: "Limits", copy: "Starter: 2 projects, 3 runs/day. Pro: 10 projects, 25 runs/day. Team: custom." },
];

export default function DocsPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Badge variant="secondary" className="w-fit">Docs</Badge>
        <h1 className="text-3xl font-semibold">Documentation</h1>
        <p className="text-muted-foreground">Short, focused notes for running ProblemRadar in production.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <CardTitle className="text-lg">{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{item.copy}</CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Support</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Contact <a className="underline" href="mailto:support@problemradar.local">support@problemradar.local</a> for account changes, SSO, or source additions.
        </CardContent>
      </Card>
    </div>
  );
}
