import React from 'react';

export type TrailLengthOption = 'all' | '10min';

interface SettingsPanelProps {
  trailLength: TrailLengthOption;
  setTrailLength: (length: TrailLengthOption) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ trailLength, setTrailLength }) => {
  return (
    <div style={{
      background: 'white',
      padding: 10,
      borderRadius: 4,
      boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
      fontFamily: 'sans-serif',
      fontSize: '14px'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: 5 }}>Settings</div>
      <div style={{ marginBottom: 5 }}>Track Trail Length:</div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <label style={{ cursor: 'pointer' }}>
          <input
            type="radio"
            name="trailLength"
            value="all"
            checked={trailLength === 'all'}
            onChange={() => setTrailLength('all')}
          /> All
        </label>
        <label style={{ cursor: 'pointer' }}>
          <input
            type="radio"
            name="trailLength"
            value="10min"
            checked={trailLength === '10min'}
            onChange={() => setTrailLength('10min')}
          /> 10 Min
        </label>
      </div>
    </div>
  );
};

export default SettingsPanel;
