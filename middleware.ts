import { withAuth } from "next-auth/middleware";

// Ensure the middleware export is a concrete function to satisfy Next.js checks.
export default withAuth({
  pages: { signIn: "/auth/signin" },
});

export const config = {
  matcher: ["/dashboard", "/project/:path*", "/pricing"],
};
