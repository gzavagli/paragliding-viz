import React, { useState } from 'react';

const HelpOverlay: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsVisible(!isVisible)}
        style={{
          position: 'absolute',
          bottom: 45, // Above timeline
          left: 10,   // Left side
          padding: '8px 16px',
          background: 'rgba(0, 0, 0, 0.6)',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          zIndex: 100,
          fontWeight: 'bold',
          color: 'white'
        }}
      >
        ? Help
      </button>

      {isVisible && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: 20,
          borderRadius: 8,
          zIndex: 101,
          maxWidth: 400
        }}>
          <h2 style={{ marginTop: 0 }}>How to Navigate</h2>
          <ul style={{ lineHeight: '1.6' }}>
            <li><strong>Left Click + Drag:</strong> Pan the map (Move).</li>
            <li><strong>Right Click + Drag:</strong> Zoom in/out.</li>
            <li><strong>Middle Click + Drag:</strong> Tilt and Rotate (3D).</li>
            <li><strong>Scroll Wheel:</strong> Zoom in/out.</li>
            <li><strong>Ctrl + Left Drag:</strong> Tilt and Rotate.</li>
          </ul>
          <button
            onClick={() => setIsVisible(false)}
            style={{
              marginTop: 10,
              padding: '5px 10px',
              cursor: 'pointer',
              width: '100%'
            }}
          >
            Close
          </button>
        </div>
      )}
    </>
  );
};

export default HelpOverlay;
