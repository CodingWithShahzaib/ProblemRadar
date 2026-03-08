"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Github, Mail, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function SignInPage() {
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const callbackUrl = search?.get("callbackUrl") ?? "/dashboard";

  async function handleEmail() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await signIn("credentials", { email, redirect: true, callbackUrl });
      if (res?.error) {
        setError(res.error);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center">
      <Card className="border shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Sign in</CardTitle>
          <p className="text-sm text-muted-foreground">Redirects to {callbackUrl}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => signIn("github", { callbackUrl })}
            disabled={isLoading}
          >
            <Github className="mr-2 h-4 w-4" />
            Continue with GitHub
          </Button>

          <div className="grid gap-2">
            <label className="text-sm text-muted-foreground">Email (dev login, no password)</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <Button onClick={handleEmail} disabled={isLoading || !email} className="w-full">
              <Mail className="mr-2 h-4 w-4" />
              Continue with email
            </Button>
            <p className="text-xs text-muted-foreground">
              Magic-link style auth for development. Configure GitHub or email provider in production.
            </p>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>

          <div className="grid gap-2 rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="font-medium">Fast, safe login</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>No passwords stored. Redirect after auth keeps your context.</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
