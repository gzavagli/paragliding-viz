import IGCParser from 'igc-parser';

export interface IGCFile extends IGCParser.IGCFile {
  filename: string; // Added by TrackLoader
  color: string;    // Added by TrackLoader
}

export interface PilotStats {
  speed: number; // km/h
  agl: number;   // m
  vario: number; // m/s
}
