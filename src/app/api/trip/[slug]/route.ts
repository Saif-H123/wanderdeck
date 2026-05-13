import { NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/db/trips";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/trip/[slug]">) {
  const { slug } = await ctx.params;
  try {
    const result = await getTripBySlug(slug);
    if (!result) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
