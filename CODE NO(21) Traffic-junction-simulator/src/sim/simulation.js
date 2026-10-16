// Pure Headless Simulation Instance (zero DOM / Canvas dependencies)
// Executes the strictly ordered sequence on every fixed dt tick

import { PRNG } from './prng.js';
import { Spawner } from './spawner.js';
import { JunctionConflictManager } from './conflictManager.js';
import { PhysicsEngine } from './physics.js';
import { SignalController } from './controller.js';
import { StatsTracker } from './stats.js';
import { JUNCTION_CONFIG } from './junction.js';

export class SimulationInstance {
  constructor({ id, name, controllerMode = 'fixed', seed = 42, arrivalRates = { north: 12, south: 12, east: 10, west: 10 } }) {
    this.id = id;
    this.name = name;
    this.controllerMode = controllerMode;
    this.initialSeed = seed;

    this.prng = new PRNG(seed);
    this.spawner = new Spawner(this.prng, arrivalRates);
    this.conflictManager = new JunctionConflictManager(JUNCTION_CONFIG);
    this.physics = new PhysicsEngine(this.conflictManager);
    this.controller = new SignalController(controllerMode);
    this.stats = new StatsTracker();

    this.vehicles = [];
    this.simTime = 0;
  }

  // Executes one fixed dt step in strictly ordered sequence
  step(dt) {
    this.simTime += dt;

    // 1. Update Signals & Timers
    this.controller.update(this.stats, dt, this.vehicles);

    // 2. Spawn pending cars (if entry clear)
    this.spawner.update(this.vehicles, this.stats, dt, this.simTime);

    // 3, 4, 5, 6, 7. Physics update (Leaders -> IDM -> Conflict Manager -> Move -> Events)
    this.vehicles = this.physics.update(this.vehicles, this.controller, this.stats, dt);
  }

  // Trigger priority emergency vehicle
  triggerEmergency(dir) {
    const carId = this.spawner.triggerEmergency(dir, this.simTime);
    this.controller.triggerEmergency(dir, carId);
    return carId;
  }

  // Set directional arrival rates (cars per minute)
  setArrivalRates(rates) {
    this.spawner.rates = { ...rates };
  }

  // Resets simulation completely to original state and seed
  reset(newSeed = this.initialSeed) {
    this.simTime = 0;
    this.vehicles = [];
    this.prng.reset(newSeed);
    this.spawner.reset();
    this.controller.reset();
    this.stats.reset();
  }

  // Produces a clean, immutable state snapshot for rendering and dashboard
  getSnapshot() {
    return {
      id: this.id,
      name: this.name,
      mode: this.controllerMode,
      simTime: this.simTime,
      signals: {
        north: this.controller.getSignal('north'),
        south: this.controller.getSignal('south'),
        east: this.controller.getSignal('east'),
        west: this.controller.getSignal('west'),
      },
      phase: this.controller.currentPhase,
      emergencyState: this.controller.emergencyState,
      vehicles: this.vehicles.map((v) => ({
        id: v.id,
        x: v.x,
        y: v.y,
        angle: v.angle,
        speed: v.speed,
        length: v.length,
        width: v.width,
        color: v.color,
        route: v.route,
        originDir: v.originDir,
        isEmergency: v.isEmergency,
        brakeActive: v.brakeActive,
        turnSignal: v.turnSignal,
        waitTime: v.totalWaitTime,
        inQueue: v.inQueue,
      })),
      stats: this.stats.getSnapshot(),
    };
  }
}
