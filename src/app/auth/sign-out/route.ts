import { NextRequest } from "next/server";
import { supabaseSSR } from "@/lib/db/supabase-server";

export async function POST(req: NextRequest) {
  const sb = await supabaseSSR();
  await sb.auth.signOut();
  return Response.redirect(`${req.nextUrl.origin}/`, 303);
}
