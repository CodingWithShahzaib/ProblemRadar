import Link from "next/link";

export function Footer() {
  const links = [
    { href: "/how-it-works", label: "How it works" },
    { href: "/docs", label: "Docs" },
    { href: "/changelog", label: "Changelog" },
    { href: "https://status.problemradar.local", label: "Status" },
    { href: "mailto:support@problemradar.local", label: "Contact" },
  ];

  return (
    <footer className="mt-10 border-t bg-background/80 py-8 text-sm text-muted-foreground">
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="grid gap-1">
          <span className="text-foreground font-semibold">ProblemRadar</span>
          <span className="text-xs">Built for founders to surface real user pain.</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full border px-3 py-1 hover:border-primary hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
