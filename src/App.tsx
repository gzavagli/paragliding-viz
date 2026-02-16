
import React, { useState, useCallback } from 'react';
import type { IGCFile } from './types/igc';
import TrackLoader from './components/TrackLoader';
import TaskLoader from './components/TaskLoader';
import Viewer from './components/Viewer';
import PilotList from './components/PilotList';
import { JulianDate } from 'cesium';
import { getTaskFromIGC } from './utils/optimization';
import type { XCTask } from './types/task';

type TrailLengthOption = '10min' | '20min' | '40min' | '60min' | 'all';

import tzlookup from 'tz-lookup';

// ... imports

const App: React.FC = () => {
  const [tracks, setTracks] = useState<IGCFile[]>([]);
  const [task, setTask] = useState<XCTask | null>(null);
  const [trackDate, setTrackDate] = useState<JulianDate>(JulianDate.now());
  const [timezone, setTimezone] = useState<string>('UTC'); // Default to UTC
  const [trailLength, setTrailLength] = useState<number>(600); // Default 10 min (600s)
  const [trailLengthOption, setTrailLengthOption] = useState<TrailLengthOption>('10min');
  const [trackVisibility, setTrackVisibility] = useState<Record<string, boolean>>({});
  const [pilotStats, setPilotStats] = useState<Record<string, import('./types/igc').PilotStats>>({});

  const handleTracksLoaded = useCallback((newTracks: IGCFile[]) => {
    setTracks(newTracks);

    // Set initial visibility
    const newVisibility: Record<string, boolean> = {};
    newTracks.forEach(t => {
      newVisibility[t.filename] = true;
    });
    setTrackVisibility(newVisibility);

    if (newTracks.length > 0) {
      // Try to extract task from the first track ONLY if no task is currently loaded
      // Actually, user might want to see the task from the file? 
      // Current behavior: getTaskFromIGC checks for C-records.
      // If we already have a task (from file), do we overwrite it? 
      // Usually manual task load should win.
      if (!task) {
        const extractedTask = getTaskFromIGC(newTracks[0]);
        if (extractedTask) {
          setTask(extractedTask);
          // If we extracted a task, its points are in the track, so track timezone logic below applies.
        }
      }

      // Set date from first track
      if (newTracks[0].date) {
        setTrackDate(JulianDate.fromDate(new Date(newTracks[0].date)));
      }

      // Detect Timezone from first point of first track
      // ONLY if no task is loaded, OR if the task doesn't dictate a location (rare)
      // PRD: "If a task is loaded, determine the timezone based on the location of the task"
      // So if 'task' is present, we shouldn't change timezone here? 
      // But 'task' state might be stale in this callback if setTask was called above?
      // Use a functional update or check `task` ref?
      // Simpler: If we just loaded a task (extracted), we use track location. 
      // If we have a manual task, we stick to it.
      // Let's rely on the fact that if a manual task is loaded, `task` is not null.

      // We need to know if a task IS loaded. 
      // For now, let's set it if NO task is present.
      // Caution: 'task' in closure is from render.
      if (!task && newTracks[0].fixes.length > 0) {
        const firstFix = newTracks[0].fixes[0];
        try {
          const tz = tzlookup(firstFix.latitude, firstFix.longitude);
          setTimezone(tz);
        } catch (e) {
          console.warn("Failed to detect timezone from track", e);
          setTimezone('UTC');
        }
      }
    }
  }, [task]); // Add task dependency

  // Thermal Map State
  const [showThermal, setShowThermal] = useState(false);
  const [thermalOpacity, setThermalOpacity] = useState(0.5);

  // Task Visibility State (Default true, but effective only if task exists)
  const [showTask, setShowTask] = useState(true);

  const handleTaskLoaded = (newTask: XCTask) => {
    setTask(newTask);
    setShowTask(true); // Ensure task is visible when new one loaded

    // Detect Timezone from Task (Priority)
    if (newTask.turnpoints && newTask.turnpoints.length > 0) {
      try {
        const tp = newTask.turnpoints[0]; // Use first turnpoint (Takeoff or SSS)
        const tz = tzlookup(tp.lat, tp.lon);
        setTimezone(tz);
        console.log("Set timezone from task:", tz);
      } catch (e) {
        console.warn("Failed to detect timezone from task", e);
      }
    }
  };

  const handleTrailLengthChange = (option: TrailLengthOption) => {
    setTrailLengthOption(option);
    switch (option) {
      case '10min': setTrailLength(600); break;
      case '20min': setTrailLength(1200); break;
      case '40min': setTrailLength(2400); break;
      case '60min': setTrailLength(3600); break;
      case 'all': setTrailLength(86400); break; // 24 hours
    }
  };

  const handleToggleVisibility = (filename: string) => {
    setTrackVisibility(prev => ({
      ...prev,
      [filename]: !prev[filename]
    }));
  };



  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
      {/* Sidebar */}
      <div style={{
        width: '320px',
        height: '100%',
        backgroundColor: '#f5f5f5',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #ddd',
        zIndex: 10,
        padding: '10px',
        boxSizing: 'border-box'
      }}>
        <TaskLoader
          onTaskLoaded={handleTaskLoaded}
          task={task}
          timezone={timezone}
          trackDate={JulianDate.toDate(trackDate)}
        />
        <TrackLoader onTracksLoaded={handleTracksLoaded} />

        {/* Settings Widget */}
        <div style={{
          marginBottom: '10px',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          padding: '10px',
          borderRadius: '5px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
        }}>
          <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Trail Length</label>
          <select
            value={trailLengthOption}
            onChange={(e) => handleTrailLengthChange(e.target.value as TrailLengthOption)}
            style={{ width: '100%', padding: '5px', marginBottom: '10px' }}
          >
            <option value="10min">10 min trail</option>
            <option value="20min">20 min trail</option>
            <option value="40min">40 min trail</option>
            <option value="60min">60 min trail</option>
            <option value="all">Full track</option>
          </select>

          <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Map Overlays</label>

          {/* Task Visibility Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px', opacity: task ? 1 : 0.5 }}>
            <input
              type="checkbox"
              checked={showTask}
              onChange={(e) => setShowTask(e.target.checked)}
              id="task-toggle"
              disabled={!task}
              style={{ marginRight: '8px' }}
            />
            <label htmlFor="task-toggle" style={{ cursor: task ? 'pointer' : 'default' }}>Show Task</label>
          </div>

          {/* Thermal Map Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
            <input
              type="checkbox"
              checked={showThermal}
              onChange={(e) => setShowThermal(e.target.checked)}
              id="thermal-toggle"
              style={{ marginRight: '8px' }}
            />
            <label htmlFor="thermal-toggle" style={{ cursor: 'pointer' }}>Show KK7 Thermals</label>
          </div>
          {showThermal && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8em', marginRight: '5px', width: '50px' }}>Opacity:</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={thermalOpacity}
                onChange={(e) => setThermalOpacity(parseFloat(e.target.value))}
                style={{ flex: 1 }}
              />
            </div>
          )}
        </div>

        {/* Pilot List taking remaining space */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <PilotList
            tracks={tracks}
            visibility={trackVisibility}
            onToggleVisibility={handleToggleVisibility}
            pilotStats={pilotStats}
          />
        </div>
      </div>

      {/* Main Viewer */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Viewer
          tracks={tracks}
          task={task} // Always pass the task object if it exists
          showTask={showTask} // Control visibility via prop
          trackDate={trackDate}
          trailLength={trailLength}
          visibility={trackVisibility}
          timezone={timezone}
          onStatsUpdate={setPilotStats}
          showThermal={showThermal}
          thermalOpacity={thermalOpacity}
        />
      </div>
    </div>
  );
};

export default App;
