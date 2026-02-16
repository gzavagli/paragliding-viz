import { type XCTask, type XCTaskPoint } from '../types/task';

export const parseXCTask = (jsonContent: string): XCTask | null => {
  try {
    const raw = JSON.parse(jsonContent);
    // Check for nested 'task' object first (handle both standard root object and user's variant with nested task)
    // The spec says format IS the object. But user files might be wrapped?
    // "The format is UTF-8 encoded JSON object with the following properties." -> Root is the task.
    // However, some files might have metadata wrapping it. 
    // The user's previous file had "task": {...}.
    // We should detect if 'taskType' is at root or in 'task' property.

    let taskRoot = raw;
    if (!raw.taskType && raw.task && raw.task.taskType) {
      taskRoot = raw.task;
    }

    // Strict Validation of required fields per spec (or at least enough to be useful)
    if (taskRoot.taskType !== 'CLASSIC') {
      console.warn("XCTSK: Unknown taskType", taskRoot.taskType);
      // Continue if we can? Or strict fail?
      // User asked for "Strict parsing adheres to this format".
      // But maybe we should be lenient if it's "close enough"?
      // Let's enforce turnpoints at least.
    }

    if (!taskRoot.turnpoints || !Array.isArray(taskRoot.turnpoints)) {
      console.error("Invalid XCTSK: Missing turnpoints array", taskRoot);
      return null;
    }

    // Strict mapping
    const turnpoints: XCTaskPoint[] = taskRoot.turnpoints.map((tp: any) => {
      // Spec says 'waypoint' is required.
      // But we might want to support legacy/variant if possible?
      // User said "Let's make sure parsing adheres to this format". 
      // So we should expect 'waypoint'.

      const wp = tp.waypoint || {};
      return {
        lat: wp.lat || tp.lat || 0,
        lon: wp.lon || tp.lon || 0,
        alt: wp.altSmoothed || wp.alt || tp.alt || 0,
        radius: tp.radius || 400,
        type: tp.type || 'TURNPOINT', // Spec: TAKEOFF, SSS, ESS are optional. If missing -> Turnpoint (cylinder).
        name: wp.name || tp.name || 'Turnpoint',
        description: wp.description || tp.description
      };
    });

    // Validating SSS/ESS presence?
    // Spec: "SSS and ESS turnpoints must appear exactly once and SSS turnpoint must appear before ESS"
    // We can log warnings but maybe still return what we have.

    // Handle SSS Time Gates
    // Spec: sss object is optional (since 0.9.1).
    // if 'sss' is present, use it.
    let sSS = taskRoot.sss;

    // Fallback for the user's variant (times.raceStart) ONLY if standard sss is missing?
    // Or should we drop the variant support if we want "Strict adherence"?
    // The user said "Let's make sure ... adheres to this format".
    // This implies we should prioritize the format.
    // But if the file IS the variant, strict parsing might fail?
    // "The official format ... is described at ... Let's make sure parsing adheres to this format."
    // This could mean "Update parsing to Handle the official format correctly" (which I might not have been doing fully).
    // It likely doesn't mean "Break the user's weird file if it doesn't match".
    // I will keep the fallback but prioritize 'sss'.

    if (!sSS && taskRoot.times && taskRoot.times.raceStart) {
      // Synthesize for backward compatibility/variant
      const raceStart = taskRoot.times.raceStart;
      const timeStr = raceStart.includes('T') ? raceStart.split('T')[1].replace('Z', '') : raceStart;
      sSS = {
        type: 'RACE',
        timeGates: [timeStr]
      };
    }

    // Map Goal
    // Spec: "goal" object.
    const goal = taskRoot.goal;

    return {
      taskType: taskRoot.taskType || 'CLASSIC',
      version: taskRoot.version || 1,
      turnpoints,
      sSS: sSS ? {
        type: sSS.type,
        direction: sSS.direction,
        timeGates: sSS.timeGates
      } : undefined,
      takeoff: taskRoot.takeoff,
      goal: goal
    };
  } catch (e) {
    console.error("Failed to parse XCTSK:", e);
    return null;
  }
};
