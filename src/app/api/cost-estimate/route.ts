import { NextRequest } from "next/server";
import { z } from "zod";
import { findNearestAirport } from "@/lib/airports";
import { searchOneWayOffers, cheapestOffer } from "@/lib/duffel";
import { haversineMeters } from "@/lib/geo";

export const maxDuration = 30;

// Below this distance, suggest "drive/train" rather than searching flights.
const DRIVABLE_KM = 250;

const Body = z.object({
  pins: z
    .array(z.object({ lat: z.number(), lng: z.number() }))
    .min(2)
    .max(8),
  /** ISO date YYYY-MM-DD. Defaults to ~30 days from today server-side. */
  departureDate: z.string().optional(),
});

export type CostLeg = {
  index: number; // index of the FROM pin
  fromAirport: { iata: string; city: string; country: string } | null;
  toAirport: { iata: string; city: string; country: string } | null;
  status: "estimated" | "no-offers" | "no-airport" | "drivable" | "error";
  distanceKm: number;
  price: number | null;
  currency: string | null;
  carrier: string | null;
  message?: string;
};

export type CostEstimate = {
  legs: CostLeg[];
  total: number | null;
  currency: string | null;
  departureDate: string;
};

function plusDays(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { pins } = parsed.data;
  const departureDate = parsed.data.departureDate ?? plusDays(30);

  const legs: CostLeg[] = [];

  for (let i = 0; i < pins.length - 1; i++) {
    const from = pins[i];
    const to = pins[i + 1];
    const distanceKm = haversineMeters(from, to) / 1000;
    const fromMatch = findNearestAirport(from.lat, from.lng);
    const toMatch = findNearestAirport(to.lat, to.lng);

    if (distanceKm < DRIVABLE_KM) {
      legs.push({
        index: i,
        fromAirport: fromMatch
          ? { iata: fromMatch.airport.iata, city: fromMatch.airport.city, country: fromMatch.airport.country }
          : null,
        toAirport: toMatch
          ? { iata: toMatch.airport.iata, city: toMatch.airport.city, country: toMatch.airport.country }
          : null,
        status: "drivable",
        distanceKm,
        price: null,
        currency: null,
        carrier: null,
        message: `${Math.round(distanceKm)} km — quicker by road or train.`,
      });
      continue;
    }

    if (!fromMatch || !toMatch) {
      legs.push({
        index: i,
        fromAirport: fromMatch
          ? { iata: fromMatch.airport.iata, city: fromMatch.airport.city, country: fromMatch.airport.country }
          : null,
        toAirport: toMatch
          ? { iata: toMatch.airport.iata, city: toMatch.airport.city, country: toMatch.airport.country }
          : null,
        status: "no-airport",
        distanceKm,
        price: null,
        currency: null,
        carrier: null,
        message: "No major airport within 500 km of one end of this leg.",
      });
      continue;
    }

    try {
      const offers = await searchOneWayOffers({
        origin: fromMatch.airport.iata,
        destination: toMatch.airport.iata,
        departureDate,
      });
      const best = cheapestOffer(offers);
      if (!best) {
        legs.push({
          index: i,
          fromAirport: { iata: fromMatch.airport.iata, city: fromMatch.airport.city, country: fromMatch.airport.country },
          toAirport: { iata: toMatch.airport.iata, city: toMatch.airport.city, country: toMatch.airport.country },
          status: "no-offers",
          distanceKm,
          price: null,
          currency: null,
          carrier: null,
          message: `No offers found for ${fromMatch.airport.iata}→${toMatch.airport.iata}.`,
        });
        continue;
      }
      legs.push({
        index: i,
        fromAirport: { iata: fromMatch.airport.iata, city: fromMatch.airport.city, country: fromMatch.airport.country },
        toAirport: { iata: toMatch.airport.iata, city: toMatch.airport.city, country: toMatch.airport.country },
        status: "estimated",
        distanceKm,
        price: Number(best.total_amount),
        currency: best.total_currency,
        carrier: best.owner.iata_code,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      legs.push({
        index: i,
        fromAirport: { iata: fromMatch.airport.iata, city: fromMatch.airport.city, country: fromMatch.airport.country },
        toAirport: { iata: toMatch.airport.iata, city: toMatch.airport.city, country: toMatch.airport.country },
        status: "error",
        distanceKm,
        price: null,
        currency: null,
        carrier: null,
        message: message.slice(0, 120),
      });
    }
  }

  // Total: sum priced legs, picking the modal currency.
  const pricedLegs = legs.filter((l) => l.price != null && l.currency != null);
  const currencyCounts = new Map<string, number>();
  for (const l of pricedLegs) {
    currencyCounts.set(l.currency!, (currencyCounts.get(l.currency!) ?? 0) + 1);
  }
  let modalCurrency: string | null = null;
  let max = 0;
  for (const [c, count] of currencyCounts) {
    if (count > max) {
      modalCurrency = c;
      max = count;
    }
  }
  const total = pricedLegs
    .filter((l) => l.currency === modalCurrency)
    .reduce((s, l) => s + (l.price ?? 0), 0);

  const result: CostEstimate = {
    legs,
    total: pricedLegs.length > 0 ? total : null,
    currency: modalCurrency,
    departureDate,
  };
  return Response.json(result);
}
