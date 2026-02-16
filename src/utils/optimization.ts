
import { Cartesian3 } from 'cesium';
import type { XCTask } from '../types/task';
import type { IGCFile } from '../types/igc';

// Helper: Project point onto circle in 3D (assuming localized 2D plane or geoid handling)
// Since Cesium uses ECEF, "closest point on circle" is tricky without local frame.
// Approximation: Convert to Cartographic (Lat/Lon), optimize in 2D Lat/Lon, convert back.
// This handles the "cylinders are vertical" constraint naturally.

export const calculateOptimizedPath = (task: XCTask): Cartesian3[] => {
  if (!task || !task.turnpoints || task.turnpoints.length < 2) return [];

  // 1. Identify Start and End indices for Optimization
  // Standard Race: SSS -> TPs -> ESS -> Goal (Line/Cylinder)
  // We optimize distance from SSS Boundary (Exit) to ESS/Goal Boundary (Enter).

  let startIndex = task.turnpoints.findIndex(tp => tp.type === 'SSS');
  if (startIndex === -1) startIndex = 0; // Fallback to first point

  let endIndex = task.turnpoints.findIndex(tp => tp.type === 'ESS');
  if (endIndex === -1) endIndex = task.turnpoints.findIndex(tp => tp.type === 'GOAL');
  if (endIndex === -1) endIndex = task.turnpoints.length - 1; // Fallback to last point

  if (startIndex >= endIndex) return []; // Invalid task structure

  // Extract relevant turnpoints
  const relevantTPs = task.turnpoints.slice(startIndex, endIndex + 1);

  let points = relevantTPs.map(tp => ({
    lat: tp.lat,
    lon: tp.lon,
    alt: tp.alt || 0,
    radius: tp.radius,
    type: tp.type
  }));

  // Convert to Cartesian3 for output, but we keep internal representation for optimization
  // Project to local meters centered at SSS
  const centerLat = points[0].lat;
  const kx = 111132.954 * Math.cos(centerLat * Math.PI / 180);
  const ky = 111132.954 - 559.822 * Math.cos(2 * centerLat * Math.PI / 180);

  const toLocal = (lon: number, lat: number) => {
    const dy = (lat - points[0].lat) * ky;
    const dx = (lon - points[0].lon) * kx;
    return { x: dx, y: dy };
  };

  const fromLocal = (x: number, y: number) => {
    const dLat = y / ky;
    const dLon = x / kx;
    return { lat: points[0].lat + dLat, lon: points[0].lon + dLon };
  };

  const localPoints = points.map(p => {
    const loc = toLocal(p.lon, p.lat);
    return { x: loc.x, y: loc.y, radius: p.radius, alt: p.alt };
  });

  // 2. Optimization Loop (Iterative "Taut String")
  // Initialize with centers
  const opt = localPoints.map(p => ({ x: p.x, y: p.y }));

  const ITERATIONS = 50; // Increased iterations for stability
  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (let i = 0; i < opt.length; i++) {
      const center = localPoints[i];
      const r = center.radius;

      // Start Point (SSS): Exit Cylinder
      // Optimal point is on the boundary closest to the NEXT point.
      if (i === 0) {
        const next = opt[i + 1]; // Use current position of next point
        const dx = next.x - center.x;
        const dy = next.y - center.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 1e-6) {
          // Standard SSS is EXIT: We start on the boundary in direction of flight
          opt[i].x = center.x + (dx / len) * r;
          opt[i].y = center.y + (dy / len) * r;
        }
        continue;
      }

      // End Point (ESS/Goal): Enter Cylinder
      // Optimal point is on the boundary closest to the PREVIOUS point.
      if (i === opt.length - 1) {
        const prev = opt[i - 1];
        const dx = prev.x - center.x;
        const dy = prev.y - center.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 1e-6) {
          // Standard ESS is ENTER: We finish on the boundary closest to arrival
          opt[i].x = center.x + (dx / len) * r;
          opt[i].y = center.y + (dy / len) * r;
        }
        continue;
      }

      // Intermediate Points (Turnpoints): Enter/Touch Cylinder
      // Taut string logic: minimize |Prev-P| + |P-Next|
      const prev = opt[i - 1];
      const next = opt[i + 1];

      // Project Center C onto Segment Prev-Next
      const A = prev;
      const B = next;
      const C = { x: center.x, y: center.y };

      const lab2 = (B.x - A.x) ** 2 + (B.y - A.y) ** 2;
      let targetX, targetY;

      if (lab2 < 1e-6) {
        // Neighbors overlap? Just stay put or move to neighbor
        targetX = A.x;
        targetY = A.y;
      } else {
      // t = ((C-A) . (B-A)) / |B-A|^2
        const t = ((C.x - A.x) * (B.x - A.x) + (C.y - A.y) * (B.y - A.y)) / lab2;
        const tClamped = Math.max(0, Math.min(1, t));

        const closestOnSeg = {
          x: A.x + tClamped * (B.x - A.x),
          y: A.y + tClamped * (B.y - A.y)
        };

        const distToSegSq = (closestOnSeg.x - C.x) ** 2 + (closestOnSeg.y - C.y) ** 2;

        if (distToSegSq <= r * r) {
          // Segment intersects cylinder: Shortest path is straight line.
          // We use the point on segment closest to center to approximate "flying through"
          // Ideally, for drawing the path, we might just want to draw A->B directly if we skip this TP?
          // But strict optimization means we touch it.
          // Actually, if we fly straight through, the "touch point" is anywhere on the segment inside.
          // To keep the path drawing clean, we pick the point on segment closest to center.
          targetX = closestOnSeg.x; // Straight line
          targetY = closestOnSeg.y;
        } else {
          // Segment is outside: Path wraps around boundary.
          // Touch point is the point on boundary closest to the segment.
          const dx = closestOnSeg.x - C.x;
          const dy = closestOnSeg.y - C.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          // If len is approx r, we are on boundary. 
          // If len > r, we project to boundary.
          if (len > 0) {
            targetX = C.x + (dx / len) * r;
            targetY = C.y + (dy / len) * r;
          } else {
            targetX = C.x;
            targetY = C.y;
          }
        }
      }

      opt[i].x = targetX;
      opt[i].y = targetY;
    }
  }

  // 3. Convert back to Lat/Lon -> Cartesian3
  return opt.map((p, idx) => {
    const geo = fromLocal(p.x, p.y);
    // Use mapped altitude or ground?
    // For rendering "Line on Ground", altitude doesn't matter much if we clampToGround.
    // But calculateTaskDistance uses Cartesian distance.
    // Let's use 0 or standard altitude.
    return Cartesian3.fromDegrees(geo.lon, geo.lat, localPoints[idx].alt || 0);
  });
};

/*
  Fallback calculators for TaskLoader
  (Re-implementing simpler exports/imports management if needed, but for now purely internal Logic above)
*/

export const calculateTaskDistance = (points: Cartesian3[]): number => {
  let distance = 0;
  for (let i = 0; i < points.length - 1; i++) {
    distance += Cartesian3.distance(points[i], points[i + 1]);
  }
  return distance;
};

export const getTaskFromIGC = (_track: IGCFile): XCTask | null => null;

export const calculateTrackDistance = (track: IGCFile, _task: XCTask): number => {
  // Simple "Total Distance Flown" fallback
  const points: Cartesian3[] = [];
  track.fixes.forEach(f => {
    points.push(Cartesian3.fromDegrees(f.longitude, f.latitude, f.gpsAltitude || f.pressureAltitude || 0));
  });

  // Real scoring needs complex logic (sectors, start times), falling back to total track length
  return calculateTaskDistance(points);
};
