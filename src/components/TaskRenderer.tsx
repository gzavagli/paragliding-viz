import React from 'react';
import { Entity as ResiumEntity } from 'resium';
import { Cartesian3, Cartographic, Color, ColorMaterialProperty, JulianDate, TimeInterval, TimeIntervalCollectionProperty } from 'cesium';
import { type XCTask } from '../types/task';
import { calculateOptimizedPath } from '../utils/optimization';

interface TaskRendererProps {
  task: XCTask;
  trackDate?: Date; // The date of the flight (UTC midnight), used to anchor task times
  timezone?: string; // Timezone to interpret task times (e.g. "Europe/Paris")
}

const TaskRenderer: React.FC<TaskRendererProps> = ({ task, trackDate, timezone = 'UTC' }) => {
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

      {/* Optimized Path Curtain */}
      {optimizedPath && (() => {
        const positions = optimizedPath;
        const cartographics = optimizedPath.map(p => Cartographic.fromCartesian(p));

        // Ensure we have valid heights
        const minimumHeights = cartographics.map(c => (c.height || 0) - 2000);
        const maximumHeights = cartographics.map(c => (c.height || 0) + 2000);

        return (
          <ResiumEntity
            name="Optimized Path"
            wall={{
              positions: positions,
              minimumHeights: minimumHeights,
              maximumHeights: maximumHeights,
              material: Color.PURPLE.withAlpha(0.3),
              outline: true,
              outlineColor: Color.BLACK.withAlpha(0.5)
            }}
          />
        );
      })()}
    </>
  );
};

export default React.memo(TaskRenderer);
