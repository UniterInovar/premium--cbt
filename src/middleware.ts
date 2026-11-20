import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Admins and Super Admins are not allowed to take tests or view test result pages
    if (
      (pathname.startsWith("/test") || pathname.startsWith("/result")) &&
      (token?.role === "ADMIN" || token?.role === "SUPER_ADMIN")
    ) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // If the path starts with /admin, require the user to have the ADMIN or SUPER_ADMIN role
        if (req.nextUrl.pathname.startsWith("/admin")) {
          return token?.role === "ADMIN" || token?.role === "SUPER_ADMIN";
        }
        // For all other protected routes, assume authentication is enough
        return !!token;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
    "/test/:path*",
    "/result/:path*",
  ],
};
