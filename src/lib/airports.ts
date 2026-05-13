import { haversineMeters } from "./geo";

export type Airport = {
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
};

// Curated list of major international airports — enough coverage so a pin
// in any populated region resolves within a few hundred km. Not exhaustive.
// (Source: assembled from IATA + OurAirports; coords rounded to 4dp.)
export const AIRPORTS: Airport[] = [
  // Europe
  { iata: "LHR", name: "Heathrow", city: "London", country: "GB", lat: 51.4706, lng: -0.4619 },
  { iata: "LGW", name: "Gatwick", city: "London", country: "GB", lat: 51.1481, lng: -0.1903 },
  { iata: "STN", name: "Stansted", city: "London", country: "GB", lat: 51.885, lng: 0.235 },
  { iata: "MAN", name: "Manchester", city: "Manchester", country: "GB", lat: 53.3537, lng: -2.275 },
  { iata: "EDI", name: "Edinburgh", city: "Edinburgh", country: "GB", lat: 55.95, lng: -3.3725 },
  { iata: "DUB", name: "Dublin", city: "Dublin", country: "IE", lat: 53.4213, lng: -6.2701 },
  { iata: "CDG", name: "Charles de Gaulle", city: "Paris", country: "FR", lat: 49.0097, lng: 2.5479 },
  { iata: "ORY", name: "Orly", city: "Paris", country: "FR", lat: 48.7233, lng: 2.3794 },
  { iata: "NCE", name: "Nice Côte d'Azur", city: "Nice", country: "FR", lat: 43.6584, lng: 7.2159 },
  { iata: "AMS", name: "Schiphol", city: "Amsterdam", country: "NL", lat: 52.3105, lng: 4.7683 },
  { iata: "BRU", name: "Brussels", city: "Brussels", country: "BE", lat: 50.9014, lng: 4.4844 },
  { iata: "FRA", name: "Frankfurt", city: "Frankfurt", country: "DE", lat: 50.0379, lng: 8.5622 },
  { iata: "MUC", name: "Munich", city: "Munich", country: "DE", lat: 48.3538, lng: 11.7861 },
  { iata: "BER", name: "Berlin Brandenburg", city: "Berlin", country: "DE", lat: 52.3667, lng: 13.5033 },
  { iata: "HAM", name: "Hamburg", city: "Hamburg", country: "DE", lat: 53.6304, lng: 9.9882 },
  { iata: "ZRH", name: "Zurich", city: "Zurich", country: "CH", lat: 47.4647, lng: 8.5492 },
  { iata: "GVA", name: "Geneva", city: "Geneva", country: "CH", lat: 46.2381, lng: 6.1089 },
  { iata: "VIE", name: "Vienna", city: "Vienna", country: "AT", lat: 48.1103, lng: 16.5697 },
  { iata: "MAD", name: "Madrid Barajas", city: "Madrid", country: "ES", lat: 40.4719, lng: -3.5626 },
  { iata: "BCN", name: "Barcelona", city: "Barcelona", country: "ES", lat: 41.2974, lng: 2.0833 },
  { iata: "LIS", name: "Lisbon", city: "Lisbon", country: "PT", lat: 38.7813, lng: -9.1359 },
  { iata: "OPO", name: "Porto", city: "Porto", country: "PT", lat: 41.2481, lng: -8.6814 },
  { iata: "FCO", name: "Fiumicino", city: "Rome", country: "IT", lat: 41.8003, lng: 12.2389 },
  { iata: "MXP", name: "Malpensa", city: "Milan", country: "IT", lat: 45.6306, lng: 8.7281 },
  { iata: "VCE", name: "Venice Marco Polo", city: "Venice", country: "IT", lat: 45.5053, lng: 12.3519 },
  { iata: "NAP", name: "Naples", city: "Naples", country: "IT", lat: 40.886, lng: 14.2908 },
  { iata: "ATH", name: "Athens", city: "Athens", country: "GR", lat: 37.9364, lng: 23.9445 },
  { iata: "IST", name: "Istanbul", city: "Istanbul", country: "TR", lat: 41.2753, lng: 28.7519 },
  { iata: "CPH", name: "Copenhagen", city: "Copenhagen", country: "DK", lat: 55.6181, lng: 12.6561 },
  { iata: "ARN", name: "Arlanda", city: "Stockholm", country: "SE", lat: 59.6519, lng: 17.9186 },
  { iata: "OSL", name: "Oslo", city: "Oslo", country: "NO", lat: 60.1939, lng: 11.1004 },
  { iata: "HEL", name: "Helsinki", city: "Helsinki", country: "FI", lat: 60.3172, lng: 24.9633 },
  { iata: "KEF", name: "Keflavik", city: "Reykjavík", country: "IS", lat: 63.985, lng: -22.6056 },
  { iata: "WAW", name: "Warsaw Chopin", city: "Warsaw", country: "PL", lat: 52.1657, lng: 20.9671 },
  { iata: "PRG", name: "Prague", city: "Prague", country: "CZ", lat: 50.1008, lng: 14.26 },
  { iata: "BUD", name: "Budapest", city: "Budapest", country: "HU", lat: 47.4369, lng: 19.2556 },
  { iata: "SVO", name: "Sheremetyevo", city: "Moscow", country: "RU", lat: 55.9728, lng: 37.4146 },

  // North America
  { iata: "JFK", name: "JFK", city: "New York", country: "US", lat: 40.6413, lng: -73.7781 },
  { iata: "LGA", name: "LaGuardia", city: "New York", country: "US", lat: 40.7769, lng: -73.874 },
  { iata: "EWR", name: "Newark", city: "Newark", country: "US", lat: 40.6895, lng: -74.1745 },
  { iata: "BOS", name: "Boston Logan", city: "Boston", country: "US", lat: 42.3656, lng: -71.0096 },
  { iata: "DCA", name: "Reagan", city: "Washington", country: "US", lat: 38.8512, lng: -77.0402 },
  { iata: "IAD", name: "Dulles", city: "Washington", country: "US", lat: 38.9531, lng: -77.4565 },
  { iata: "MIA", name: "Miami", city: "Miami", country: "US", lat: 25.7959, lng: -80.287 },
  { iata: "ATL", name: "Hartsfield-Jackson", city: "Atlanta", country: "US", lat: 33.6407, lng: -84.4277 },
  { iata: "ORD", name: "O'Hare", city: "Chicago", country: "US", lat: 41.9742, lng: -87.9073 },
  { iata: "DTW", name: "Detroit Metro", city: "Detroit", country: "US", lat: 42.2124, lng: -83.3534 },
  { iata: "MSP", name: "Minneapolis", city: "Minneapolis", country: "US", lat: 44.882, lng: -93.2218 },
  { iata: "DEN", name: "Denver", city: "Denver", country: "US", lat: 39.8561, lng: -104.6737 },
  { iata: "DFW", name: "Dallas/Fort Worth", city: "Dallas", country: "US", lat: 32.8998, lng: -97.0403 },
  { iata: "IAH", name: "Houston Intercont.", city: "Houston", country: "US", lat: 29.9844, lng: -95.3414 },
  { iata: "PHX", name: "Phoenix Sky Harbor", city: "Phoenix", country: "US", lat: 33.4373, lng: -112.0078 },
  { iata: "LAS", name: "Las Vegas Harry Reid", city: "Las Vegas", country: "US", lat: 36.084, lng: -115.1537 },
  { iata: "LAX", name: "LAX", city: "Los Angeles", country: "US", lat: 33.9416, lng: -118.4085 },
  { iata: "SFO", name: "San Francisco", city: "San Francisco", country: "US", lat: 37.6213, lng: -122.379 },
  { iata: "SAN", name: "San Diego", city: "San Diego", country: "US", lat: 32.7338, lng: -117.1933 },
  { iata: "SEA", name: "Seattle-Tacoma", city: "Seattle", country: "US", lat: 47.4502, lng: -122.3088 },
  { iata: "PDX", name: "Portland", city: "Portland", country: "US", lat: 45.5887, lng: -122.5975 },
  { iata: "YYZ", name: "Toronto Pearson", city: "Toronto", country: "CA", lat: 43.6777, lng: -79.6248 },
  { iata: "YUL", name: "Montreal Trudeau", city: "Montreal", country: "CA", lat: 45.4706, lng: -73.7408 },
  { iata: "YVR", name: "Vancouver", city: "Vancouver", country: "CA", lat: 49.1939, lng: -123.1844 },
  { iata: "YYC", name: "Calgary", city: "Calgary", country: "CA", lat: 51.1215, lng: -114.0076 },
  { iata: "MEX", name: "Mexico City", city: "Mexico City", country: "MX", lat: 19.4361, lng: -99.0719 },
  { iata: "CUN", name: "Cancun", city: "Cancún", country: "MX", lat: 21.0365, lng: -86.8771 },

  // Asia
  { iata: "NRT", name: "Narita", city: "Tokyo", country: "JP", lat: 35.7647, lng: 140.3863 },
  { iata: "HND", name: "Haneda", city: "Tokyo", country: "JP", lat: 35.5494, lng: 139.7798 },
  { iata: "KIX", name: "Kansai", city: "Osaka", country: "JP", lat: 34.4347, lng: 135.2441 },
  { iata: "ITM", name: "Itami", city: "Osaka", country: "JP", lat: 34.7855, lng: 135.4382 },
  { iata: "FUK", name: "Fukuoka", city: "Fukuoka", country: "JP", lat: 33.5859, lng: 130.4506 },
  { iata: "CTS", name: "New Chitose", city: "Sapporo", country: "JP", lat: 42.7752, lng: 141.6923 },
  { iata: "ICN", name: "Incheon", city: "Seoul", country: "KR", lat: 37.4602, lng: 126.4407 },
  { iata: "GMP", name: "Gimpo", city: "Seoul", country: "KR", lat: 37.5586, lng: 126.7903 },
  { iata: "PEK", name: "Beijing Capital", city: "Beijing", country: "CN", lat: 40.0801, lng: 116.5846 },
  { iata: "PVG", name: "Pudong", city: "Shanghai", country: "CN", lat: 31.1443, lng: 121.8083 },
  { iata: "CAN", name: "Guangzhou Baiyun", city: "Guangzhou", country: "CN", lat: 23.3924, lng: 113.2988 },
  { iata: "HKG", name: "Hong Kong", city: "Hong Kong", country: "HK", lat: 22.308, lng: 113.9185 },
  { iata: "TPE", name: "Taoyuan", city: "Taipei", country: "TW", lat: 25.0797, lng: 121.2342 },
  { iata: "SIN", name: "Changi", city: "Singapore", country: "SG", lat: 1.3644, lng: 103.9915 },
  { iata: "KUL", name: "Kuala Lumpur", city: "Kuala Lumpur", country: "MY", lat: 2.7456, lng: 101.7099 },
  { iata: "BKK", name: "Suvarnabhumi", city: "Bangkok", country: "TH", lat: 13.69, lng: 100.7501 },
  { iata: "DMK", name: "Don Mueang", city: "Bangkok", country: "TH", lat: 13.9126, lng: 100.6068 },
  { iata: "DPS", name: "Denpasar", city: "Bali", country: "ID", lat: -8.7482, lng: 115.1668 },
  { iata: "CGK", name: "Soekarno-Hatta", city: "Jakarta", country: "ID", lat: -6.1256, lng: 106.6559 },
  { iata: "MNL", name: "Manila", city: "Manila", country: "PH", lat: 14.5086, lng: 121.0194 },
  { iata: "DEL", name: "Indira Gandhi", city: "Delhi", country: "IN", lat: 28.5562, lng: 77.1 },
  { iata: "BOM", name: "Mumbai", city: "Mumbai", country: "IN", lat: 19.0896, lng: 72.8656 },
  { iata: "BLR", name: "Bengaluru", city: "Bengaluru", country: "IN", lat: 13.1986, lng: 77.7066 },
  { iata: "MAA", name: "Chennai", city: "Chennai", country: "IN", lat: 12.9941, lng: 80.1709 },
  { iata: "DXB", name: "Dubai", city: "Dubai", country: "AE", lat: 25.2532, lng: 55.3657 },
  { iata: "AUH", name: "Abu Dhabi", city: "Abu Dhabi", country: "AE", lat: 24.433, lng: 54.6511 },
  { iata: "DOH", name: "Hamad", city: "Doha", country: "QA", lat: 25.2611, lng: 51.5651 },
  { iata: "RUH", name: "Riyadh", city: "Riyadh", country: "SA", lat: 24.9576, lng: 46.6988 },
  { iata: "TLV", name: "Ben Gurion", city: "Tel Aviv", country: "IL", lat: 32.0114, lng: 34.8867 },
  { iata: "AMM", name: "Queen Alia", city: "Amman", country: "JO", lat: 31.7226, lng: 35.9933 },

  // Africa
  { iata: "CAI", name: "Cairo", city: "Cairo", country: "EG", lat: 30.1219, lng: 31.4056 },
  { iata: "ADD", name: "Addis Ababa", city: "Addis Ababa", country: "ET", lat: 8.9778, lng: 38.7993 },
  { iata: "NBO", name: "Jomo Kenyatta", city: "Nairobi", country: "KE", lat: -1.3192, lng: 36.9278 },
  { iata: "JNB", name: "Johannesburg", city: "Johannesburg", country: "ZA", lat: -26.1392, lng: 28.246 },
  { iata: "CPT", name: "Cape Town", city: "Cape Town", country: "ZA", lat: -33.9648, lng: 18.6017 },
  { iata: "LOS", name: "Murtala Muhammed", city: "Lagos", country: "NG", lat: 6.5774, lng: 3.3211 },
  { iata: "CMN", name: "Casablanca", city: "Casablanca", country: "MA", lat: 33.3675, lng: -7.5898 },

  // Oceania
  { iata: "SYD", name: "Sydney Kingsford Smith", city: "Sydney", country: "AU", lat: -33.9399, lng: 151.1753 },
  { iata: "MEL", name: "Melbourne", city: "Melbourne", country: "AU", lat: -37.669, lng: 144.841 },
  { iata: "BNE", name: "Brisbane", city: "Brisbane", country: "AU", lat: -27.3942, lng: 153.1218 },
  { iata: "PER", name: "Perth", city: "Perth", country: "AU", lat: -31.9385, lng: 115.9672 },
  { iata: "AKL", name: "Auckland", city: "Auckland", country: "NZ", lat: -37.0082, lng: 174.785 },
  { iata: "WLG", name: "Wellington", city: "Wellington", country: "NZ", lat: -41.3272, lng: 174.8053 },
  { iata: "CHC", name: "Christchurch", city: "Christchurch", country: "NZ", lat: -43.4894, lng: 172.5322 },
  { iata: "NAN", name: "Nadi", city: "Nadi", country: "FJ", lat: -17.7553, lng: 177.4434 },

  // South & Central America
  { iata: "GRU", name: "São Paulo Guarulhos", city: "São Paulo", country: "BR", lat: -23.4356, lng: -46.4731 },
  { iata: "GIG", name: "Rio de Janeiro Galeão", city: "Rio de Janeiro", country: "BR", lat: -22.81, lng: -43.2506 },
  { iata: "EZE", name: "Ezeiza", city: "Buenos Aires", country: "AR", lat: -34.8222, lng: -58.5358 },
  { iata: "SCL", name: "Santiago", city: "Santiago", country: "CL", lat: -33.393, lng: -70.7858 },
  { iata: "LIM", name: "Jorge Chávez", city: "Lima", country: "PE", lat: -12.0219, lng: -77.1143 },
  { iata: "BOG", name: "El Dorado", city: "Bogotá", country: "CO", lat: 4.7016, lng: -74.1469 },
  { iata: "PTY", name: "Tocumen", city: "Panama City", country: "PA", lat: 9.0714, lng: -79.3835 },
  { iata: "HAV", name: "Havana", city: "Havana", country: "CU", lat: 22.9892, lng: -82.4091 },
];

/** Find the nearest airport to a lat/lng. Returns null if all > maxKm. */
export function findNearestAirport(
  lat: number,
  lng: number,
  maxKm = 500,
): { airport: Airport; distanceKm: number } | null {
  let best: { airport: Airport; distanceMeters: number } | null = null;
  for (const a of AIRPORTS) {
    const d = haversineMeters({ lat, lng }, { lat: a.lat, lng: a.lng });
    if (!best || d < best.distanceMeters) {
      best = { airport: a, distanceMeters: d };
    }
  }
  if (!best) return null;
  const distanceKm = best.distanceMeters / 1000;
  if (distanceKm > maxKm) return null;
  return { airport: best.airport, distanceKm };
}
