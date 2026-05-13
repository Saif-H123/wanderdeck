"use client";

import { useEffect, useRef, useState } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { FEATURED_LOCATIONS, type FeaturedLocation } from "@/lib/seed-locations";
import { ATLAS_STYLE, dotPinIcon } from "@/lib/map-style";

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
          styles: ATLAS_STYLE,
          clickableIcons: false,
        });
        mapRef.current = map;

        for (const loc of FEATURED_LOCATIONS) {
          const marker = new google.maps.Marker({
            map,
            position: loc.location,
            title: loc.name,
            icon: dotPinIcon(false),
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
      marker.setIcon(dotPinIcon(loc.slug === selectedSlug));
    });
    if (selectedSlug) {
      const loc = FEATURED_LOCATIONS.find((l) => l.slug === selectedSlug);
      if (loc) mapRef.current.panTo(loc.location);
    }
  }, [ready, selectedSlug]);

  return <div ref={containerRef} className="h-full w-full" />;
}
