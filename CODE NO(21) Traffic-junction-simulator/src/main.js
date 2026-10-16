// Main Application Bootstrap & Fixed Time-Step Animation Loop
// Strict separation: RAF loop with accumulator, 60 FPS fixed dt physics, ~2 Hz dashboard updates

import { StateManager } from './sim/stateManager.js';
import { CanvasRenderer } from './render/renderer.js';
import { Dashboard } from './ui/dashboard.js';
import { Controls } from './ui/controls.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('junction-canvas');
  if (!canvas) return;

  // Initialize Core Subsystems
  const stateManager = new StateManager({
    seed: 12345,
    defaultRates: { north: 14, south: 14, east: 10, west: 10 },
  });

  const renderer = new CanvasRenderer(canvas);
  const dashboard = new Dashboard();
  const controls = new Controls(stateManager, renderer, dashboard);

  // Initial responsive canvas setup
  window.addEventListener('resize', () => renderer.resize());
  renderer.resize();

  // Animation Loop State
  let lastTime = performance.now();
  let accumulator = 0;
  let lastDashboardUpdate = 0;
  const dt = 1 / 60; // 16.667ms fixed physics tick
  const MAX_FRAME_DELTA = 0.25; // 250ms cap to prevent spiral of death on background tabs

  function mainLoop(currentTime) {
    let frameDelta = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    // Cap delta time against background tab freeze
    if (frameDelta > MAX_FRAME_DELTA) {
      frameDelta = MAX_FRAME_DELTA;
    }

    // Step physics at fixed 1/60s ticks while accumulated time permits
    if (stateManager.isRunning) {
      accumulator += frameDelta * stateManager.timeScale;
      while (accumulator >= dt) {
        stateManager.step(dt);
        accumulator -= dt;
      }
    } else {
      // Pause stops accumulator progression
      accumulator = 0;
    }

    // Render snapshot once per animation frame
    const snapshots = stateManager.getSnapshots();
    renderer.render(snapshots, stateManager.viewMode);
    controls.updateLiveInspector(snapshots);

    // Throttle dashboard stats and performance charts to ~2 Hz (every 500ms)
    if (currentTime - lastDashboardUpdate >= 500) {
      dashboard.update(snapshots);
      lastDashboardUpdate = currentTime;
    }

    requestAnimationFrame(mainLoop);
  }

  // Initial dashboard population
  dashboard.update(stateManager.getSnapshots());

  // Launch loop
  requestAnimationFrame(mainLoop);
});
