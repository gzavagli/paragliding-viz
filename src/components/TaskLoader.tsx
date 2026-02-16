import React, { useRef } from 'react';
import { parseXCTask } from '../utils/xctsk';
import { type XCTask } from '../types/task';
import { calculateOptimizedPath, calculateTaskDistance } from '../utils/optimization';

interface TaskLoaderProps {
  onTaskLoaded: (task: XCTask) => void;
  task: XCTask | null;
}

const TaskLoader: React.FC<TaskLoaderProps> = ({ onTaskLoaded, task }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{ marginBottom: '10px', fontSize: '0.9em' }}>
            <strong>Task Distance:</strong> {taskStats.distance} km (Optimized)
          </div>
          <div style={{ fontSize: '0.85em' }}>
            <strong>Turnpoints:</strong>
            <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
              {task.turnpoints.map((tp, idx) => (
                <li key={idx} style={{ marginBottom: '4px' }}>
                  <span style={{ fontWeight: 'bold' }}>
                    {tp.type === 'SSS' ? 'SSS' : tp.type === 'ESS' ? 'ESS' : tp.type === 'GOAL' ? 'Goal' : tp.type === 'TAKEOFF' ? 'Takeoff' : `TP${idx + 1}`}
                  </span>
                  {tp.type === 'SSS' && task.sSS?.timeGates?.[0] && ` (${task.sSS.timeGates[0].substring(0, 5)})`}
                  : {tp.name}
                  <br />
                  <span style={{ color: '#666' }}>
                    {tp.radius}m {tp.type === 'SSS' ? 'Exit' : tp.type === 'ESS' || tp.type === 'GOAL' ? 'Cylinder' : 'Cylinder'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskLoader;
