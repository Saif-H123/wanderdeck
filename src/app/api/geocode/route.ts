import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type GoogleAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

type GoogleResult = {
  formatted_address: string;
  address_components: GoogleAddressComponent[];
  types: string[];
};

type GoogleGeocodeResponse = {
  status: string;
  results: GoogleResult[];
};

function pickComponent(result: GoogleResult, type: string): string | null {
  const c = result.address_components.find((c) => c.types.includes(type));
  return c?.long_name ?? null;
}

/**
 * Reverse-geocode a lat/lng into a short place name + country.
 * Returns:
 *   - name: best human-readable label ("Lecce", "Yosemite National Park")
 *   - country: ISO country name ("Italy")
 *   - caption: one-line "Name, Region" for the sidebar
 *   - formatted: the full Google address (debug / inspection)
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return Response.json({ error: "Invalid lat/lng" }, { status: 400 });
  }

  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key) {
    return Response.json({ error: "Geocoding key not configured" }, { status: 500 });
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("key", key);
  // Bias toward locality/admin-area results — saves us from house-level addresses.
  url.searchParams.set("result_type", "locality|natural_feature|point_of_interest|administrative_area_level_1|country");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    return Response.json({ error: `Geocoder returned ${res.status}` }, { status: 502 });
  }
  const data = (await res.json()) as GoogleGeocodeResponse;
  if (data.status !== "OK" || data.results.length === 0) {
    // No nearby place — fall back to coordinates.
    return Response.json({
      name: `${lat.toFixed(3)}°, ${lng.toFixed(3)}°`,
      country: null,
      region: null,
      caption: "Unmapped spot",
      formatted: null,
    });
  }

  // Prefer the most-specific result first; fall back to wider areas.
  const ordered = data.results.slice().sort((a, b) => {
    const score = (r: GoogleResult) =>
      r.types.includes("point_of_interest")
        ? 0
        : r.types.includes("natural_feature")
          ? 1
          : r.types.includes("locality")
            ? 2
            : r.types.includes("administrative_area_level_1")
              ? 3
              : 4;
    return score(a) - score(b);
  });
  const best = ordered[0];

  const name =
    pickComponent(best, "point_of_interest") ??
    pickComponent(best, "natural_feature") ??
    pickComponent(best, "locality") ??
    pickComponent(best, "administrative_area_level_2") ??
    pickComponent(best, "administrative_area_level_1") ??
    best.formatted_address.split(",")[0];

  const region =
    pickComponent(best, "administrative_area_level_1") ??
    pickComponent(best, "administrative_area_level_2");
  const country = pickComponent(best, "country");

  const caption = [region, country].filter(Boolean).join(", ") || "Somewhere";

  return Response.json({
    name,
    country,
    region,
    caption,
    formatted: best.formatted_address,
  });
}
