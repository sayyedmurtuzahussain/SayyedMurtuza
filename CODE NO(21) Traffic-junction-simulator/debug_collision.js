import { StateManager } from './src/sim/stateManager.js';

const sm = new StateManager({
  seed: 999,
  defaultRates: { north: 22, south: 22, east: 18, west: 18 },
});

const dt = 1 / 60;
let logged = 0;

for (let t = 0; t < 5000 && logged < 5; t++) {
  sm.step(dt);
  const cars = sm.simA.vehicles;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const c1 = cars[i];
      const c2 = cars[j];
      const dist = Math.hypot(c1.x - c2.x, c1.y - c2.y);
      if (dist < 12) {
        console.log(`Collision at tick ${t}:`);
        console.log(`  Car 1 (ID ${c1.id}): dir=${c1.originDir}, route=${c1.route}, x=${c1.x.toFixed(1)}, y=${c1.y.toFixed(1)}, distAlongPath=${c1.distance.toFixed(1)}, speed=${c1.speed.toFixed(1)}`);
        console.log(`  Car 2 (ID ${c2.id}): dir=${c2.originDir}, route=${c2.route}, x=${c2.x.toFixed(1)}, y=${c2.y.toFixed(1)}, distAlongPath=${c2.distance.toFixed(1)}, speed=${c2.speed.toFixed(1)}`);
        logged++;
      }
    }
  }
}
