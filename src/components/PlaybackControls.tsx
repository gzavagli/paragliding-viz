import React, { useEffect, useState } from 'react';
import { JulianDate } from 'cesium';
import { useCesium } from 'resium';

interface PlaybackControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  multiplier: number;
  setMultiplier: (newMultiplier: number) => void;
  currentTime: JulianDate;
  startTime: JulianDate;
  stopTime: JulianDate;
  onSeek: (time: JulianDate) => void;
  timezone: string;
}

const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  onPlayPause,
  multiplier,
  setMultiplier,
  currentTime,
  startTime,
  stopTime,
  onSeek,
  timezone,
}) => {
  const { viewer } = useCesium();
  const [timeString, setTimeString] = useState('');

  useEffect(() => {
    if (viewer) {
      const listener = () => {
        if (viewer.clock) {
          try {
            const date = JulianDate.toDate(viewer.clock.currentTime);
            const timeStr = new Intl.DateTimeFormat('en-US', {
              timeZone: timezone,
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            }).format(date);

            setTimeString(timeStr);
          } catch (e) {
            console.error("Time format error", e);
          }
        }
      };
      viewer.clock.onTick.addEventListener(listener);
      return () => {
        viewer.clock.onTick.removeEventListener(listener);
      };
    }
  }, [viewer, timezone]); // Added timezone dependency

  const startSeconds = JulianDate.toDate(startTime).getTime() / 1000;
  const stopSeconds = JulianDate.toDate(stopTime).getTime() / 1000;
  const currentSeconds = JulianDate.toDate(currentTime).getTime() / 1000;
  const duration = stopSeconds - startSeconds;
  const elapsed = currentSeconds - startSeconds;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newElapsed = parseFloat(e.target.value);
    const newTime = JulianDate.addSeconds(startTime, newElapsed, new JulianDate());
    onSeek(newTime);
  };

  if (!viewer) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 30,
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(40, 44, 52, 0.9)',
      padding: '10px 20px',
      borderRadius: '8px',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '10px',
      zIndex: 100,
      minWidth: '300px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', width: '100%' }}>
        <button onClick={onPlayPause} style={{ minWidth: '60px', cursor: 'pointer', padding: '5px 10px', backgroundColor: '#444', border: 'none', color: 'white', borderRadius: '4px' }}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <div style={{ fontFamily: 'monospace', minWidth: '80px', textAlign: 'center' }}>{timeString}</div>
        <div style={{ display: 'flex', gap: '5px' }}>
          <button onClick={() => setMultiplier(1)} style={{ fontWeight: multiplier === 1 ? 'bold' : 'normal', cursor: 'pointer', backgroundColor: multiplier === 1 ? '#666' : 'transparent', border: '1px solid #666', color: 'white', padding: '2px 5px', borderRadius: '3px' }}>1x</button>
          <button onClick={() => setMultiplier(10)} style={{ fontWeight: multiplier === 10 ? 'bold' : 'normal', cursor: 'pointer', backgroundColor: multiplier === 10 ? '#666' : 'transparent', border: '1px solid #666', color: 'white', padding: '2px 5px', borderRadius: '3px' }}>10x</button>
          <button onClick={() => setMultiplier(20)} style={{ fontWeight: multiplier === 20 ? 'bold' : 'normal', cursor: 'pointer', backgroundColor: multiplier === 20 ? '#666' : 'transparent', border: '1px solid #666', color: 'white', padding: '2px 5px', borderRadius: '3px' }}>20x</button>
          <button onClick={() => setMultiplier(50)} style={{ fontWeight: multiplier === 50 ? 'bold' : 'normal', cursor: 'pointer', backgroundColor: multiplier === 50 ? '#666' : 'transparent', border: '1px solid #666', color: 'white', padding: '2px 5px', borderRadius: '3px' }}>50x</button>
        </div>
      </div>

      {/* Seek Bar */}
      <input
        type="range"
        min={0}
        max={duration > 0 ? duration : 86400}
        value={elapsed}
        onChange={handleSliderChange}
        style={{ width: '100%', cursor: 'pointer' }}
      />
    </div>
  );
};

export default PlaybackControls;
