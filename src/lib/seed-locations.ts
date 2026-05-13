import type { LatLng } from "./types";

export type FeaturedLocation = {
  slug: string;
  name: string;
  country: string;
  tagline: string;
  location: LatLng;
  cards: { title: string; hint: string }[];
};

// Curated highlights for the landing-page map. These are inspirational
// previews, not real persisted trips — clicking "Plan your trip" still
// runs the user's free-form prompt through Claude. Replace with real
// destination data once we have enough trips in the DB.
export const FEATURED_LOCATIONS: FeaturedLocation[] = [
  {
    slug: "reykjavik",
    name: "Reykjavík",
    country: "Iceland",
    tagline: "Steam, lava, and the longest twilight you'll ever see.",
    location: { lat: 64.1466, lng: -21.9426 },
    cards: [
      { title: "Chase the lights", hint: "Northern sky, no city glow." },
      { title: "Soak somewhere", hint: "Steam rising from black rock." },
      { title: "Eat the unfamiliar", hint: "Local kitchen, brave order." },
    ],
  },
  {
    slug: "kyoto",
    name: "Kyoto",
    country: "Japan",
    tagline: "Bamboo, tatami, and the right kind of quiet.",
    location: { lat: 35.0116, lng: 135.7681 },
    cards: [
      { title: "Walk through green", hint: "Tall, narrow, alive." },
      { title: "Sit for tea", hint: "Slow. Stillness counts." },
      { title: "Spot the lanterns", hint: "Old street after dark." },
    ],
  },
  {
    slug: "marrakech",
    name: "Marrakech",
    country: "Morocco",
    tagline: "Dyes, spice piles, and call-to-prayer at dusk.",
    location: { lat: 31.6295, lng: -7.9811 },
    cards: [
      { title: "Lost in the souk", hint: "No GPS, just go." },
      { title: "Tile pattern hunt", hint: "Geometry on a wall." },
      { title: "Mint and sugar", hint: "Glass, silver tray, view." },
    ],
  },
  {
    slug: "banff",
    name: "Banff",
    country: "Canada",
    tagline: "Lakes that shouldn't be that colour. They are.",
    location: { lat: 51.1784, lng: -115.5708 },
    cards: [
      { title: "That impossible blue", hint: "Glacier flour, no filter." },
      { title: "Above the trees", hint: "Look down, not up." },
      { title: "Animal at distance", hint: "Stay back. Photograph kindly." },
    ],
  },
  {
    slug: "cape-town",
    name: "Cape Town",
    country: "South Africa",
    tagline: "Where the mountain meets two oceans.",
    location: { lat: -33.9249, lng: 18.4241 },
    cards: [
      { title: "Top of the table", hint: "Flat summit, big horizon." },
      { title: "Penguin commute", hint: "Sand, suit, no flippers." },
      { title: "Glass at golden hour", hint: "Vines, hills, light dropping." },
    ],
  },
  {
    slug: "queenstown",
    name: "Queenstown",
    country: "New Zealand",
    tagline: "Adrenaline town wedged between alps and lake.",
    location: { lat: -45.0312, lng: 168.6626 },
    cards: [
      { title: "Off something high", hint: "Choose your method." },
      { title: "Into the fjord", hint: "Walls of water, walls of stone." },
      { title: "Pie of legend", hint: "Local bakery, the famous one." },
    ],
  },
  {
    slug: "patagonia",
    name: "Torres del Paine",
    country: "Chile",
    tagline: "Granite towers, wind that means it.",
    location: { lat: -50.9423, lng: -73.4068 },
    cards: [
      { title: "The three towers", hint: "First light hits pink." },
      { title: "Glacier toe", hint: "Blue ice meets brown water." },
      { title: "Guanaco moment", hint: "Tall ears, alert, gone." },
    ],
  },
  {
    slug: "petra",
    name: "Petra",
    country: "Jordan",
    tagline: "A city carved into a canyon, rediscovered.",
    location: { lat: 30.3285, lng: 35.4444 },
    cards: [
      { title: "Through the siq", hint: "Walk the slot, then look up." },
      { title: "Treasury at dawn", hint: "Beat the crowds, beat the sun." },
      { title: "Monastery climb", hint: "850 steps. Bring water." },
    ],
  },
];
