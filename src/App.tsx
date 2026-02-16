
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
      // Try to extract task from the first track
      const task = getTaskFromIGC(newTracks[0]);
      if (task) {
        setTask(task);
      }

      // Set date from first track
      if (newTracks[0].date) {
        setTrackDate(JulianDate.fromDate(new Date(newTracks[0].date)));
      }

      // key: Detect Timezone from first point of first track
      if (newTracks[0].fixes.length > 0) {
        const firstFix = newTracks[0].fixes[0];
        try {
          const tz = tzlookup(firstFix.latitude, firstFix.longitude);
          setTimezone(tz);
        } catch (e) {
          console.warn("Failed to detect timezone", e);
          setTimezone('UTC');
        }
      }
    }
  }, []);

  const handleTaskLoaded = (newTask: XCTask) => {
    setTask(newTask);
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
        <TaskLoader onTaskLoaded={handleTaskLoaded} task={task} />
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
            style={{ width: '100%', padding: '5px' }}
          >
            <option value="10min">10 min trail</option>
            <option value="20min">20 min trail</option>
            <option value="40min">40 min trail</option>
            <option value="60min">60 min trail</option>
            <option value="all">Full track</option>
          </select>
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
          task={task}
          trackDate={trackDate}
          trailLength={trailLength}
          visibility={trackVisibility}
          timezone={timezone}
          onStatsUpdate={setPilotStats}
        />
      </div>
    </div>
  );
};

export default App;
