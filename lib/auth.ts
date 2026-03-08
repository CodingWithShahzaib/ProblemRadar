import { PrismaAdapter } from "@auth/prisma-adapter";
import { type NextAuthOptions, getServerSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { JWT } from "next-auth/jwt";

import { prisma } from "@/lib/prisma";
import { ensureOrgForUser, requireOrgContext } from "@/lib/billing";

const credentialsSchema = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().optional(),
});

function githubProviderMaybe() {
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    return GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      profile(profile) {
        return {
          id: profile.id?.toString() ?? randomUUID(),
          name: profile.name ?? profile.login,
          email: profile.email,
          image: profile.avatar_url,
        };
      },
    });
  }
  return null;
}

type OrgToken = JWT & {
  id?: string;
  orgId?: string;
  role?: string;
  email?: string;
  name?: string;
};

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
  },
  providers: [
    githubProviderMaybe(),
    Credentials({
      name: "Email (no-code dev login)",
      credentials: {
        email: { label: "Email", type: "email" },
        name: { label: "Name", type: "text" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, name } = parsed.data;
        const user = await prisma.user.upsert({
          where: { email },
          create: { email, name: name ?? email.split("@")[0] },
          update: { name: name ?? undefined },
        });
        await ensureOrgForUser(user.id, user.email ?? null);
        return user;
      },
    }),
  ].filter(Boolean),
  callbacks: {
    async signIn({ user }) {
      if (user?.id) {
        await ensureOrgForUser(user.id, user.email ?? null);
      }
      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user?.id) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        const ctx = await requireOrgContext(user.id);
        token.orgId = ctx.orgId;
        token.role = ctx.role;
      } else if (trigger === "update" && token.id) {
        // refresh org context when session is refreshed
        const ctx = await requireOrgContext(String(token.id));
        token.orgId = ctx.orgId;
        token.role = ctx.role;
      }
      return token as JWT & { id?: string; orgId?: string; role?: string };
    },
    async session({ session, token }) {
      if (session.user) {
        const enriched = token as OrgToken;
        session.user.id = enriched.id;
        session.user.email = enriched.email;
        session.user.name = enriched.name;
        session.user.orgId = enriched.orgId;
        session.user.role = enriched.role;
      }
      return session;
    },
  },
};

export function auth() {
  return getServerSession(authOptions);
}
