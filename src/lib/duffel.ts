// Thin Duffel client. Raw fetch — Duffel's SDK is heavy and we only need
// one endpoint right now.

const DUFFEL_BASE = "https://api.duffel.com";
const DUFFEL_VERSION = "v2";

export type DuffelOffer = {
  id: string;
  total_amount: string;
  total_currency: string;
  owner: { iata_code: string; name: string };
};

type OfferRequestResponse = {
  data: {
    id: string;
    offers: DuffelOffer[];
  };
};

/**
 * Search one-way offers between two IATA airports for a given date.
 * Uses `return_offers=true` to get offers synchronously in one round-trip.
 */
export async function searchOneWayOffers(input: {
  origin: string;
  destination: string;
  departureDate: string; // YYYY-MM-DD
  adults?: number;
}): Promise<DuffelOffer[]> {
  const key = process.env.DUFFEL_API_KEY;
  if (!key) throw new Error("DUFFEL_API_KEY not configured");

  const res = await fetch(`${DUFFEL_BASE}/air/offer_requests?return_offers=true`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Duffel-Version": DUFFEL_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip",
    },
    body: JSON.stringify({
      data: {
        slices: [
          {
            origin: input.origin,
            destination: input.destination,
            departure_date: input.departureDate,
          },
        ],
        passengers: Array.from({ length: input.adults ?? 1 }, () => ({ type: "adult" as const })),
        cabin_class: "economy",
      },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Duffel returned ${res.status}: ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as OfferRequestResponse;
  return body.data?.offers ?? [];
}

/** Pick the cheapest offer by total_amount (assumes same currency). */
export function cheapestOffer(offers: DuffelOffer[]): DuffelOffer | null {
  if (offers.length === 0) return null;
  return offers.reduce((best, o) =>
    Number(o.total_amount) < Number(best.total_amount) ? o : best,
  );
}
