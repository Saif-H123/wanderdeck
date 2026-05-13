import { createClient } from "@supabase/supabase-js";

/**
 * Service-role server client — bypasses RLS, used for trusted server-side
 * inserts/reads. NEVER expose to the browser.
 *
 * For auth-aware server work (reading the user's session via cookies),
 * see ./supabase-server.ts — kept separate so this module can also be
 * pulled in by edge contexts that don't have access to next/headers.
 */
export const supabaseServer = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  );
