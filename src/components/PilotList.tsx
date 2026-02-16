import React from 'react';
import type { IGCFile } from '../types/igc';

interface PilotListProps {
  tracks: IGCFile[];
  visibility: Record<string, boolean>;
  onToggleVisibility: (filename: string) => void;
  pilotStats?: Record<string, import('../types/igc').PilotStats>;
}

const PilotList: React.FC<PilotListProps> = ({ tracks, visibility, onToggleVisibility, pilotStats }) => {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      backgroundColor: 'white',
      borderTop: '1px solid #ccc',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ padding: 10, borderBottom: '1px solid #eee' }}>
        <h3>Pilots ({tracks.length})</h3>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tracks.map((track) => {
          const isVisible = visibility[track.filename];
          const stats = pilotStats ? pilotStats[track.filename] : undefined;

          return (
            <div
              key={track.filename}
              style={{
                padding: '8px 10px',
                borderBottom: '1px solid #eee',
                display: 'flex',
                alignItems: 'center',
                backgroundColor: isVisible ? 'transparent' : '#f5f5f5',
                opacity: isVisible ? 1 : 0.6
              }}
            >
              <input
                type="checkbox"
                checked={isVisible || false}
                onChange={() => onToggleVisibility(track.filename)}
                style={{ marginRight: 10 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      backgroundColor: track.color,
                      marginRight: '8px',
                      borderRadius: '2px'
                    }} />
                    <div style={{ color: 'black', fontSize: '0.9em' }}>
                      {track.pilot || 'Unknown'}
                    </div>
                  </div>
                </div>

                {/* Stats Row */}
                {stats && (
                  <div style={{
                    display: 'flex',
                    fontSize: '0.75em',
                    color: '#666',
                    marginTop: '4px',
                    gap: '10px'
                  }}>
                    <div>
                      <span style={{ fontWeight: '600' }}>{stats.speed.toFixed(0)}</span> km/h
                    </div>
                    <div>
                      <span style={{ fontWeight: '600' }}>{stats.agl.toFixed(0)}</span> m AGL
                    </div>
                    <div style={{ color: stats.vario > 0 ? 'green' : stats.vario < -0.5 ? 'red' : '#666' }}>
                      <span style={{ fontWeight: '600' }}>{stats.vario > 0 ? '+' : ''}{stats.vario.toFixed(1)}</span> m/s
                    </div>
                  </div>
                )}

                <div style={{ fontSize: '0.8em', color: '#666', marginTop: '2px' }}>
                  {track.gliderType}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PilotList;
