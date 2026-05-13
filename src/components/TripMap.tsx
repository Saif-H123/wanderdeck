"use client";

import { useEffect, useRef, useState } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import type { GeneratedPlan } from "@/lib/ai/claude";

const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "labels.text.fill", stylers: [{ color: "#57534e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#fafaf9" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#a8a29e" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#efe9da" }] },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#efe9da" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#fafaf9" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#b4dcec" }] },
];

// Numbered SVG pin — index is the visible label.
function numberedPinIcon(index: number, selected: boolean): google.maps.Icon {
  const size = selected ? 36 : 30;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 48" width="${size}" height="${(size * 48) / 36}">
  <path d="M18 0C8.06 0 0 8.06 0 18c0 12 18 30 18 30s18-18 18-30C36 8.06 27.94 0 18 0z" fill="#1c1917"/>
  <circle cx="18" cy="18" r="11" fill="#fafaf9"/>
  <text x="18" y="22" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="600" font-size="14" fill="#1c1917">${index + 1}</text>
</svg>`.trim();
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, (size * 48) / 36),
    anchor: new google.maps.Point(size / 2, (size * 48) / 36),
  };
}

export function TripMap({
  apiKey,
  plan,
  activeStopIndex,
  onStopClick,
}: {
  apiKey: string;
  plan: GeneratedPlan;
  activeStopIndex: number;
  onStopClick: (index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    setOptions({ key: apiKey, v: "weekly" });
    let cancelled = false;

    importLibrary("maps")
      .then(({ Map }) => {
        if (cancelled || !containerRef.current) return;

        const bounds = new google.maps.LatLngBounds();
        for (const s of plan.stops) bounds.extend(s.location);

        const map = new Map(containerRef.current, {
          center: bounds.getCenter(),
          zoom: 6,
          disableDefaultUI: true,
          gestureHandling: "greedy",
          backgroundColor: "#e0f2fe",
          styles: MAP_STYLE,
        });
        mapRef.current = map;
        map.fitBounds(bounds, 80);

        plan.stops.forEach((stop, i) => {
          const marker = new google.maps.Marker({
            map,
            position: stop.location,
            title: stop.name,
            icon: numberedPinIcon(i, false),
          });
          marker.addListener("click", () => onStopClick(i));
          markersRef.current.push(marker);
        });

        polylineRef.current = new google.maps.Polyline({
          path: plan.stops.map((s) => s.location),
          geodesic: true,
          strokeColor: "#1c1917",
          strokeOpacity: 0.5,
          strokeWeight: 2,
          map,
        });

        setReady(true);
      })
      .catch((err: unknown) => {
        console.error("Google Maps failed to load:", err);
      });

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      polylineRef.current?.setMap(null);
      polylineRef.current = null;
    };
  }, [apiKey, plan, onStopClick]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    markersRef.current.forEach((marker, i) => {
      marker.setIcon(numberedPinIcon(i, i === activeStopIndex));
    });
    if (activeStopIndex >= 0) {
      mapRef.current.panTo(plan.stops[activeStopIndex].location);
    }
  }, [activeStopIndex, ready, plan.stops]);

  return <div ref={containerRef} className="h-full w-full" />;
}
