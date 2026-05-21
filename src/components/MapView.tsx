import { useEffect } from 'react';
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  useMap,
} from 'react-leaflet';
import type { GeoPosition } from '../hooks/useGeolocation';
import type { RoutePoint } from '../types';

const DEFAULT_CENTER: [number, number] = [52.52, 13.405];

type MapViewProps = {
  points: RoutePoint[];
  live: GeoPosition | null;
};

function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.panTo([lat, lng], { animate: true });
  }, [lat, lng, map]);
  return null;
}

export function MapView({ points, live }: MapViewProps) {
  const center: [number, number] = live
    ? [live.lat, live.lng]
    : points.length > 0
      ? [points[0].lat, points[0].lng]
      : DEFAULT_CENTER;

  const polyline: [number, number][] = points.map((p) => [p.lat, p.lng]);

  return (
    <MapContainer
      className="map"
      center={center}
      zoom={16}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {live && <MapRecenter lat={live.lat} lng={live.lng} />}
      {polyline.length > 1 && (
        <Polyline
          positions={polyline}
          smoothFactor={2}
          pathOptions={{ color: '#b91c1c', weight: 5, lineCap: 'round', lineJoin: 'round' }}
        />
      )}
      {live && (
        <CircleMarker
          center={[live.lat, live.lng]}
          radius={8}
          pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.9 }}
        />
      )}
    </MapContainer>
  );
}
