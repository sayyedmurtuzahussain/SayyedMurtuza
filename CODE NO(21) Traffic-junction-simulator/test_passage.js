// Test passage-time green extension
import { StateManager } from './src/sim/stateManager.js';

const sm = new StateManager({
  seed: 999,
  defaultRates: { north: 22, south: 22, east: 18, west: 18 },
});

const dt = 1 / 60;
for (let t = 0; t < 5000; t++) {
  sm.step(dt);
}

const snapA = sm.simA.getSnapshot();
const snapB = sm.simB.getSnapshot();
console.log(`Sim A: Passed=${snapA.stats.totalCarsPassed}, Wait=${snapA.stats.avgWaitTime}s, Queue=${snapA.stats.totalQueueLength}`);
console.log(`Sim B: Passed=${snapB.stats.totalCarsPassed}, Wait=${snapB.stats.avgWaitTime}s, Queue=${snapB.stats.totalQueueLength}`);
