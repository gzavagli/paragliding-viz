import React, { useMemo } from 'react';
import IGCParser from 'igc-parser';
import { calculateStats } from '../utils/stats';

interface FlightStatsProps {
  track: IGCParser.IGCFile | null;
}

const FlightStats: React.FC<FlightStatsProps> = ({ track }) => {
  const stats = useMemo(() => {
    if (!track) return null;
    return calculateStats(track);
  }, [track]);

  if (!track || !stats) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 30,
      left: 10,
      padding: 15,
      background: 'rgba(255, 255, 255, 0.9)',
      borderRadius: 8,
      boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
      fontFamily: 'sans-serif',
      zIndex: 100
    }}>
      <h3 style={{ margin: '0 0 10px 0' }}>Flight Statistics</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div><strong>Date:</strong> {track.date}</div>
        <div><strong>Duration:</strong> {stats.duration}</div>
        <div><strong>Max Alt:</strong> {stats.maxAltitude.toFixed(0)} m</div>
        <div><strong>Distance:</strong> {(stats.totalDistance / 1000).toFixed(1)} km</div>
        <div><strong>Max Climb:</strong> {stats.maxClimb.toFixed(1)} m/s</div>
        <div><strong>Max Sink:</strong> {stats.maxSink.toFixed(1)} m/s</div>
        <div><strong>Pilot:</strong> {track.pilot || 'Unknown'}</div>
      </div>
    </div>
  );
};

export default FlightStats;
