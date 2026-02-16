import React, { useMemo } from 'react';
import { Entity as ResiumEntity } from 'resium';
import {
  Cartesian3,
  Cartographic,
  Color,
  JulianDate,
  TimeInterval,
  TimeIntervalCollectionProperty,
  GeometryInstance,
  DistanceDisplayConditionGeometryInstanceAttribute,
  ColorGeometryInstanceAttribute,
  ColorMaterialProperty,
  PolygonGeometry,
  PolygonHierarchy,
  Matrix4,
  PerInstanceColorAppearance,
} from 'cesium';
import * as Cesium from 'cesium';
import { type XCTask } from '../types/task';
import { calculateOptimizedPath } from '../utils/optimization';
import { GroundPrimitive as ResiumGroundPrimitive } from 'resium';

interface TaskRendererProps {
  task: XCTask | null;
  trackDate?: Date;
  timezone?: string;
  showTask?: boolean;
}

const TaskRenderer: React.FC<TaskRendererProps> = ({ task, trackDate, timezone = 'UTC', showTask = true }) => {
  if (!showTask) return null;
  if (!task || !task.turnpoints) return null;

  // Helper to parse time string (HH:MM:SS or ISO) into JulianDate, treating it as LOCAL time in the given timezone
  const parseTime = (timeStr: string): JulianDate | null => {
    if (!trackDate) return null;
    try {
      // 1. Strip 'Z' or offsets to get raw "HH:MM:SS"
      // If user provided 13:00Z, we treat it as 13:00 Local.
      let cleanTime = timeStr.replace('Z', '');
      // Remove offset if present (e.g. +02:00) 
      // Simple regex for +/-HH:MM at end?
      // ISO8601 offset: (+|-)HH:MM or (+|-)HHMM or (+|-)HH
      cleanTime = cleanTime.replace(/([+-]\d{2}:?\d{2})$/, '');

      const parts = cleanTime.split(':');
      if (parts.length < 2) return null;

      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      const seconds = parts.length > 2 ? parseInt(parts[2], 10) : 0;

      // 2. Construct a UTC date that REPRESENTS this local time
      // We want to find a UTC timestamp X such that X in 'timezone' reads as 'hours:minutes:seconds'
      
      // Heuristic: Use Intl.DateTimeFormat to find the offset of 'trackDate' in 'timezone'
      // This assumes the offset is constant for the day (valid for paragliding tasks usually)
      
      const testDate = new Date(trackDate);
      testDate.setUTCHours(12, 0, 0, 0); // Noon UTC as probe
      
      // Get offset string: "GMT+2" or "GMT-07:00"
      // Note: timeZoneName: 'longOffset' returns "GMT+02:00"
      const typeFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'longOffset'
      });
      
      const partsFormat = typeFormatter.formatToParts(testDate);
      const offsetPart = partsFormat.find(p => p.type === 'timeZoneName')?.value; // "GMT+02:00" -> extract +02:00
      
      let isoOffset = 'Z';
      if (offsetPart && offsetPart.includes('GMT')) {
        const rawOffset = offsetPart.replace('GMT', '');
        if (rawOffset) isoOffset = rawOffset; // "+02:00"
      } else if (timezone === 'UTC') {
        isoOffset = 'Z';
      }

      // 3. Construct ISO string with the Correct TARGET Offset
      // If we want "12:00:00 Local", and Local is +02:00, we write "YYYY-MM-DDT12:00:00+02:00"
      // Cesium/Date will parse this correctly into the absolute UTC instant.
      
      const datePart = trackDate.toISOString().split('T')[0];
      const fullIso = `${datePart}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}${isoOffset}`;

      return JulianDate.fromIso8601(fullIso);
    } catch (e) {
      console.warn("Failed to parse task time:", timeStr, e);
      return null;
    }
  };


  // Memoize the optimized path calculation
  const optimizedPath = React.useMemo(() => {
    try {
      const path = calculateOptimizedPath(task);
      if (!path || path.length < 2) return null;

      // Check for NaNs or invalid inputs
      if (path.some(p => isNaN(p.x) || isNaN(p.y) || isNaN(p.z))) {
        console.error("Optimized path contains NaNs", path);
        return null;
      }
      return path;
    } catch (e) {
      console.error("Failed to render optimized path curtain:", e);
      return null;
    }
  }, [task]);

  return (
    <>
      {task.turnpoints.map((tp, index) => {
        const isSSS = tp.type === 'SSS';
        const isESS = tp.type === 'ESS';
        const isGoal = tp.type === 'GOAL';

        let materialProperty: any = new ColorMaterialProperty(Color.YELLOW.withAlpha(0.3));

        if (isSSS && task.sSS?.timeGates && task.sSS.timeGates.length > 0 && trackDate) {
          const startTime = parseTime(task.sSS.timeGates[0]);
          if (startTime) {
            const property = new TimeIntervalCollectionProperty();

            property.intervals.addInterval(new TimeInterval({
              start: JulianDate.fromIso8601('1900-01-01T00:00:00Z'),
              stop: startTime,
              isStartIncluded: true,
              isStopIncluded: false,
              data: Color.RED.withAlpha(0.3)
            }));

            property.intervals.addInterval(new TimeInterval({
              start: startTime,
              stop: JulianDate.fromIso8601('2100-01-01T00:00:00Z'),
              isStartIncluded: true,
              isStopIncluded: true,
              data: Color.GREEN.withAlpha(0.3)
            }));

            materialProperty = new ColorMaterialProperty(property);
          }
        } else if (isESS) {
          materialProperty = new ColorMaterialProperty(Color.ORANGE.withAlpha(0.3));
        } else if (isGoal) {
          materialProperty = new ColorMaterialProperty(Color.MAGENTA.withAlpha(0.3));
        } else if (tp.type === 'TAKEOFF') {
          materialProperty = new ColorMaterialProperty(Color.YELLOW.withAlpha(0.3));
        }

        return (
          <ResiumEntity
            key={`tp-${index}`}
            name={tp.name || `TP ${index + 1}`}
            position={Cartesian3.fromDegrees(tp.lon, tp.lat)}
            cylinder={{
              length: 4000,
              topRadius: tp.radius,
              bottomRadius: tp.radius,
              material: materialProperty,
              outline: true,
              outlineColor: Color.BLACK.withAlpha(0.5),
              outlineWidth: 1
            }}
            label={{
              text: tp.name || `TP ${index + 1}`,
              font: '14px sans-serif',
              fillColor: Color.WHITE,
              outlineColor: Color.BLACK,
              outlineWidth: 2,
              style: 2,
              pixelOffset: new Cartesian3(0, -20, 0),
              eyeOffset: new Cartesian3(0, 0, -5000)
            }}
          />
        );
      })}

      {/* Optimized Path: Wide Line on Ground */}
      {optimizedPath && (
        <ResiumEntity
          name="Optimized Path Line"
          polyline={{
            positions: optimizedPath,
            width: 30,
            material: Color.PURPLE.withAlpha(0.6),
            clampToGround: true,
            zIndex: 0
          }}
        />
      )}

      {/* Optimized Path Arrows (LOD using GroundPrimitives) */}
      {optimizedPath && (
        <ArrowPrimitives optimizedPath={optimizedPath} />
      )}
    </>
  );
};

// Sub-component to handle expensive geometry creation
const ArrowPrimitives = React.memo(({ optimizedPath }: { optimizedPath: Cartesian3[] }) => {
  // Memoize the geometry instances (Expensive cpu work)
  const geometryInstances = useMemo(() => {
    const instances: GeometryInstance[] = [];

    // LOD Levels
    const lods = [
      { spacing: 100, min: 0, max: 4000, size: 20 },
      { spacing: 500, min: 4000, max: 20000, size: 80 },
      { spacing: 2000, min: 20000, max: 80000, size: 300 },
      { spacing: 8000, min: 80000, max: Number.MAX_VALUE, size: 1000 }
    ];

    // Create reusable color attribute
    const whiteColorAttribute = ColorGeometryInstanceAttribute.fromColor(Color.WHITE);

    lods.forEach(lod => {
      let currentDist = 0;
      let nextSample = lod.spacing / 2;

      // Create reusable distance display condition attribute for this LOD
      const distanceDisplayConditionAttribute = new DistanceDisplayConditionGeometryInstanceAttribute(
        lod.min,
        lod.max
      );

      for (let i = 0; i < optimizedPath.length - 1; i++) {
        const p1 = optimizedPath[i];
        const p2 = optimizedPath[i + 1];
        const segLen = Cartesian3.distance(p1, p2);

        // Cache p2 cartographic for bearing calculation
        const c2 = Cartographic.fromCartesian(p2);

        while (currentDist + segLen > nextSample) {
          const t = (nextSample - currentDist) / segLen;
          const pos = Cartesian3.lerp(p1, p2, t, new Cartesian3());

          // Bearing Calculation from CURRENT arrow position to next point
          const c1 = Cartographic.fromCartesian(pos);
          const dLon = c2.longitude - c1.longitude;
          const y = Math.sin(dLon) * Math.cos(c2.latitude);
          const x = Math.cos(c1.latitude) * Math.sin(c2.latitude) -
            Math.sin(c1.latitude) * Math.cos(c2.latitude) * Math.cos(dLon);
          const bearing = Math.atan2(y, x);

          // Create Arrow Polygon Geometry
          // We define a triangle in the Local East-North-Up (ENU) frame and transform to World.
          // Triangle points North (bearing 0):
          // Top: (0, size/2)
          // BottomLeft: (-size/2, -size/2)
          // BottomRight: (size/2, -size/2)
          // (Adjusted scale for aspect ratio: Top y=size, Base y=-size is nicer?)
          // Let's use:
          // Top: (0, size/2)
          // BL: (-size/3, -size/2)
          // BR: (size/3, -size/2)

          const size = lod.size;
          const halfSize = size / 2;
          const width = size / 3;

          // Points in Frame: North (Y-axis) is 0 bearing.
          // Rotate points by -bearing (CW) to align with bearing.
          // Wait, standard rotation is CCW.
          // Bearing is CW from North (Y).
          // If Bearing = 90 (East, X).
          // We want Top to be (size/2, 0).
          // Rotation required: -90 deg (CCW).
          // So rotate by -bearing.

          const cosB = Math.cos(-bearing);
          const sinB = Math.sin(-bearing);

          // Local Points (Pre-rotation, pointing North)
          const localPoints = [
            { x: 0, y: halfSize },      // Top
            { x: -width, y: -halfSize }, // Bottom Left
            { x: width, y: -halfSize }   // Bottom Right
          ];

          // Transform to World
          const enuTransform = Cesium.Transforms.eastNorthUpToFixedFrame(pos);

          const polygonPositions = localPoints.map(pt => {
            // 1. Rotate in 2D (around Z-axis of ENU)
            const rx = pt.x * cosB - pt.y * sinB;
            const ry = pt.x * sinB + pt.y * cosB;

            // 2. ENU to World
            // enuTransform * (rx, ry, 0, 1)
            // Manual multiplication for speed/simplicity or Matrix4.multiplyByPoint?
            return Matrix4.multiplyByPoint(enuTransform, new Cartesian3(rx, ry, 0), new Cartesian3());
          });

          const geometry = new PolygonGeometry({
            polygonHierarchy: new PolygonHierarchy(polygonPositions),
            height: 0
          });

          instances.push(new GeometryInstance({
            geometry: geometry,
            attributes: {
              distanceDisplayCondition: distanceDisplayConditionAttribute,
              color: whiteColorAttribute
            }
          }));

          nextSample += lod.spacing;
        }
        currentDist += segLen;
      }
    });

    return instances;
  }, [optimizedPath]);

  // Use PerInstanceColorAppearance for solid colored polygons
  const appearance = useMemo(() => {
    return new PerInstanceColorAppearance({
      flat: true,
      translucent: false
    });
  }, []);

  if (geometryInstances.length === 0) return null;

  return (
    <ResiumGroundPrimitive
      geometryInstances={geometryInstances}
      appearance={appearance}
      asynchronous={false}
    />
  );
});
export default React.memo(TaskRenderer);
