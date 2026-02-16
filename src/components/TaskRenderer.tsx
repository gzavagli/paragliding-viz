import React from 'react';
import { Entity as ResiumEntity } from 'resium';
import { Cartesian3, Cartographic, Color, ColorMaterialProperty, JulianDate, TimeInterval, TimeIntervalCollectionProperty } from 'cesium';
import { type XCTask } from '../types/task';
import { calculateOptimizedPath } from '../utils/optimization';

interface TaskRendererProps {
  task: XCTask;
  trackDate?: Date; // The date of the flight (UTC midnight), used to anchor task times
  timezone?: string; // Timezone of the flight/task location
}

const TaskRenderer: React.FC<TaskRendererProps> = ({ task, trackDate, timezone }) => {
  if (!task || !task.turnpoints) return null;

  // Helper to parse "HH:MM:SS" (Local Task Time) into a JulianDate (UTC)
  const parseTime = (timeStr: string): JulianDate | null => {
    if (!trackDate) return null;
    try {
      // Remove 'Z' if present
      const cleanTime = timeStr.replace('Z', '');
      const [h, m, s] = cleanTime.split(':').map(Number);

      const utcDate = new Date(trackDate);
      utcDate.setUTCHours(h, m, s, 0);

      // Adjust for timezone if present (Offset logic)
      if (timezone) {
        try {
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hour12: false,
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric'
          });

          const parts = formatter.formatToParts(utcDate);
          const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0');

          const zoneH = getPart('hour');
          const zoneM = getPart('minute');

          let hourDiff = utcDate.getUTCHours() - zoneH;
          let minDiff = utcDate.getUTCMinutes() - zoneM;

          let totalDiffMinutes = (hourDiff * 60) + minDiff;

          if (totalDiffMinutes > 720) totalDiffMinutes -= 1440;
          if (totalDiffMinutes < -720) totalDiffMinutes += 1440;

          utcDate.setMinutes(utcDate.getMinutes() + totalDiffMinutes);
        } catch (err) {
          console.warn("Timezone calc error", err);
        }
      }

      return JulianDate.fromIso8601(utcDate.toISOString());
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
