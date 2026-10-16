// Left-Hand Traffic (LHD) Junction Geometry Definition
// Vehicles drive on the left (e.g. UK, India, Japan, Australia)
// Free Left Turn lane bypasses junction center via dedicated corner slip curve

export const JUNCTION_CONFIG = {
  width: 800,
  height: 800,
  centerX: 400,
  centerY: 400,
  roadHalfWidth: 80, // Total road width = 160px
  laneWidth: 35,
  stopLineOffset: 85, // Distance from center to stop line (315px or 485px)
  exitLineOffset: 85,
  slipCurveRadius: 55, // Radius of free left-turn island curve
};

export const DIRECTIONS = ['north', 'south', 'east', 'west'];
export const ROUTES = ['straight', 'left', 'right'];

// Lane coordinates for LHD:
// North: incoming from y=0 heading south (+Y), x > 400
// South: incoming from y=800 heading north (-Y), x < 400
// East:  incoming from x=800 heading west (-X), y > 400
// West:  incoming from x=0 heading east (+X), y < 400

export const LANE_SPECS = {
  north: {
    dir: 'north',
    heading: Math.PI / 2, // Downwards
    entryPoint: { x: 422, y: 0 },
    slipEntryPoint: { x: 458, y: 0 },
    stopLine: { x1: 400, y1: 315, x2: 442, y2: 315, coord: 315, axis: 'y', dirSign: 1 },
    exitLine: { x1: 342, y1: 315, x2: 400, y2: 315, coord: 315, axis: 'y' },
    exitTarget: { x: 362, y: 0 },
  },
  south: {
    dir: 'south',
    heading: -Math.PI / 2, // Upwards
    entryPoint: { x: 378, y: 800 },
    slipEntryPoint: { x: 342, y: 800 },
    stopLine: { x1: 358, y1: 485, x2: 400, y2: 485, coord: 485, axis: 'y', dirSign: -1 },
    exitLine: { x1: 400, y1: 485, x2: 458, y2: 485, coord: 485, axis: 'y' },
    exitTarget: { x: 438, y: 800 },
  },
  east: {
    dir: 'east',
    heading: Math.PI, // Leftwards
    entryPoint: { x: 800, y: 422 },
    slipEntryPoint: { x: 800, y: 458 },
    stopLine: { x1: 485, y1: 400, x2: 485, y2: 442, coord: 485, axis: 'x', dirSign: -1 },
    exitLine: { x1: 485, y1: 342, x2: 485, y2: 400, coord: 485, axis: 'x' },
    exitTarget: { x: 800, y: 362 },
  },
  west: {
    dir: 'west',
    heading: 0, // Rightwards
    entryPoint: { x: 0, y: 378 },
    slipEntryPoint: { x: 0, y: 342 },
    stopLine: { x1: 315, y1: 358, x2: 315, y2: 400, coord: 315, axis: 'x', dirSign: 1 },
    exitLine: { x1: 315, y1: 400, x2: 315, y2: 458, coord: 315, axis: 'x' },
    exitTarget: { x: 0, y: 438 },
  },
};

// Generates sampled waypoints along parametric trajectories
export function createRouteWaypoints(fromDir, route) {
  const points = [];
  const C = 400;
  const SL = 85;

  if (fromDir === 'north') {
    if (route === 'straight') {
      return [
        { x: 422, y: 0 },
        { x: 422, y: 315 },
        { x: 422, y: 485 },
        { x: 422, y: 800 },
      ];
    } else if (route === 'left') {
      // Free Left Turn (LHD): Curves along slip lane around NE corner
      return generateBezierCurve([
        { x: 458, y: 0 },
        { x: 458, y: 280 },
        { x: 520, y: 342 },
        { x: 800, y: 362 },
      ], 16);
    } else if (route === 'right') {
      // Right turn: Straight in-lane to stop line (422, 315), then curve across to (0, 438)
      const turnCurve = generateBezierCurve([
        { x: 422, y: 315 },
        { x: 422, y: 390 },
        { x: 380, y: 438 },
        { x: 0, y: 438 },
      ], 16);
      return [{ x: 422, y: 0 }, ...turnCurve];
    }
  }

  if (fromDir === 'south') {
    if (route === 'straight') {
      return [
        { x: 378, y: 800 },
        { x: 378, y: 485 },
        { x: 378, y: 315 },
        { x: 378, y: 0 },
      ];
    } else if (route === 'left') {
      return generateBezierCurve([
        { x: 342, y: 800 },
        { x: 342, y: 520 },
        { x: 280, y: 458 },
        { x: 0, y: 438 },
      ], 16);
    } else if (route === 'right') {
      const turnCurve = generateBezierCurve([
        { x: 378, y: 485 },
        { x: 378, y: 410 },
        { x: 420, y: 362 },
        { x: 800, y: 362 },
      ], 16);
      return [{ x: 378, y: 800 }, ...turnCurve];
    }
  }

  if (fromDir === 'east') {
    if (route === 'straight') {
      return [
        { x: 800, y: 422 },
        { x: 485, y: 422 },
        { x: 315, y: 422 },
        { x: 0, y: 422 },
      ];
    } else if (route === 'left') {
      return generateBezierCurve([
        { x: 800, y: 458 },
        { x: 520, y: 458 },
        { x: 458, y: 520 },
        { x: 438, y: 800 },
      ], 16);
    } else if (route === 'right') {
      const turnCurve = generateBezierCurve([
        { x: 485, y: 422 },
        { x: 410, y: 422 },
        { x: 362, y: 380 },
        { x: 362, y: 0 },
      ], 16);
      return [{ x: 800, y: 422 }, ...turnCurve];
    }
  }

  if (fromDir === 'west') {
    if (route === 'straight') {
      return [
        { x: 0, y: 378 },
        { x: 315, y: 378 },
        { x: 485, y: 378 },
        { x: 800, y: 378 },
      ];
    } else if (route === 'left') {
      return generateBezierCurve([
        { x: 0, y: 342 },
        { x: 280, y: 342 },
        { x: 342, y: 280 },
        { x: 362, y: 0 },
      ], 16);
    } else if (route === 'right') {
      const turnCurve = generateBezierCurve([
        { x: 315, y: 378 },
        { x: 390, y: 378 },
        { x: 438, y: 420 },
        { x: 438, y: 800 },
      ], 16);
      return [{ x: 0, y: 378 }, ...turnCurve];
    }
  }

  return points;
}

// Generates smooth points along cubic or quadratic Bezier curve
function generateBezierCurve(controlPoints, segments = 16) {
  const points = [];
  const n = controlPoints.length - 1;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    let x = 0;
    let y = 0;

    for (let j = 0; j <= n; j++) {
      const b = bernstein(n, j, t);
      x += controlPoints[j].x * b;
      y += controlPoints[j].y * b;
    }
    points.push({ x, y });
  }
  return points;
}

function bernstein(n, i, t) {
  return combination(n, i) * Math.pow(t, i) * Math.pow(1 - t, n - i);
}

function combination(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let c = 1;
  for (let i = 1; i <= k; i++) {
    c = (c * (n - (k - i))) / i;
  }
  return c;
}
