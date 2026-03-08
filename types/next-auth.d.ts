import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      orgId?: string;
      role?: string;
    };
  }

  interface User {
    orgId?: string;
    role?: string;
  }
}
