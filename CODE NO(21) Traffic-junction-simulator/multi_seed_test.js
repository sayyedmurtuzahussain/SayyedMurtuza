import { StateManager } from './src/sim/stateManager.js';

console.log('--- Multi-Seed Verification (5 Different Seeds x 3000 Ticks Each) ---');

const seeds = [42, 100, 777, 12345, 99999];
let allPassed = true;

for (const seed of seeds) {
  const sm = new StateManager({
    seed,
    defaultRates: { north: 18, south: 18, east: 14, west: 14 },
  });
  const dt = 1 / 60;
  let collisions = 0;

  for (let t = 0; t < 3000; t++) {
    sm.step(dt);
    // Sim A
    for (let i = 0; i < sm.simA.vehicles.length; i++) {
      for (let j = i + 1; j < sm.simA.vehicles.length; j++) {
        if (Math.hypot(sm.simA.vehicles[i].x - sm.simA.vehicles[j].x, sm.simA.vehicles[i].y - sm.simA.vehicles[j].y) < 12) {
          collisions++;
        }
      }
    }
    // Sim B
    for (let i = 0; i < sm.simB.vehicles.length; i++) {
      for (let j = i + 1; j < sm.simB.vehicles.length; j++) {
        if (Math.hypot(sm.simB.vehicles[i].x - sm.simB.vehicles[j].x, sm.simB.vehicles[i].y - sm.simB.vehicles[j].y) < 12) {
          collisions++;
        }
      }
    }
  }

  const sA = sm.simA.getSnapshot().stats;
  const sB = sm.simB.getSnapshot().stats;
  console.log(`Seed ${seed}: Collisions=${collisions}, SimA Passed=${sA.totalCarsPassed} (wait ${sA.avgWaitTime}s), SimB Passed=${sB.totalCarsPassed} (wait ${sB.avgWaitTime}s)`);
  if (collisions > 0) allPassed = false;
}

if (allPassed) {
  console.log('\n🏆 ALL 5 RANDOM SEEDS PASSED WITH ZERO COLLISIONS!');
} else {
  console.error('\n❌ FAILED ON SOME SEEDS');
  process.exit(1);
}
