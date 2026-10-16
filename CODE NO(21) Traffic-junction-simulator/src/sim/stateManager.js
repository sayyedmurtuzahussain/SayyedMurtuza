// State Manager
// Coordinates Sim A (Fixed Timing) and Sim B (Adaptive AI) running in lockstep
// Driven by identical seeds and arrival rates for 100% fair comparison

import { SimulationInstance } from './simulation.js';

export class StateManager {
  constructor({ seed = 12345, defaultRates = { north: 14, south: 14, east: 10, west: 10 } } = {}) {
    this.seed = seed;
    this.rates = { ...defaultRates };

    this.isRunning = true;
    this.timeScale = 1.0;
    this.viewMode = 'sideBySide'; // 'sideBySide', 'simA', 'simB'
    this.selectedVehicle = null;

    // Instantiate Sim A (Fixed Timing) and Sim B (Adaptive AI)
    this.simA = new SimulationInstance({
      id: 'simA',
      name: 'Fixed Timing',
      controllerMode: 'fixed',
      seed: this.seed,
      arrivalRates: this.rates,
    });

    this.simB = new SimulationInstance({
      id: 'simB',
      name: 'Adaptive AI',
      controllerMode: 'adaptive',
      seed: this.seed,
      arrivalRates: this.rates,
    });
  }

  // Advance both simulations by dt in lockstep
  step(dt) {
    this.simA.step(dt);
    this.simB.step(dt);
  }

  // Single step advance (exactly 1/60s tick)
  stepSingle(dt = 1 / 60) {
    this.simA.step(dt);
    this.simB.step(dt);
  }

  // Set directional arrival rates across both simulations
  setArrivalRates(rates) {
    this.rates = { ...rates };
    this.simA.setArrivalRates(this.rates);
    this.simB.setArrivalRates(this.rates);
  }

  // Trigger emergency corridor on both simulations
  triggerEmergency(dir) {
    this.simA.triggerEmergency(dir);
    this.simB.triggerEmergency(dir);
  }

  // Clean reset: recreates or resets both simulations from the seed
  reset(newSeed = this.seed) {
    this.seed = newSeed;
    this.simA.reset(newSeed);
    this.simB.reset(newSeed);
    this.selectedVehicle = null;
  }

  // Retreives state snapshots for rendering and dashboard
  getSnapshots() {
    return {
      simA: this.simA.getSnapshot(),
      simB: this.simB.getSnapshot(),
      viewMode: this.viewMode,
      isRunning: this.isRunning,
      timeScale: this.timeScale,
      seed: this.seed,
      rates: this.rates,
    };
  }
}
