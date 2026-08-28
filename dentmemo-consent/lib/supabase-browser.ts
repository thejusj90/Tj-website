import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Next.js can split each route into its own JS bundle, which would give a
// plain module-level singleton a separate copy per page. Supabase's refresh
// tokens are single-use and rotate on every refresh, so two independent
// client instances sharing the same browser storage race to use the same
// token and one fails with "Refresh Token Not Found" — which looks like an
// immediate, silent logout right after a successful sign-in. Anchoring the
// singleton to globalThis guarantees exactly one real client regardless of
// how the app is bundled.
declare global {
  // eslint-disable-next-line no-var
  var __dentmemoSupabaseBrowserClient: SupabaseClient | undefined;
}

export function getSupabaseBrowser() {
  if (typeof window === "undefined") return null;
  if (globalThis.__dentmemoSupabaseBrowserClient) {
    return globalThis.__dentmemoSupabaseBrowserClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const client = createClient(url, key);
  globalThis.__dentmemoSupabaseBrowserClient = client;
  return client;
}
