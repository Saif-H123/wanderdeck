import { supabaseSSR } from "./db/supabase-server";

export type CurrentUser = {
  id: string;
  email: string | null;
};

/** Returns the current user or null. Reads the auth cookie via SSR. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const sb = await supabaseSSR();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}
