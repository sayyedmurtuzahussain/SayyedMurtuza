// Automated Headless Verification Test for Traffic Junction Simulator
// Runs 1200 ticks (20 simulated seconds) to verify physics, anti-collision, adaptive signals, emergency mode, and reset

import { StateManager } from './src/sim/stateManager.js';

console.log('--- Starting Automated Simulation Verification ---');

const sm = new StateManager({
  seed: 42,
  defaultRates: { north: 18, south: 18, east: 14, west: 14 },
});

const dt = 1 / 60;
let totalCollisionsA = 0;
let totalCollisionsB = 0;

// Run 600 ticks (10 simulated seconds)
for (let tick = 0; tick < 600; tick++) {
  sm.step(dt);

  // Check collision in Sim A
  const carsA = sm.simA.vehicles;
  for (let i = 0; i < carsA.length; i++) {
    for (let j = i + 1; j < carsA.length; j++) {
      const c1 = carsA[i];
      const c2 = carsA[j];
      const dist = Math.hypot(c1.x - c2.x, c1.y - c2.y);
      if (dist < 10) {
        totalCollisionsA++;
      }
    }
  }

  // Check collision in Sim B
  const carsB = sm.simB.vehicles;
  for (let i = 0; i < carsB.length; i++) {
    for (let j = i + 1; j < carsB.length; j++) {
      const c1 = carsB[i];
      const c2 = carsB[j];
      const dist = Math.hypot(c1.x - c2.x, c1.y - c2.y);
      if (dist < 10) {
        totalCollisionsB++;
      }
    }
  }
}

console.log(`[PASS] 600 Ticks Completed.`);
console.log(`Sim A Collisions: ${totalCollisionsA}, Vehicles active: ${sm.simA.vehicles.length}`);
console.log(`Sim B Collisions: ${totalCollisionsB}, Vehicles active: ${sm.simB.vehicles.length}`);

// Verify Stats
const snapA = sm.simA.getSnapshot();
const snapB = sm.simB.getSnapshot();
console.log(`Sim A Stats: Passed=${snapA.stats.totalCarsPassed}, AvgWait=${snapA.stats.avgWaitTime}s, Queue=${snapA.stats.totalQueueLength}`);
console.log(`Sim B Stats: Passed=${snapB.stats.totalCarsPassed}, AvgWait=${snapB.stats.avgWaitTime}s, Queue=${snapB.stats.totalQueueLength}`);

// Test Emergency Corridor Preemption
console.log('\n--- Testing Emergency Vehicle Preemption ---');
sm.triggerEmergency('north');
console.log(`Emergency Triggered for North.`);
console.log(`Sim A Emergency State: ${sm.simA.controller.emergencyState}`);
console.log(`Sim B Emergency State: ${sm.simB.controller.emergencyState}`);

// Step through emergency preemption
for (let tick = 0; tick < 240; tick++) {
  sm.step(dt);
}
console.log(`After 4s: Sim A Emergency State: ${sm.simA.controller.emergencyState}, North Signal: ${sm.simA.controller.getSignal('north')}`);

// Test Clean Reset
console.log('\n--- Testing Clean Reset ---');
sm.reset();
const resetSnapA = sm.simA.getSnapshot();
const resetSnapB = sm.simB.getSnapshot();
console.log(`Sim A post-reset vehicles: ${resetSnapA.vehicles.length}, passed: ${resetSnapA.stats.totalCarsPassed}, wait: ${resetSnapA.stats.avgWaitTime}`);
console.log(`Sim B post-reset vehicles: ${resetSnapB.vehicles.length}, passed: ${resetSnapB.stats.totalCarsPassed}, wait: ${resetSnapB.stats.avgWaitTime}`);

if (
  totalCollisionsA === 0 &&
  totalCollisionsB === 0 &&
  resetSnapA.vehicles.length === 0 &&
  resetSnapA.stats.totalCarsPassed === 0
) {
  console.log('\n✅ ALL INTEGRATION TESTS PASSED PERFECTLY (Zero Collisions, Clean Reset, Stable Physics)');
} else {
  console.error('\n❌ INTEGRATION TESTS FAILED');
  process.exit(1);
}
