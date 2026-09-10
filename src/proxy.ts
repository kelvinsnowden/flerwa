import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 Proxy (renamed from Middleware — same mechanism). Runs once per
 * navigation, refreshes the Supabase session before any Server Component
 * renders, and writes the refreshed cookies onto the outgoing response.
 *
 * Without this, a Server Component's cookies().set() calls are silently
 * dropped (see the catch in src/lib/supabase/server.ts) and sessions expire
 * mid-visit instead of refreshing transparently.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Triggers a refresh if the access token is expired. Required — do not
  // remove even though the return value looks unused.
  await supabase.auth.getClaims();

  // Lets the root layout (a Server Component with no router access of its
  // own) decide whether to render the SiteHeader/BottomNav chrome — the
  // full-bleed auth screens (login/signup) render their own AuthHeader
  // and must not double up on navigation chrome.
  response.headers.set("x-pathname", request.nextUrl.pathname);

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on every path except static assets and image optimisation files,
     * so auth stays fresh across all app/admin/provider/customer routes.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
  ],
};
