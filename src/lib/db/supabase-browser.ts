import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client for client components. Auth state stays in cookies, so
 * it works seamlessly with the SSR server client.
 */
export const supabaseBrowser = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
