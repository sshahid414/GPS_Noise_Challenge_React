import { useCallback, useEffect, useRef, useState } from 'react';
import { useGeolocation, type GeoPosition } from '../hooks/useGeolocation';
import type { RoutePoint } from '../types';
import { totalDistanceMeters } from '../utils/geo';
import { startMockDrive, type MockDriveHandle } from '../utils/mockDrive';
import { SmoothPathRecorder } from '../utils/routeSmoothing';
import { MapView } from './MapView';

const FALLBACK_ORIGIN = { lat: 52.52, lng: 13.405 };

export function RouteRecorder() {
  const { position: geoPosition, error: geoError } = useGeolocation();
  const [mockActive, setMockActive] = useState(false);
  const [mockPosition, setMockPosition] = useState<GeoPosition | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingPoints, setRecordingPoints] = useState<RoutePoint[]>([]);
  const mockHandleRef = useRef<MockDriveHandle | null>(null);
  const recorderRef = useRef<SmoothPathRecorder | null>(null);
  const lastIngestTsRef = useRef<number | null>(null);

  const position = mockActive ? mockPosition : geoPosition;

  useEffect(() => {
    const recorder = new SmoothPathRecorder(setRecordingPoints);
    recorderRef.current = recorder;
    return () => {
      recorder.destroy();
      recorderRef.current = null;
    };
  }, []);

  const stopMockDrive = useCallback(() => {
    mockHandleRef.current?.stop();
    mockHandleRef.current = null;
    setMockActive(false);
    setMockPosition(null);
  }, []);

  const toggleMockDrive = () => {
    if (mockActive) {
      stopMockDrive();
      return;
    }
    const origin = geoPosition ?? mockPosition ?? FALLBACK_ORIGIN;
    setMockActive(true);
    mockHandleRef.current = startMockDrive(origin, (pos) => setMockPosition(pos));
  };

  useEffect(() => () => mockHandleRef.current?.stop(), []);

  const startRecording = () => {
    lastIngestTsRef.current = null;
    recorderRef.current?.reset();
    setRecording(true);
  };

  const stopRecording = () => {
    void recorderRef.current?.flush();
    setRecording(false);
  };

  useEffect(() => {
    if (!recording || !position) return;
    if (lastIngestTsRef.current === position.timestamp) return;
    lastIngestTsRef.current = position.timestamp;
    recorderRef.current?.ingest(position);
  }, [recording, position]);

  const distanceKm = (
    totalDistanceMeters(recordingPoints) / 1000
  ).toFixed(2);

  const banner = mockActive
    ? 'Mock drive — red line follows roads (snapped + routed)'
    : geoError
      ? geoError
      : geoPosition
        ? 'Live GPS — or start mock drive'
        : 'Waiting for GPS… use Start mock drive';

  return (
    <div className="screen">
      <MapView points={recordingPoints} live={position} />

      <header className="topbar">
        <span className="title">GPS Noise Challenge</span>
        {recording && (
          <span className="rec-indicator">
            <span className="rec-dot" aria-hidden />
            Recording
          </span>
        )}
      </header>

      <div className={`banner${geoError && !mockActive ? ' banner--err' : ''}`}>
        {banner}
      </div>

      <div className="bottom">
        <div className="stats">
          <div className="stat">
            <div className="stat__value">{recordingPoints.length}</div>
            <div className="stat__label">Points</div>
          </div>
          <div className="stat">
            <div className="stat__value">{distanceKm}</div>
            <div className="stat__label">km recorded</div>
          </div>
        </div>

        <button
          type="button"
          className={`btn btn--secondary${mockActive ? ' btn--secondary-active' : ''}`}
          onClick={toggleMockDrive}
        >
          {mockActive ? 'Stop mock drive' : 'Start mock drive'}
        </button>

        {recording ? (
          <button type="button" className="btn btn--stop" onClick={stopRecording}>
            Stop recording
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--rec"
            disabled={!position}
            onClick={startRecording}
          >
            Start recording
          </button>
        )}
      </div>
    </div>
  );
}
