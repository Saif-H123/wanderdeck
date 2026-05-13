import { NextRequest } from "next/server";
import { supabaseSSR } from "@/lib/db/supabase-server";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const sb = await supabaseSSR();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) {
      return Response.redirect(`${origin}${next}`);
    }
  }
  // Any failure → bounce back to sign-in with an error flag.
  return Response.redirect(`${origin}/sign-in?error=callback`);
}
