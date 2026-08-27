"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";

export interface TrackingMapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  color: string;
}

interface TrackingMapProps {
  markers: TrackingMapMarker[];
  focusId?: string | null;
}

const DEFAULT_CENTER: [number, number] = [23.8103, 90.4125]; // shown only until real markers arrive

export function TrackingMap({ markers, focusId }: TrackingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const hasFitRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;

      const map = L.map(containerRef.current, { zoomControl: true }).setView(DEFAULT_CENTER, 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
      hasFitRef.current = false;
    };
  }, []);

  // Sync markers: add/update/remove to match the current `markers` prop.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    const seen = new Set<string>();
    for (const m of markers) {
      seen.add(m.id);
      const icon = L.divIcon({
        className: "",
        html: `<div class="map-dot" style="background:${m.color}"><span>${m.label.slice(0, 2).toUpperCase()}</span></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const existing = markersRef.current.get(m.id);
      if (existing) {
        existing.setLatLng([m.lat, m.lng]);
        existing.setIcon(icon);
      } else {
        const marker = L.marker([m.lat, m.lng], { icon }).addTo(map).bindTooltip(m.label, { direction: "top", offset: [0, -16] });
        markersRef.current.set(m.id, marker);
      }
    }

    for (const [id, marker] of Array.from(markersRef.current)) {
      if (!seen.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    // First time markers show up, frame them all instead of sitting on the default center.
    if (!hasFitRef.current && markers.length > 0) {
      hasFitRef.current = true;
      if (markers.length === 1) {
        map.setView([markers[0].lat, markers[0].lng], 15);
      } else {
        map.fitBounds(L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number])), { padding: [40, 40] });
      }
    }
  }, [markers]);

  // Follow a specific marker (e.g. the one selected in the sidebar) as it moves.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusId) return;
    const marker = markersRef.current.get(focusId);
    if (marker) map.setView(marker.getLatLng(), Math.max(map.getZoom(), 14), { animate: true });
  }, [focusId, markers]);

  return <div ref={containerRef} className="tracking-map" role="img" aria-label="Live location map" />;
}
