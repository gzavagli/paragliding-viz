# Product Requirements Document: Paragliding Task Viewer

**Version:** 1.1  
**Last Updated:** Feb 16, 2026  
**Authors:** Guido Zavagli (gzavagli@google.com)  
**Status:** In Development / Feature Complete (V1)  

## 1. Introduction & Goals

*   **Objective:** Create a web application that allows paragliding pilots to upload IGC track logs and XCTSK task files to visualize their flights in 3D, analyze performance, and compare their paths against the optimized competition task.
*   **Target User:** Competition pilots, cross-country paragliders, and meet directors who need to debrief flights and score tasks visually.
*   **Success Metrics:**
    *   Accurate rendering of 3D tracks and terrain.
    *   Correct parsing and visualization of competition tasks (cylinders, start/end times).
    *   Smooth playback of multiple tracks simultaneously.
    *   Intuitive UI for filtering pilots and adjusting playback.

## 2. Functional Requirements

### Feature 1: Flight Verification & Visualization
*   **Description:** Users can load and view flight data in a realistic 3D environment.
*   **Key Capabilities:**
    *   **IGC File Support:** Parse and render standard `.igc` track log files.
    *   **Multi-Track Support:** Load multiple pilots simultaneously for side-by-side comparison.
    *   **3D Path Rendering:** Visualize flight paths with altitude data relative to 3D terrain.
    *   **Pilot Identification:** distinctive colors for each track and "billboard" style labels with pilot initials.
    *   **Trail Rendering:** Configurable trail length (e.g., last 10 minutes vs full track) to reduce visual clutter.

### Feature 2: Competition Task Management
*   **Description:** Visualizing the "playing field" is crucial for competition analysis.
*   **Key Capabilities:**
    *   **XCTSK File Support:** Parse `.xctsk` files (XCSoar/XCTrack format).
    *   **Task Geometry:** Render turnpoint cylinders with competition-standard coloring (Red=Start, Yellow=Turnpoint, Orange=Goal).
    *   **Optimized Path:** Calculate and display the shortness possible path (Optimized Task Distance) touching all cylinders.
    *   **Task Info Panel:** Display segment distances, open/close times, and total task distance.
    *   **Auto-Zoom:** Automatically position the camera to frame the entire task area.

### Feature 3: Playback & Analysis Controls
*   **Description:** Tools to replay the flight and analyze specific moments.
*   **Key Capabilities:**
    *   **Time Control:** Play, Pause, and Seek via a timeline slider.
    *   **Variable Speed:** Playback multipliers (1x, 10x, 20x, 50x).
    *   **Live Statistics:** Real-time display of Ground Speed, Vertical Speed (Vario), and Altitude Above Ground (AGL) for the primary pilot.
*   **Timezone Support:** Auto-detect task timezone based on geographic coordinates of the task or the track logs. If a task is loaded, determine the timezone based on the location of the task, otherwise determine the timezone based on the location of the first track log. All timestamps rendeded in the UI should be shown with respect to the local timezone. If the start time in the task file includes timezone indication (e.g. "Z" for UTC), ignore it and use the auto-detected timezone.

### Feature 4: Map Layers & Environment
*   **Description:** Providing context through realistic mapping.
*   **Key Capabilities:**
    *   **3D Terrain:** High-fidelity elevation data (ArcGIS World Elevation).
    *   **Thermal Map Overlay:** Integration with KK7 Thermal Maps (Skyways/Hotspots) to show lift probability. Includes opacity control and auto-disable on connection failure.
    *   **Base Maps:** Satellite/Aerial imagery.

### Feature 5: User Interface & Widgets
*   **Description:** Overlay widgets for interaction without obstructing the 3D view.
*   **Key Capabilities:**
    *   **Pilot List:** Sortable list of loaded pilots with visibility toggles and color legends.
    *   **Settings Panel:** Controls for trail length (default 10 minutes), task visility (default "on" if a task file is loaded, "off" otherwise), and thermal map overlay (default "off").  
    *   **Help Overlay:** Quick reference for 3D camera controls (Pan, Zoom, Tilt).

## 3. Non-Functional Requirements

*   **Performance:**
    *   Efficient rendering of extensive track logs (sampled positions).
    *   Smooth 60fps playback.
    *   Graceful handling of external service failures (e.g., Thermal Map).
*   **Usability:**
    *   Clean, unobtrusive UI using a "glassmorphism" aesthetic.
    *   Responsive layout suitable for desktop analysis.

## 4. Technology Stack

*   **Core:** React, TypeScript, Vite
*   **3D Engine:** CesiumJS (via Resium)
*   **Data Parsing:** Custom IGC and XCTSK parsers
*   **State Management:** React Context / Local State

## 5. Future Roadmap (Post-V1)

*   [ ] **Scoring Lite:** Calculate whether pilots made the start gate and their distance along the task.
*   [ ] **Advanced Sorting:** Sort pilot list by task distance or completion status.
*   [ ] **Cloud Sync:** Save and share debrief sessions.
