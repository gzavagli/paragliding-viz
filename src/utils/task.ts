
import { Cartesian3, Color } from 'cesium';
import type { XCTask } from '../types/task';

export const getTaskCylinders = (task: XCTask): { position: Cartesian3; radius: number; height: number; color: Color }[] => {
  if (!task || !task.turnpoints) return [];

  return task.turnpoints.map((tp, index) => {
    const center = Cartesian3.fromDegrees(tp.lon, tp.lat, tp.alt || 0); // Use 0 if alt missing

    // Default radius if not specified
    const callbackRadius = tp.radius || 400; // 400m default?

    let color = Color.YELLOW.withAlpha(0.3);
    if (index === 0) color = Color.GREEN.withAlpha(0.3);
    else if (index === task.turnpoints.length - 1) color = Color.RED.withAlpha(0.3);

    return {
      position: center,
      radius: callbackRadius,
      height: 10000, // Arbitrary height for visualization
      color: color
    };
  });
};
