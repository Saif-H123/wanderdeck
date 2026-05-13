"use client";

import { useEffect, useRef, useState } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { ATLAS_STYLE, numberedPinIcon } from "@/lib/map-style";
import type { LatLng } from "@/lib/types";

export type Pin = LatLng & { id: string; name: string };

export function EditableMap({
  apiKey,
  pins,
  activePinId,
  editable,
  onAddPin,
  onMovePin,
  onSelectPin,
}: {
  apiKey: string;
  pins: Pin[];
  activePinId: string | null;
  editable: boolean;
  onAddPin: (latlng: LatLng) => void;
  onMovePin: (id: string, latlng: LatLng) => void;
  onSelectPin: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const [ready, setReady] = useState(false);

  // Keep latest callbacks in refs so the init effect doesn't re-run on every render.
  const onAddPinRef = useRef(onAddPin);
  const onMovePinRef = useRef(onMovePin);
  const onSelectPinRef = useRef(onSelectPin);
  useEffect(() => {
    onAddPinRef.current = onAddPin;
    onMovePinRef.current = onMovePin;
    onSelectPinRef.current = onSelectPin;
  });

  // Initialize the map once.
  useEffect(() => {
    if (!containerRef.current) return;
    setOptions({ key: apiKey, v: "weekly" });
    let cancelled = false;

    importLibrary("maps")
      .then(({ Map }) => {
        if (cancelled || !containerRef.current) return;
        const map = new Map(containerRef.current, {
          center: { lat: 30, lng: 10 },
          zoom: 3,
          minZoom: 2,
          maxZoom: 18,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          styles: ATLAS_STYLE,
          clickableIcons: false,
        });
        mapRef.current = map;
        setReady(true);
      })
      .catch((err: unknown) => {
        console.error("Google Maps failed to load:", err);
      });

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current.clear();
      polylineRef.current?.setMap(null);
      polylineRef.current = null;
      clickListenerRef.current?.remove();
      clickListenerRef.current = null;
    };
  }, [apiKey]);

  // Re-bind the map click handler whenever `editable` flips.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    clickListenerRef.current?.remove();
    if (!editable) {
      clickListenerRef.current = null;
      return;
    }
    clickListenerRef.current = mapRef.current.addListener(
      "click",
      (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        onAddPinRef.current({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      },
    );
  }, [ready, editable]);

  // Sync markers with the `pins` prop. Add/update/remove.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const seen = new Set<string>();

    pins.forEach((pin, i) => {
      seen.add(pin.id);
      let marker = markersRef.current.get(pin.id);
      if (!marker) {
        marker = new google.maps.Marker({
          map,
          position: { lat: pin.lat, lng: pin.lng },
          draggable: editable,
          icon: numberedPinIcon(i, pin.id === activePinId),
        });
        marker.addListener("click", () => onSelectPinRef.current(pin.id));
        marker.addListener("dragend", (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          onMovePinRef.current(pin.id, { lat: e.latLng.lat(), lng: e.latLng.lng() });
        });
        markersRef.current.set(pin.id, marker);
      } else {
        marker.setPosition({ lat: pin.lat, lng: pin.lng });
        marker.setDraggable(editable);
        marker.setIcon(numberedPinIcon(i, pin.id === activePinId));
      }
    });

    // Remove markers whose pin was deleted.
    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        marker.setMap(null);
        markersRef.current.delete(id);
      }
    }

    // Update / draw polyline.
    polylineRef.current?.setMap(null);
    if (pins.length >= 2) {
      polylineRef.current = new google.maps.Polyline({
        path: pins.map((p) => ({ lat: p.lat, lng: p.lng })),
        geodesic: true,
        strokeColor: "#1c1917",
        strokeOpacity: 0.6,
        strokeWeight: 2,
        map,
      });
    } else {
      polylineRef.current = null;
    }
  }, [ready, pins, activePinId, editable]);

  // When the active pin changes, pan to it.
  useEffect(() => {
    if (!ready || !mapRef.current || !activePinId) return;
    const pin = pins.find((p) => p.id === activePinId);
    if (pin) mapRef.current.panTo({ lat: pin.lat, lng: pin.lng });
  }, [activePinId, ready, pins]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {editable && pins.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center">
          <div className="rounded-full bg-stone-900/85 px-5 py-2 text-sm text-white shadow-lg backdrop-blur">
            Tap the map to drop your first pin
          </div>
        </div>
      )}
    </div>
  );
}
