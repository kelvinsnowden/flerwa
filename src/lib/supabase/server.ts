import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server Component / Server Action / Route Handler client.
 * Reads and writes auth cookies via Next's async cookies() API.
 * Every RLS policy in this app evaluates against auth.uid() as seen by
 * THIS client — never bypass it with the service-role key for user-facing
 * reads or writes. See BUILD_PLAN.md Phase 2 and SECURITY.md.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component that can't set cookies (no
            // response to attach them to). Harmless as long as src/proxy.ts
            // is refreshing the session on navigation — see that file.
          }
        },
      },
    }
  );
}
