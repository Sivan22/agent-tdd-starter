/**
 * A missing or empty variable throws at the point of use instead of failing later in a
 * confusing way. Browser-visible values are read as literal property accesses on process.env,
 * one per variable, so the bundler can inline them; `present` checks them after the read.
 */
export function present(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export function supabasePublicConfig(): { url: string; publishableKey: string } {
  return {
    url: present("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    publishableKey: present("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  };
}
