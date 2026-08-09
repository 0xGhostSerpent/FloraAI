import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type MapPoint = {
  lat: number;
  lon: number;
  label?: string;
  /** Marks the user's own position rather than a result. */
  accent?: boolean;
};

type Props = {
  points: MapPoint[];
  center?: { lat: number; lon: number };
  zoom?: number;
  className?: string;
};

/**
 * Required by the OpenStreetMap tile usage policy — not decoration.
 */
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export default function MapView({ points, center, zoom = 12, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { attributionControl: true, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);

    // Leaflet leaks its handlers otherwise, and React 19 strict mode will
    // invoke this effect twice in development.
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    for (const point of points) {
      // circleMarker is pure SVG. L.marker resolves icon PNGs by URL, which
      // breaks under the bundler and again under the packaged CSP.
      L.circleMarker([point.lat, point.lon], {
        radius: point.accent ? 8 : 6,
        color: point.accent ? '#2563eb' : '#15803d',
        fillColor: point.accent ? '#3b82f6' : '#22c55e',
        fillOpacity: 0.85,
        weight: 2,
      })
        .bindPopup(point.label ?? '')
        .addTo(layer);
    }

    if (points.length > 1) {
      map.fitBounds(
        L.latLngBounds(points.map((p) => [p.lat, p.lon] as [number, number])),
        { padding: [28, 28], maxZoom: 14 },
      );
    } else if (points.length === 1) {
      map.setView([points[0].lat, points[0].lon], zoom);
    } else if (center) {
      map.setView([center.lat, center.lon], zoom);
    } else {
      map.setView([20, 0], 1);
    }
  }, [points, center, zoom]);

  return (
    <div
      ref={containerRef}
      className={className ?? 'w-full h-56 rounded-[var(--radius-dynamic)] overflow-hidden dynamic-border z-0'}
    />
  );
}
