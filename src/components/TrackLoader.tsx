
import React, { useCallback } from 'react';
import IGCParser from 'igc-parser';
import type { IGCFile } from '../types/igc';
import { getCssColor } from '../utils/colors';

interface TrackLoaderProps {
  onTracksLoaded: (tracks: IGCFile[]) => void;
}

const TrackLoader: React.FC<TrackLoaderProps> = ({ onTracksLoaded }) => {
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const loadedTracks: IGCFile[] = [];
    const promises: Promise<void>[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const index = i; // Get the index for color assignment
      const promise = new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          if (content) {
            try {
              const igcFile = IGCParser.parse(content);
              (igcFile as IGCFile).filename = file.name;
              (igcFile as IGCFile).color = getCssColor(index);
              loadedTracks.push(igcFile as IGCFile);
            } catch (error) {
              console.error(`Error parsing IGC file ${file.name}:`, error);
              alert(`Failed to parse IGC file: ${file.name}`);
            }
          }
          resolve();
        };
        reader.readAsText(file);
      });
      promises.push(promise);
    }

    Promise.all(promises).then(() => {
      onTracksLoaded(loadedTracks);
    });
  }, [onTracksLoaded]);

  return (
    <div style={{
      marginBottom: '10px',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      padding: '10px',
      borderRadius: '5px',
      boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
    }}>
      <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Load Flight Logs</label>
      <input type="file" accept=".igc" multiple onChange={handleFileChange} />
    </div>
  );
};

export default TrackLoader;
