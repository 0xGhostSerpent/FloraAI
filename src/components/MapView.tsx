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

    // Leaflet measures its container once; grid and panel layouts resize it later.
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(containerRef.current);

    // Leaflet leaks its handlers otherwise, and React 19 strict mode will
    // invoke this effect twice in development.
    return () => {
      resize.disconnect();
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

    // Markers follow the active theme rather than a fixed green.
    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue('--accent').trim() || '#2f6b3f';
    const ink = styles.getPropertyValue('--ink').trim() || '#18211b';
    const surface = styles.getPropertyValue('--surface').trim() || '#ffffff';

    for (const point of points) {
      // circleMarker is pure SVG. L.marker resolves icon PNGs by URL, which
      // breaks under the bundler and again under the packaged CSP.
      L.circleMarker([point.lat, point.lon], {
        radius: point.accent ? 7 : 6,
        color: surface,
        fillColor: point.accent ? ink : accent,
        fillOpacity: 0.95,
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
      // isolate: Leaflet's panes use z-index 400+, which would otherwise sit above dialogs.
      className={`isolate ${className ?? 'h-64 w-full overflow-hidden rounded-2xl border border-line'}`}
    />
  );
}
