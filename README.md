# Paragliding Task Viewer

A 3D visualization tool for paragliding flights, designed to help pilots analyze their tracks and compare them against official competition tasks.

Built with **React**, **TypeScript**, **Vite**, and **CesiumJS** (via Resium).

## Features

*   **3D Flight Visualization**: Load and view `.igc` track logs in a high-fidelity 3D environment with terrain.
*   **Competition Task Support**: Load `.xctsk` task files to visualize turnpoints, cylinders, and optimized flight paths.
*   **Multi-Track Comparison**: Load multiple pilots simultaneously to compare routes and performance side-by-side.
*   **Advanced Playback**:
    *   Play, Pause, and Seek through the flight timeline.
    *   Variable playback speeds (1x, 10x, 20x, 50x).
    *   Synchronized time slider.
*   **Live Statistics**: Real-time display of Ground Speed, Vertical Speed (Vario), and Altitude Above Ground (AGL).
*   **Map Overlays**:
    *   **3D Terrain**: ArcGIS World Elevation for realistic mountain rendering.
    *   **Thermal Maps**: Integration with KK7 Thermal Maps (Hotspots/Skyways) to visualize lift potential.
*   **Smart Features**:
    *   **Auto-Zoom**: Automatically focuses on the task or track area.
    *   **Timezone Detection**: Automatically detects the correct local timezone based on the task or track location.
    *   **Scoring-Lite**: Visualizes the optimized task distance (shortest path touching all cylinders).

## Getting Started

### Prerequisites

*   Node.js (v18 or higher recommended)
*   npm or yarn

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/paragliding-viz.git
    cd paragliding-viz
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Start the development server:
    ```bash
    npm run dev
    ```

4.  Open your browser at `http://localhost:5173`.

## Product Requirements

For a detailed breakdown of the functional and non-functional requirements, features, and future roadmap, please refer to the **[Product Requirements Document (PRD)](./prd.md)**.

## Project Structure

*   `src/components`: React components (Viewer, TaskLoader, PlaybackControls, etc.)
*   `src/types`: TypeScript interfaces for IGC files, Tasks, and Stats.
*   `src/utils`: Helper functions for file parsing (IGC, XCTSK) and geographic calculations.

## License

[MIT](LICENSE)
