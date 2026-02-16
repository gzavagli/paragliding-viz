import IGCParser from 'igc-parser';

export interface FlightStatistics {
  duration: string;
  maxAltitude: number;
  maxClimb: number;
  maxSink: number;
  totalDistance: number;
}

export const calculateStats = (track: IGCParser.IGCFile): FlightStatistics => {
  let maxAltitude = 0;
  let maxClimb = 0;
  let maxSink = 0;
  let totalDistance = 0;

  if (track.fixes.length === 0) {
    return { duration: '0h 0m', maxAltitude: 0, maxClimb: 0, maxSink: 0, totalDistance: 0 };
  }

  const startTime = track.fixes[0].timestamp;
  const endTime = track.fixes[track.fixes.length - 1].timestamp;
  const durationMs = endTime - startTime;
  const durationHours = Math.floor(durationMs / 3600000);
  const durationMinutes = Math.floor((durationMs % 3600000) / 60000);

  // Simple stats calculation
  for (let i = 0; i < track.fixes.length; i++) {
    const fix = track.fixes[i];
    const alt = fix.gpsAltitude || fix.pressureAltitude || 0;
    if (alt > maxAltitude) maxAltitude = alt;

    if (i > 0) {
      const prev = track.fixes[i - 1];
      const prevAlt = prev.gpsAltitude || prev.pressureAltitude || 0;
      const timeDiff = (fix.timestamp - prev.timestamp) / 1000; // seconds

      if (timeDiff > 0) {
        const altDiff = alt - prevAlt;
        const vario = altDiff / timeDiff;
        if (vario > maxClimb) maxClimb = vario;
        if (vario < maxSink) maxSink = vario;

        // Distance (haversine)
        const R = 6371e3; // metres
        const φ1 = prev.latitude * Math.PI / 180;
        const φ2 = fix.latitude * Math.PI / 180;
        const Δφ = (fix.latitude - prev.latitude) * Math.PI / 180;
        const Δλ = (fix.longitude - prev.longitude) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        totalDistance += R * c;
      }
    }
  }

  return {
    duration: `${durationHours}h ${durationMinutes}m`,
    maxAltitude,
    maxClimb,
    maxSink,
    totalDistance
  };
};
