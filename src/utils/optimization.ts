
import { Cartesian3 } from 'cesium';
import type { XCTask } from '../types/task';
import type { IGCFile } from '../types/igc';

// Helper: Project point onto circle in 3D (assuming localized 2D plane or geoid handling)
// Since Cesium uses ECEF, "closest point on circle" is tricky without local frame.
// Approximation: Convert to Cartographic (Lat/Lon), optimize in 2D Lat/Lon, convert back.
// This handles the "cylinders are vertical" constraint naturally.

export const calculateOptimizedPath = (task: XCTask): Cartesian3[] => {
  if (!task || !task.turnpoints || task.turnpoints.length < 2) return [];

  // 1. Initial Path: Centers of turnpoints
  let points = task.turnpoints.map(tp => ({
    lat: tp.lat,
    lon: tp.lon,
    alt: tp.alt || 0, // We'll preserve altitude but optimize lat/lon
    radius: tp.radius,
    type: tp.type
  }));

  // Convert to Cartesian3 for output, but we keep internal representation for optimization
  // actually... we need to project to local meters.
  const toLocal = (lon: number, lat: number) => {
    // Simple equirectangular projection centered on task start
    const ky = 111132.954 - 559.822 * Math.cos(2 * lat * Math.PI / 180);
    const kx = 111132.954 * Math.cos(lat * Math.PI / 180);

    // Relative to first point
    const dy = (lat - points[0].lat) * ky;
    const dx = (lon - points[0].lon) * kx;
    return { x: dx, y: dy };
  };

  const fromLocal = (x: number, y: number) => {
    // Inverse
    const centerLat = points[0].lat;
    const ky = 111132.954 - 559.822 * Math.cos(2 * centerLat * Math.PI / 180);
    const kx = 111132.954 * Math.cos(centerLat * Math.PI / 180);

    const dLat = y / ky;
    const dLon = x / kx;
    return { lat: points[0].lat + dLat, lon: points[0].lon + dLon };
  };

  const localPoints = points.map(p => {
    const loc = toLocal(p.lon, p.lat);
    return { x: loc.x, y: loc.y, radius: p.radius, alt: p.alt };
  });

  // 2. Optimization Loop (Iterative "Taut String")
  const opt = localPoints.map(p => ({ x: p.x, y: p.y }));

  const ITERATIONS = 20;
  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (let i = 0; i < opt.length; i++) {
      // Start Point logic
      // SSS (Start): If Type is SSS, usually it's an EXIT cylinder? Or ENTER?
      // Task rules vary. Simplest generic "Optimized Distance":
      // Point 0 should be on boundary closest to Point 1.
      // Point N should be on boundary closest to Point N-1.

      // Handle Endpoints specially? Or treat them as "Turnpoints" where one neighbor is missing?
      // If i=0, target is on boundary closest to opt[1].
      // If i=N, target is on boundary closest to opt[N-1].

      const prev = i > 0 ? opt[i - 1] : null;
      const next = i < opt.length - 1 ? opt[i + 1] : null;
      const center = localPoints[i];
      const r = center.radius;

      let targetX = opt[i].x;
      let targetY = opt[i].y;

      if (prev && next) {
        // Mid-point optimization
        // Find point P in Circle(center, r) minimizing |Prev - P| + |P - Next|
        // If segment Prev->Next intersects circle, min distance is just |Prev - Next|.
        //     In this case, any point on segment inside circle is valid.
        //     To keep it stable/nice, pick the point on segment closest to circle center.
        // If segment doesn't intersect, min point is on boundary.
        //     Angle Bisector logic.

        // 1. Check intersection
        // Distance from center to line segment Prev->Next
        const A = prev;
        const B = next;
        const C = { x: center.x, y: center.y };

        // Vector AB
        const lab2 = (B.x - A.x) ** 2 + (B.y - A.y) ** 2;
        if (lab2 < 1e-6) continue; // Neighbors overlap?

        // Project C onto Line AB: t = ((C-A) . (B-A)) / |B-A|^2
        const t = ((C.x - A.x) * (B.x - A.x) + (C.y - A.y) * (B.y - A.y)) / lab2;
        // Clamped t for segment
        const tClamped = Math.max(0, Math.min(1, t));

        const closestOnSeg = {
          x: A.x + tClamped * (B.x - A.x),
          y: A.y + tClamped * (B.y - A.y)
        };

        const distToSegSq = (closestOnSeg.x - C.x) ** 2 + (closestOnSeg.y - C.y) ** 2;

        if (distToSegSq <= r * r) {
          // Intersects! Optimal path is straight line.
          // We set current point to the closest on segment to keep it "clean".
          targetX = closestOnSeg.x;
          targetY = closestOnSeg.y;
        } else {
          // Doesn't intersect. Path must bend around boundary.
          // Optimal point is on boundary.
          // Direction: Bisector of Angle (Prev-Center-Next)? Or actually sum of normalized vectors?
          // "The vertex of the optimal path lies on the boundary."
          // The normal vector at optimal P bisects the angle (incident/reflected).
          // Normal is (P - C).
          // Input ray: A - P. Output ray: P - B.
          // We want to minimize |A-P| + |P-B|.
          // Gradient descent or geometric construction?
          // Geometric:
          // Normalize(A-C) + Normalize(B-C) gives rough direction, but accurate only if A, B are far?
          // Correct logic: The point P on circle is such that the tangent is perpendicular to bisector of angle APB.
          // This is hard to solve analytically.
          // Iterative approach:
          // Move P towards the point that reduces distance.
          // Or just project "current" ideal position onto circle?
          // Ideal pos without constraint is simply on the line AB.
          // We know it's "pulled" towards the line.
          // So point on boundary closest to the segment AB?
          // Yes! That's exactly it.
          // If the line doesn't cut the circle, the "taut string" touches the circle at the point closest to the line?
          // Wait, imagine a pulley. The string touches the pulley at a specific tangent point.
          // Actually no, it touches at *one* point if it's a generic corner?
          // Turnpoints are corner constraints.
          // If we assume "Enter" means "Go inside", and we want shortest path...
          // We just need to touch it.
          // YES. The point on the circle closest to the segment Prev->Next is indeed the optimal touch point if we assume convex corner handling.
          // So logic keeps holding: Point on boundary closest to segment.

          // We already calculated `closestOnSeg`!
          // But `closestOnSeg` is OUTSIDE the circle (dist > r).
          // So we just take that point and project it onto the circle?
          // `closestOnSeg` is the point on the line closest to center.
          // Does the circle point closest to the line segment lie on the radius to `closestOnSeg`?
          // Yes, simply `C + r * normalize(closestOnSeg - C)`.

          const dx = closestOnSeg.x - C.x;
          const dy = closestOnSeg.y - C.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          targetX = C.x + (dx / len) * r;
          targetY = C.y + (dy / len) * r;
        }
      } else if (prev) {
        // Goal / Last point
        // Closest point on boundary to Prev
        const dx = prev.x - center.x;
        const dy = prev.y - center.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          targetX = center.x + (dx / len) * r;
          targetY = center.y + (dy / len) * r;
        }
      } else if (next) {
        // Start / First point
        // Closest point on boundary to Next
        const dx = next.x - center.x;
        const dy = next.y - center.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          targetX = center.x + (dx / len) * r;
          targetY = center.y + (dy / len) * r;
        }
      }

      opt[i].x = targetX;
      opt[i].y = targetY;
    }
  }

  // 3. Convert back to Lat/Lon -> Cartesian3
  return opt.map((p, idx) => {
    const geo = fromLocal(p.x, p.y);
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
