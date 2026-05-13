"use client";

import { useEffect, useRef, useState } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { FEATURED_LOCATIONS, type FeaturedLocation } from "@/lib/seed-locations";

// Cream land, blue water — strong contrast so the pins read clearly.
const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "labels.text.fill", stylers: [{ color: "#57534e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#fafaf9" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#a8a29e" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#efe9da" }] },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#efe9da" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#b4dcec" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#5fa9c4" }] },
];

// Custom SVG pin — small filled circle, off-black on cream.
const PIN_ICON = (selected: boolean): google.maps.Symbol => ({
  path: google.maps.SymbolPath.CIRCLE,
  fillColor: "#1c1917",
  fillOpacity: 1,
  strokeColor: "#fafaf9",
  strokeWeight: 2,
  scale: selected ? 9 : 7,
});

export function WorldMap({
  apiKey,
  onSelect,
  selectedSlug,
}: {
  apiKey: string;
  onSelect: (loc: FeaturedLocation) => void;
  selectedSlug: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    setOptions({ key: apiKey, v: "weekly" });
    let cancelled = false;

    importLibrary("maps")
      .then(({ Map }) => {
        if (cancelled || !containerRef.current) return;

        const map = new Map(containerRef.current, {
          center: { lat: 20, lng: 0 },
          zoom: 2,
          minZoom: 2,
          maxZoom: 5,
          disableDefaultUI: true,
          gestureHandling: "greedy",
          styles: MAP_STYLE,
        });
        mapRef.current = map;

        for (const loc of FEATURED_LOCATIONS) {
          const marker = new google.maps.Marker({
            map,
            position: loc.location,
            title: loc.name,
            icon: PIN_ICON(false),
          });
          marker.addListener("click", () => onSelect(loc));
          markersRef.current.push(marker);
        }

        setReady(true);
      })
      .catch((err: unknown) => {
        console.error("Google Maps failed to load:", err);
      });

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };
  }, [apiKey, onSelect]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    markersRef.current.forEach((marker, i) => {
      const loc = FEATURED_LOCATIONS[i];
      marker.setIcon(PIN_ICON(loc.slug === selectedSlug));
    });
    if (selectedSlug) {
      const loc = FEATURED_LOCATIONS.find((l) => l.slug === selectedSlug);
      if (loc) mapRef.current.panTo(loc.location);
    }
  }, [ready, selectedSlug]);

  return <div ref={containerRef} className="h-full w-full" />;
}
