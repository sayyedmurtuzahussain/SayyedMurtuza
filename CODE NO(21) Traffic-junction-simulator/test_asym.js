// Interactive test of refined adaptive cycle
import { StateManager } from './src/sim/stateManager.js';

// Let's test asymmetric arrival rates: NS heavy (24/min), EW light (8/min)
const sm = new StateManager({
  seed: 42,
  defaultRates: { north: 24, south: 24, east: 8, west: 8 },
});

const dt = 1 / 60;
for (let t = 0; t < 5000; t++) {
  sm.step(dt);
}

const sA = sm.simA.getSnapshot().stats;
const sB = sm.simB.getSnapshot().stats;

console.log(`Asymmetric Test (NS: 24/min, EW: 8/min):`);
console.log(`Sim A (Fixed): Passed=${sA.totalCarsPassed}, AvgWait=${sA.avgWaitTime}s, Queued=${sA.totalQueueLength}`);
console.log(`Sim B (Adaptive): Passed=${sB.totalCarsPassed}, AvgWait=${sB.avgWaitTime}s, Queued=${sB.totalQueueLength}`);
