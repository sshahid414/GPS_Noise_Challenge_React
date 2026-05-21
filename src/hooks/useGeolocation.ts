import { useEffect, useState } from 'react';

export type GeoPosition = {
  lat: number;
  lng: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  timestamp: number;
};

export function useGeolocation() {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supported =
    typeof navigator !== 'undefined' && 'geolocation' in navigator;

  useEffect(() => {
    if (!supported) {
      setError('Geolocation is not supported in this browser.');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          timestamp: pos.timestamp,
        });
        setError(null);
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [supported]);

  return { position, error, supported };
}
