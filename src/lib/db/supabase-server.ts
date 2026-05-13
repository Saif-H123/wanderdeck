import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Auth-aware server client — uses the user's session via cookies. Subject
 * to RLS. Use this when you want to read with the user's identity (e.g.
 * "my trips") or when you want auth.uid() to populate.
 *
 * Imports next/headers, so do not pull this into client components.
 */
export const supabaseSSR = async () => {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (toSet) => {
          // In RSC contexts cookies can only be set from a Route Handler or
          // Server Action — Next throws otherwise. Swallowing here is the
          // documented pattern.
          try {
            for (const { name, value, options } of toSet) {
              store.set(name, value, options);
            }
          } catch {
            // no-op
          }
        },
      },
    },
  );
};
