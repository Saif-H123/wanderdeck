"use client";

import { useEffect, useRef, useState } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { FEATURED_LOCATIONS, type FeaturedLocation } from "@/lib/seed-locations";

// Clean monochrome map style — Apple-esque, doesn't fight the markers.
const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f4" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#78716c" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f4" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#d6d3d1" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#e7e5e4" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#e0f2fe" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#7dd3fc" }] },
];

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
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    setOptions({ key: apiKey, v: "weekly" });
    let cancelled = false;

    Promise.all([importLibrary("maps"), importLibrary("marker")])
      .then(([{ Map }, { AdvancedMarkerElement, PinElement }]) => {
        if (cancelled || !containerRef.current) return;

        const map = new Map(containerRef.current, {
          center: { lat: 20, lng: 0 },
          zoom: 2,
          minZoom: 2,
          maxZoom: 5,
          disableDefaultUI: true,
          gestureHandling: "greedy",
          backgroundColor: "#e0f2fe",
          styles: MAP_STYLE,
        });
        mapRef.current = map;

        for (const loc of FEATURED_LOCATIONS) {
          const pin = new PinElement({
            background: "#1c1917",
            borderColor: "#1c1917",
            glyphColor: "#fafaf9",
            scale: 1.1,
          });
          const marker = new AdvancedMarkerElement({
            map,
            position: loc.location,
            title: loc.name,
            content: pin.element,
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
      markersRef.current.forEach((m) => (m.map = null));
      markersRef.current = [];
    };
  }, [apiKey, onSelect]);

  useEffect(() => {
    if (!ready || !mapRef.current || !selectedSlug) return;
    const loc = FEATURED_LOCATIONS.find((l) => l.slug === selectedSlug);
    if (!loc) return;
    mapRef.current.panTo(loc.location);
  }, [ready, selectedSlug]);

  return <div ref={containerRef} className="h-full w-full" />;
}
