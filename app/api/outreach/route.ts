import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!rateLimit(`outreach:${session.user.id}`, 5, 60_000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const body = (await req.json()) as { username?: string; problem?: string; product?: string };
    const username = body.username ?? "there";
    const problem = body.problem ?? "a problem your product solves";
    const product = body.product ?? "our product";

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content: "Write a concise 3-4 sentence outreach DM to a potential user. Be specific, empathetic, and include a short CTA to chat.",
        },
        {
          role: "user",
          content: `Username: ${username}\nProblem: ${problem}\nProduct: ${product}`,
        },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "";
    return NextResponse.json({ message: text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate outreach.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
