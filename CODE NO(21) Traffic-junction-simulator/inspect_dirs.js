import { StateManager } from './src/sim/stateManager.js';

const sm = new StateManager({
  seed: 42,
  defaultRates: { north: 24, south: 24, east: 8, west: 8 },
});

const dt = 1 / 60;
for (let t = 0; t < 5000; t++) {
  sm.step(dt);
}

const sA = sm.simA.getSnapshot();
const sB = sm.simB.getSnapshot();

console.log('Sim A Directions:', JSON.stringify(sA.stats.byDirection, null, 2));
console.log('Sim B Directions:', JSON.stringify(sB.stats.byDirection, null, 2));
console.log('Sim A Phase:', sA.phase, 'Sim B Phase:', sB.phase);
