import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/db/types.gen";
import { supabasePublicConfig } from "@/lib/env";

/** The signed-in caller's client for Server Components, Server Actions and route handlers. RLS applies. */
export async function supabaseServer() {
  const cookieStore = await cookies();
  const { url, publishableKey } = supabasePublicConfig();
  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // A Server Component may read cookies but not write them; proxy.ts writes the
          // refreshed session for every request.
        }
      },
    },
  });
}
