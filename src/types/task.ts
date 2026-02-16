export interface XCTaskPoint {
  lat: number;
  lon: number;
  alt?: number; // Altitude in meters
  radius: number; // Radius in meters
  type: 'TAKEOFF' | 'SSS' | 'TURNPOINT' | 'ESS' | 'GOAL';
  name?: string;
  description?: string;
}

export interface XCTask {
  taskType: string;
  version: number;
  turnpoints: XCTaskPoint[];
  sSS?: {
    type: string;
    direction?: string;
    timeGates: string[]; // "HH:MM:SSZ" or "HH:MM:SS"
  };
  takeoff?: {
    timeOpen?: string;
    timeClose?: string;
  };
  goal?: {
    type: string;
    deadline?: string;
  };
}

// Strict XCTrack Task Format
// https://xctrack.org/Competition_Interfaces.html
export interface XCTrackPoint {
  lat: number;
  lon: number;
  altSmoothed: number;
  name: string;
  description?: string;
}

export interface XCTrackTurnpoint {
  type?: 'TAKEOFF' | 'SSS' | 'ESS';
  radius: number;
  waypoint: XCTrackPoint;
}

export interface XCTrackTask {
  taskType: 'CLASSIC';
  version: number;
  earthModel?: 'WGS84' | 'FAI_SPHERE';
  turnpoints: XCTrackTurnpoint[];
  takeoff?: {
    timeOpen?: string;
    timeClose?: string;
  };
  sss?: {
    type: 'RACE' | 'ELAPSED-TIME';
    direction?: 'ENTER' | 'EXIT'; // Obsolete, optional
    timeGates: string[];
    timeClose?: string; // Not in main example but in description? "sss.timeClose"
  };
  goal?: {
    type?: 'CYLINDER' | 'LINE';
    deadline?: string;
  };
}
