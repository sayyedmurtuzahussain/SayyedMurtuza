// Seeded Vehicle Spawner with Entry Lane Clearance Guards
// Holds pending spawns when entry lane is occupied to prevent overlapping

import { Vehicle } from './vehicle.js';
import { createRouteWaypoints } from './junction.js';
import { TrajectoryPath } from './path.js';

const CAR_COLORS = [
  '#4a7c59', // Forest Sage
  '#d9822b', // Warm Terracotta
  '#5b8296', // Slate Blue
  '#8c7b68', // Warm Sandstone
  '#689775', // Muted Olive
  '#c26d60', // Dusty Brick Red
  '#7a8288', // Basalt Grey
  '#c9a836', // Autumn Amber
  '#eae5d9', // Warm Bone/Cream
];

export class Spawner {
  constructor(prng, rates = { north: 12, south: 12, east: 10, west: 10 }) {
    this.prng = prng;
    this.rates = { ...rates }; // cars per minute
    this.nextVehicleId = 1;

    // Next scheduled spawn time per direction
    this.timers = { north: 0, south: 0, east: 0, west: 0 };
    // Pending queues held due to entry blockage
    this.pendingQueues = { north: [], south: [], east: [], west: [] };

    // Pre-cache trajectory paths for fast instantiation
    this.pathCache = {};
    this.initPathCache();
  }

  initPathCache() {
    const dirs = ['north', 'south', 'east', 'west'];
    const routes = ['straight', 'left', 'right'];

    for (const dir of dirs) {
      this.pathCache[dir] = {};
      for (const route of routes) {
        const waypoints = createRouteWaypoints(dir, route);
        const path = new TrajectoryPath(waypoints);

        // Pre-calculate exact stop line and exit line distances along this path
        if (route !== 'left') {
          // In LHD, straight and right stop at the 315px or 485px stop line
          // The stop line is approximately at distance = 315 from the 0/800 edge
          path.stopLineDistance = 315;
          path.exitLineDistance = 485;
        } else {
          path.stopLineDistance = null; // Free turn never stops at signal
          path.exitLineDistance = path.totalLength - 80;
        }

        this.pathCache[dir][route] = path;
      }
    }
  }

  // Update spawner on tick (dt)
  update(vehicles, statsTracker, dt, simTime) {
    const spawnedCars = [];
    const dirs = ['north', 'south', 'east', 'west'];

    for (const dir of dirs) {
      this.timers[dir] += dt;
      const ratePerMin = this.rates[dir] || 0;

      if (ratePerMin > 0) {
        // Average interval in seconds
        const meanInterval = 60 / ratePerMin;

        // If timer exceeded interval, schedule a new vehicle
        if (this.timers[dir] >= meanInterval) {
          this.timers[dir] = 0;
          const newCarSpec = this.generateVehicleSpec(dir, simTime);
          this.pendingQueues[dir].push(newCarSpec);
        }
      }

      // Try releasing pending vehicles if the entry lane is clear
      if (this.pendingQueues[dir].length > 0) {
        const nextSpec = this.pendingQueues[dir][0];
        if (this.isEntryClear(dir, nextSpec.route, vehicles)) {
          this.pendingQueues[dir].shift();
          const car = new Vehicle(nextSpec);
          vehicles.push(car);
          spawnedCars.push(car);
          statsTracker.onVehicleSpawn(car);
        }
      }
    }

    return spawnedCars;
  }

  // Checks if the entry threshold of the lane is free of any existing vehicle
  isEntryClear(dir, route, vehicles) {
    const isSlip = route === 'left';
    const SAFE_ENTRY_DISTANCE = 40; // px threshold

    for (const car of vehicles) {
      if (car.originDir === dir && (car.route === 'left') === isSlip) {
        // If a car is still near the entry mouth
        if (car.distance < SAFE_ENTRY_DISTANCE) {
          return false;
        }
      }
    }
    return true;
  }

  // Generates randomized vehicle attributes deterministically from PRNG
  generateVehicleSpec(dir, simTime, forceEmergency = false) {
    const id = this.nextVehicleId++;

    let route = 'straight';
    if (!forceEmergency) {
      const roll = this.prng.next();
      if (roll < 0.25) {
        route = 'left'; // Free left turn (25%)
      } else if (roll < 0.40) {
        route = 'right'; // Right turn across traffic (15%)
      } else {
        route = 'straight'; // Straight (60%)
      }
    } else {
      route = 'straight'; // Emergency vehicle takes straight corridor
    }

    const path = this.pathCache[dir][route];
    const colorIndex = this.prng.rangeInt(0, CAR_COLORS.length - 1);
    const color = CAR_COLORS[colorIndex];
    const desiredSpeed = 80 + this.prng.range(-8, 12);

    return {
      id,
      originDir: dir,
      route,
      path,
      isEmergency: forceEmergency,
      desiredSpeed,
      color,
      spawnTime: simTime,
    };
  }

  // Triggers immediate priority emergency vehicle injection
  triggerEmergency(dir, simTime) {
    const spec = this.generateVehicleSpec(dir, simTime, true);
    // Put at front of pending queue so it enters as soon as entry is physically clear
    this.pendingQueues[dir].unshift(spec);
    return spec.id;
  }

  // Reset spawner state
  reset() {
    this.nextVehicleId = 1;
    this.timers = { north: 0, south: 0, east: 0, west: 0 };
    this.pendingQueues = { north: [], south: [], east: [], west: [] };
  }
}
