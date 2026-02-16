
import React, { useEffect, useState, useRef } from 'react';
import { JulianDate, Cartesian3, Color, TimeIntervalCollection, TimeInterval, SampledPositionProperty, PathGraphics, ArcGISTiledElevationTerrainProvider, LagrangePolynomialApproximation, ClockRange, BoundingSphere, HeadingPitchRange, Math as CesiumMath, LabelStyle, VerticalOrigin, Cartesian2, DistanceDisplayCondition, Cartographic } from 'cesium';
import { Viewer as CesiumViewer, Entity } from 'resium';
import type { IGCFile, PilotStats } from '../types/igc';
import PlaybackControls from './PlaybackControls';
import HelpOverlay from './HelpOverlay';
import type { XCTask } from '../types/task';
import TaskRenderer from './TaskRenderer';

interface ViewerProps {
  tracks: IGCFile[];
  task: XCTask | null;
  trackDate: JulianDate;
  trailLength: number;
  visibility: Record<string, boolean>;
  timezone: string;
  onStatsUpdate?: (stats: Record<string, PilotStats>) => void;
}

const getInitials = (name?: string): string => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].substring(0, 3).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const Viewer: React.FC<ViewerProps> = ({ tracks, task, trackDate, trailLength, visibility, timezone, onStatsUpdate }) => {
  const viewerRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [multiplier, setMultiplier] = useState(10);
  const [currentTime, setCurrentTime] = useState<JulianDate>(trackDate);

  // Initialize track entities
  const [trackEntities, setTrackEntities] = useState<any[]>([]);
  const [trackRange, setTrackRange] = useState<{ start: JulianDate; stop: JulianDate } | null>(null);

  // Memoize credit container to prevent Viewer re-creation
  const creditContainer = React.useMemo(() => document.createElement('div'), []);

  useEffect(() => {
    if (tracks.length === 0) return;

    const entities = tracks.map((track) => {
      const property = new SampledPositionProperty();
      property.setInterpolationOptions({
        interpolationDegree: 2,
        interpolationAlgorithm: LagrangePolynomialApproximation
      });

      // Determine flight date (midnight UTC)
      let flightDate = new Date();
      if (track.date) {
        flightDate = new Date(track.date);
      } else {
        // Fallback to provided trackDate if track has no date
        flightDate = JulianDate.toDate(trackDate);
        flightDate.setUTCHours(0, 0, 0, 0);
      }

      const flightDateMs = flightDate.getTime();

      // Heuristic: Check if first timestamp is Epoch (large) or ms-since-midnight (small)
      // 1 year in ms is approx 3e10. If timestamp < 1e11 (year 1973), treat as relative.
      // Usually ms-since-midnight is < 8.64e7.
      const firstTimestamp = track.fixes.length > 0 ? track.fixes[0].timestamp : 0;
      const isEpoch = firstTimestamp > 1000000000000; // > Year 2001
      const timeOffset = isEpoch ? 0 : flightDateMs;

      let trackStart: JulianDate | undefined;
      let trackStop: JulianDate | undefined;

      // Find time range
      if (track.fixes.length > 0 && track.fixes[0].timestamp && track.fixes[track.fixes.length - 1].timestamp) {
        trackStart = JulianDate.fromDate(new Date(timeOffset + track.fixes[0].timestamp));
        trackStop = JulianDate.fromDate(new Date(timeOffset + track.fixes[track.fixes.length - 1].timestamp));
      }

      track.fixes.forEach((fix) => {
        if (fix.timestamp) {
          const time = JulianDate.fromDate(new Date(timeOffset + fix.timestamp));
          const position = Cartesian3.fromDegrees(fix.longitude, fix.latitude, fix.gpsAltitude || fix.pressureAltitude || 0);
          property.addSample(time, position);
        }
      });

      // Trail availability
      const availability = new TimeIntervalCollection([
        new TimeInterval({
          start: trackStart || JulianDate.now(),
          stop: trackStop || JulianDate.now(),
        })
      ]);

      return {
        id: track.filename,
        position: property,
        color: Color.fromCssColorString(track.color),
        startTime: trackStart,
        stopTime: trackStop,
        availability: availability,
        originalTrack: track
      };
    });

    setTrackEntities(entities);
  }, [tracks]);

  // Auto-zoom and Clock Setup
  useEffect(() => {
    if (trackEntities.length > 0 && viewerRef.current && viewerRef.current.cesiumElement) {
      const viewer = viewerRef.current.cesiumElement;

      let minStart: JulianDate | undefined;
      let maxStop: JulianDate | undefined;

      // Calculate global time range
      trackEntities.forEach(t => {
        if (t.startTime && t.stopTime) {
          if (!minStart || JulianDate.lessThan(t.startTime, minStart)) minStart = t.startTime;
          if (!maxStop || JulianDate.greaterThan(t.stopTime, maxStop)) maxStop = t.stopTime;
        }
      });

      if (minStart && maxStop) {
        viewer.clock.startTime = minStart;
        viewer.clock.stopTime = maxStop;
        viewer.clock.currentTime = minStart;
        viewer.clock.clockRange = ClockRange.LOOP_STOP;
        viewer.clock.multiplier = multiplier;

        // Update React state
        setCurrentTime(minStart);
        setTrackRange({ start: minStart, stop: maxStop });
      }

      // Fly to first track (only if no task is loaded)
      if (!task) {
        const firstTrack = trackEntities[0];
        if (firstTrack && firstTrack.startTime) {
          const position = firstTrack.position.getValue(firstTrack.startTime);
          if (position) {
            viewer.camera.flyTo({
              destination: Cartesian3.fromElements(position.x, position.y, position.z + 2000), // 2km up
              duration: 2
            });
          }
        }
      }

      // Ensure depth test against terrain is enabled
      viewer.scene.globe.depthTestAgainstTerrain = true;
    }
  }, [trackEntities]);

  // Pilot Stats Update Loop
  useEffect(() => {
    if (trackEntities.length > 0 && viewerRef.current && viewerRef.current.cesiumElement && onStatsUpdate) {
      const viewer = viewerRef.current.cesiumElement;
      let lastUpdate = 0;

      const statsListener = () => {
        const now = Date.now();
        if (now - lastUpdate < 500) return; // Throttle to 2Hz
        lastUpdate = now;

        const currentJulian = viewer.clock.currentTime;
        // Fix: Use generic helper or just basic date logic. We know track dates are normalized in trackEntities with startTime/stopTime?
        // Actually, tracks are normalized to 'trackDate' if needed, but the entities use the original timestamps via sampled property?
        // Wait, calculate stats from the original track data (IGC fixes) is precise.

        const currentJsDate = JulianDate.toDate(currentJulian);
        const currentTimestamp = currentJsDate.getTime();

        const newStats: Record<string, import('../types/igc').PilotStats> = {};

        trackEntities.forEach(entity => {
          const track = entity.originalTrack as IGCFile;
          // Find closest fix
          // Optimization: Assume fixes are sorted. Binary search is best.
          // For now, simple find or let's write a quick binary search helper if needed, but find is O(N).
          // Given 1Hz fixes, N is a few thousands.

          // We need to account for the timeOffset we applied to the entity?
          // The Viewer applies timeOffset to create the entity. we need to match that.
          // Heuristic from Viewer: 
          let flightDate = new Date();
          if (track.date) {
            flightDate = new Date(track.date);
          } else {
            flightDate = JulianDate.toDate(trackDate);
            flightDate.setUTCHours(0, 0, 0, 0);
          }
          const flightDateMs = flightDate.getTime();
          const firstTimestamp = track.fixes.length > 0 ? track.fixes[0].timestamp : 0;
          const isEpoch = firstTimestamp > 1000000000000;
          const timeOffset = isEpoch ? 0 : flightDateMs;

          const trackTime = currentTimestamp - timeOffset;

          // Find index
          // Just linear search from end or standard bsearch? logic
          // Let's iterate backwards since we usually are at the end? No, random access.
          let currentIndex = -1;
          // Simple binary search
          let min = 0;
          let max = track.fixes.length - 1;
          while (min <= max) {
            const mid = Math.floor((min + max) / 2);
            if (track.fixes[mid].timestamp < trackTime) min = mid + 1;
            else max = mid - 1;
          }
          currentIndex = max; // Fix just before or at current time

          if (currentIndex >= 0 && currentIndex < track.fixes.length) {
            const currentFix = track.fixes[currentIndex];

            // 15s avg
            // Find fix 15s ago
            const targetTime = trackTime - 15000;
            let pastIndex = -1;
            min = 0;
            max = currentIndex;
            while (min <= max) {
              const mid = Math.floor((min + max) / 2);
              if (track.fixes[mid].timestamp < targetTime) min = mid + 1;
              else max = mid - 1;
            }
            pastIndex = max;

            if (pastIndex >= 0 && pastIndex < currentIndex) {
              const pastFix = track.fixes[pastIndex];
              const dt = (currentFix.timestamp - pastFix.timestamp) / 1000; // seconds
              if (dt > 0) {
                // Distance
                const p1 = Cartesian3.fromDegrees(pastFix.longitude, pastFix.latitude, pastFix.gpsAltitude || 0);
                const p2 = Cartesian3.fromDegrees(currentFix.longitude, currentFix.latitude, currentFix.gpsAltitude || 0);
                const dist = Cartesian3.distance(p1, p2);
                const altDiff = (currentFix.gpsAltitude || 0) - (pastFix.gpsAltitude || 0); // Vario use GPS or Baro? GPS usually noisier but AGL needs GPS/Location. User said "track altitude".

                const speed = (dist / dt) * 3.6; // m/s to km/h
                const vario = altDiff / dt; // m/s

                // AGL
                let agl = 0;
                const cartographic = Cartographic.fromDegrees(currentFix.longitude, currentFix.latitude);
                const globeHeight = viewer.scene.globe.getHeight(cartographic);
                if (globeHeight !== undefined) {
                  agl = (currentFix.gpsAltitude || currentFix.pressureAltitude || 0) - globeHeight;
                }

                newStats[track.filename] = { speed, vario, agl };
              }
            }
          }
        });

        onStatsUpdate(newStats);
      };

      viewer.clock.onTick.addEventListener(statsListener);
      return () => {
        viewer.clock.onTick.removeEventListener(statsListener);
      };
    }
  }, [trackEntities, onStatsUpdate]);

  // Task Auto-zoom
  useEffect(() => {
    if (task && viewerRef.current && viewerRef.current.cesiumElement) {
      const viewer = viewerRef.current.cesiumElement;

      const points = task.turnpoints.map(tp =>
        Cartesian3.fromDegrees(tp.lon, tp.lat)
      );

      const boundingSphere = BoundingSphere.fromPoints(points);

      viewer.camera.flyToBoundingSphere(boundingSphere, {
        offset: new HeadingPitchRange(
          0, // Heading: North
          CesiumMath.toRadians(-45), // Pitch: -45 degrees
          boundingSphere.radius * 4 // Range: Zoom out a bit to see context
        ),
        duration: 2
      });
    }
  }, [task]);


  const handlePlayPause = () => {
    setIsPlaying(prev => !prev);
  }

  const handleSeek = (time: JulianDate) => {
    if (viewerRef.current && viewerRef.current.cesiumElement) {
      viewerRef.current.cesiumElement.clock.currentTime = time;
      setCurrentTime(time);
    }
  }

  const handleMultiplierChange = (newMultiplier: number) => {
    setMultiplier(newMultiplier);
  }

  // Sync Playback state with Cesium Clock
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (viewerRef.current && viewerRef.current.cesiumElement) {
      const viewer = viewerRef.current.cesiumElement;

      const listener = () => {
        const shouldAnimate = viewer.clock.shouldAnimate;
        if (shouldAnimate !== isPlayingRef.current) {
          setIsPlaying(shouldAnimate);
        }
      };

      viewer.clock.onTick.addEventListener(listener);
      return () => {
        viewer.clock.onTick.removeEventListener(listener);
      };
    }
  }, []);

  useEffect(() => {
    if (viewerRef.current && viewerRef.current.cesiumElement) {
      const clock = viewerRef.current.cesiumElement.clock;
      if (clock.shouldAnimate !== isPlaying) {
        clock.shouldAnimate = isPlaying;
      }
      clock.multiplier = multiplier;
    }
  }, [isPlaying, multiplier]);

  // Terrain Handling
  useEffect(() => {
    console.log("Loading ArcGIS World Elevation...");
    ArcGISTiledElevationTerrainProvider.fromUrl('https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer')
      .then(provider => {
        console.log("ArcGIS Terrain loaded.");
        if (viewerRef.current && viewerRef.current.cesiumElement) {
          viewerRef.current.cesiumElement.terrainProvider = provider;
        }
      })
      .catch(err => console.error("Failed to load ArcGIS terrain", err));
  }, []);

  // Memoize JS Date for TaskRenderer to avoid unnecessary re-renders
  const trackDateJs = React.useMemo(() => JulianDate.toDate(trackDate), [trackDate]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <CesiumViewer
        ref={viewerRef}
        full
        // terrainProvider prop removed to avoid conflicts
        onClick={() => {
          // Handle click to select pilot?
        }}
        // Hide default Cesium widgets
        geocoder={false}
        homeButton={false}
        sceneModePicker={false}
        baseLayerPicker={false}
        navigationHelpButton={false}
        animation={false}
        timeline={false}
        fullscreenButton={false}
        creditContainer={creditContainer}
      >
        {/* Render Task */}
        {task && <TaskRenderer task={task} trackDate={trackDateJs} timezone={timezone} />}

        {/* Render Tracks */}
        {trackEntities.map((entity) => {
          const isVisible = visibility[entity.id] !== false;
          if (!isVisible) return null;

          return (
            <Entity
              key={entity.id}
              position={entity.position}
              point={{ pixelSize: 10, color: Color.WHITE, outlineColor: Color.BLACK, outlineWidth: 1 }}
              label={{
                text: getInitials(entity.originalTrack.pilot),
                font: 'bold 12px Inter, sans-serif',
                style: LabelStyle.FILL_AND_OUTLINE,
                fillColor: Color.WHITE,
                outlineColor: Color.BLACK,
                outlineWidth: 4,
                verticalOrigin: VerticalOrigin.BOTTOM,
                pixelOffset: new Cartesian2(0, -10), // Above the dot
                distanceDisplayCondition: new DistanceDisplayCondition(0, 50000) // Hide when zoomed out too far
              }}
              path={new PathGraphics({
                width: 3,
                material: entity.color,
                leadTime: 0,
                trailTime: trailLength,
                resolution: 1
              })}
              availability={entity.availability}
            />
          );
        })}

        {/* Playback Controls */}
        <PlaybackControls
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          multiplier={multiplier}
          setMultiplier={handleMultiplierChange}
          currentTime={currentTime}
          startTime={trackRange ? trackRange.start : trackDate}
          stopTime={trackRange ? trackRange.stop : JulianDate.addSeconds(trackDate, 86400, new JulianDate())}
          onSeek={handleSeek}
          timezone={timezone}
        />

        <HelpOverlay />
      </CesiumViewer>
    </div>
  );
};

export default Viewer;
