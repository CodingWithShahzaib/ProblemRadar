import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const entries = [
  {
    version: "v0.4.0",
    date: "2026-03-08",
    items: [
      "Landing rebuilt for technical buyers; added ops guardrails section.",
      "Dashboard filters for status + search; new health metrics.",
      "Project detail sticky context bar and Ops tab with runs/logs.",
    ],
  },
  {
    version: "v0.3.0",
    date: "Earlier",
    items: ["Webhook exports for leads", "Pricing tiers and billing wiring", "Auth via GitHub + email"],
  },
];

export default function ChangelogPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Badge variant="secondary" className="w-fit">Changelog</Badge>
        <h1 className="text-3xl font-semibold">What’s new</h1>
        <p className="text-muted-foreground">Recent updates and production hardening notes.</p>
      </div>

      <div className="grid gap-4">
        {entries.map((entry) => (
          <Card key={entry.version}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{entry.version}</span>
                <span className="text-sm text-muted-foreground">{entry.date}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <ul className="list-disc space-y-2 pl-5">
                {entry.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
