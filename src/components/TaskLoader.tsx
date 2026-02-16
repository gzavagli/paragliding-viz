import React, { useRef } from 'react';
import { parseXCTask } from '../utils/xctsk';
import { type XCTask } from '../types/task';
import { calculateOptimizedPath, calculateTaskDistance } from '../utils/optimization';

interface TaskLoaderProps {
  onTaskLoaded: (task: XCTask) => void;
  task: XCTask | null;
  timezone?: string;
  trackDate?: Date;
}

const TaskLoader: React.FC<TaskLoaderProps> = ({ onTaskLoaded, task }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  // Auto-expand when a new task is loaded
  React.useEffect(() => {
    if (task) {
      setIsCollapsed(false);
    }
  }, [task]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const task = parseXCTask(text);
      if (task) {
        onTaskLoaded(task);
      } else {
        alert("Failed to parse task file. Please ensure it is a valid .xctsk file.");
      }
    } catch (e) {
      console.error("Error reading file:", e);
      alert("Error reading file.");
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const taskStats = React.useMemo(() => {
    if (!task) return null;
    const path = calculateOptimizedPath(task);
    const distance = calculateTaskDistance(path);
    return {
      distance: (distance / 1000).toFixed(1) // km
    };
  }, [task]);

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    try {
      // PRD: "If the start time in the task file includes timezone indication (e.g. 'Z' for UTC), ignore it and use the auto-detected timezone."
      // PRD: "All timestamps rendered in the UI should be shown with respect to the local timezone."
      // Interpretation: The time value IN the file IS the local time value. 
      // Example: "12:00Z" -> "12:00 Local" -> Show "12:00".
      // We should NOT shift it. Just clean it.

      let clean = timeStr.replace('Z', '');
      // Remove offsets if any
      clean = clean.replace(/([+-]\d{2}:?\d{2})$/, '');

      const parts = clean.split(':');
      if (parts.length >= 2) {
        return `${parts[0]}:${parts[1]}`; // HH:MM
      }
      return clean;
    } catch (e) {
      console.error("Error formatting time:", e);
      return timeStr.substring(0, 5);
    }
  };

  return (
    <div style={{
      marginBottom: '10px',
      background: 'rgba(255, 255, 255, 0.9)',
      padding: '10px',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      pointerEvents: 'auto',
      maxHeight: '40vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ marginBottom: '5px', fontWeight: 'bold' }}>Competition Task</div>
      <input
        type="file"
        accept=".xctsk"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        ref={fileInputRef}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        style={{
          padding: '8px 16px',
          background: '#4CAF50', // Greenish to distinguish
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          width: '100%',
          fontWeight: 'bold',
          marginBottom: task ? '10px' : '0'
        }}
      >
        {task ? 'Replace Task File' : 'Load Task File (.xctsk)'}
      </button>

      {task && taskStats && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div
            style={{
              marginBottom: '5px',
              fontSize: '0.9em',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              userSelect: 'none',
              background: '#eee',
              padding: '5px',
              borderRadius: '4px'
            }}
            onClick={() => setIsCollapsed(!isCollapsed)}
            title="Click to toggle task details"
          >
            <span><strong>Dist:</strong> {taskStats.distance} km</span>
            <span>{isCollapsed ? '▶' : '▼'}</span>
          </div>

          {!isCollapsed && (
            <div style={{ overflowY: 'auto', flex: 1, fontSize: '0.85em' }}>
              <strong>Turnpoints:</strong>
              <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
                {task.turnpoints.map((tp, idx) => (
                  <li key={idx} style={{ marginBottom: '4px' }}>
                    <span style={{ fontWeight: 'bold' }}>
                      {tp.type === 'SSS' ? 'SSS' : tp.type === 'ESS' ? 'ESS' : tp.type === 'GOAL' ? 'Goal' : tp.type === 'TAKEOFF' ? 'Takeoff' : `TP${idx + 1}`}
                    </span>
                    {tp.type === 'SSS' && task.sSS?.timeGates?.[0] && ` (${formatTime(task.sSS.timeGates[0])})`}
                    : {tp.name}
                    <br />
                    <span style={{ color: '#666' }}>
                      {tp.radius}m {tp.type === 'SSS' ? 'Exit' : tp.type === 'ESS' || tp.type === 'GOAL' ? 'Cylinder' : 'Cylinder'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskLoader;
