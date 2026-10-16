// UI Event Handlers & User Control Bindings

import { soundFX } from '../render/audio.js';

export class Controls {
  constructor(stateManager, renderer, dashboard) {
    this.stateManager = stateManager;
    this.renderer = renderer;
    this.dashboard = dashboard;

    this.bindControls();
  }

  bindControls() {
    // 1. Play / Pause
    const playPauseBtn = document.getElementById('btn-play-pause');
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', () => {
        soundFX.playClick();
        this.stateManager.isRunning = !this.stateManager.isRunning;
        playPauseBtn.innerHTML = this.stateManager.isRunning
          ? `<svg class="icon" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> Pause`
          : `<svg class="icon" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Resume`;
        playPauseBtn.classList.toggle('active', !this.stateManager.isRunning);
      });
    }

    // 2. Step Button (advances exactly 1 tick dt = 1/60s)
    const stepBtn = document.getElementById('btn-step');
    if (stepBtn) {
      stepBtn.addEventListener('click', () => {
        soundFX.playClick();
        this.stateManager.isRunning = false;
        if (playPauseBtn) {
          playPauseBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Resume`;
        }
        this.stateManager.stepSingle();
        this.renderer.render(this.stateManager.getSnapshots(), this.stateManager.viewMode);
        this.dashboard.update(this.stateManager.getSnapshots());
      });
    }

    // 3. Reset Button (cleanly resets both simulations from seed)
    const resetBtn = document.getElementById('btn-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        soundFX.playClick();
        this.stateManager.reset();
        this.dashboard.reset();
        this.renderer.selectedCarId = null;
        this.hideInspector();
        this.renderer.render(this.stateManager.getSnapshots(), this.stateManager.viewMode);
        this.dashboard.update(this.stateManager.getSnapshots());
      });
    }

    // 4. Speed Multipliers (0.5x, 1x, 2x, 4x)
    const speedButtons = document.querySelectorAll('.btn-speed');
    speedButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        soundFX.playClick();
        speedButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.stateManager.timeScale = parseFloat(btn.dataset.speed || '1');
      });
    });

    // 5. View Mode Switcher
    const viewButtons = document.querySelectorAll('.btn-view');
    viewButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        soundFX.playClick();
        viewButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.stateManager.viewMode = btn.dataset.view;
        this.updateViewCardFocus(btn.dataset.view);
      });
    });

    // 6. Directional Arrival Rate Sliders
    const dirs = ['north', 'south', 'east', 'west'];
    dirs.forEach((dir) => {
      const slider = document.getElementById(`rate-${dir}`);
      const valLabel = document.getElementById(`val-${dir}`);
      if (slider && valLabel) {
        slider.addEventListener('input', (e) => {
          const val = parseInt(e.target.value, 10);
          valLabel.textContent = `${val} /min`;
          this.stateManager.rates[dir] = val;
          this.stateManager.setArrivalRates(this.stateManager.rates);
        });
      }
    });

    // 7. Emergency Vehicle Spawn Buttons
    const emergencyButtons = document.querySelectorAll('.btn-emergency');
    emergencyButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const dir = btn.dataset.dir || 'north';
        soundFX.playClick();
        soundFX.startSiren();
        this.stateManager.triggerEmergency(dir);
        setTimeout(() => soundFX.stopSiren(), 3500);

        // Flash emergency visual on button
        btn.classList.add('pulse-emergency');
        setTimeout(() => btn.classList.remove('pulse-emergency'), 2000);
      });
    });

    // 8. Sound Mute Toggle
    const soundBtn = document.getElementById('btn-sound');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const isMuted = soundFX.toggleMute();
        soundBtn.innerHTML = isMuted
          ? `<svg class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`
          : `<svg class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
        soundBtn.classList.toggle('active', !isMuted);
      });
    }

    // 9. Interactive Vehicle Inspection on Canvas Click/Tap
    this.renderer.canvas.addEventListener('click', (e) => {
      const rect = this.renderer.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const hit = this.renderer.hitTestVehicle(clickX, clickY, this.stateManager.getSnapshots());
      if (hit) {
        soundFX.playClick();
        this.renderer.selectedCarId = hit.car.id;
        this.renderer.selectedSimId = hit.simId;
        this.lastScreenPos = { x: e.clientX, y: e.clientY };
        this.showInspector(hit.car, hit.simId, e.clientX, e.clientY);
      } else {
        this.renderer.selectedCarId = null;
        this.renderer.selectedSimId = null;
        this.hideInspector();
      }
    });
  }

  // Update card opacity when changing view mode (Fixed Only vs Adaptive Only vs Side-by-Side)
  updateViewCardFocus(mode) {
    const cardA = document.querySelector('.card-sim-a');
    const cardB = document.querySelector('.card-sim-b');
    if (!cardA || !cardB) return;

    if (mode === 'simA') {
      cardA.style.opacity = '1';
      cardA.style.borderColor = 'var(--color-fixed)';
      cardB.style.opacity = '0.45';
      cardB.style.borderColor = 'transparent';
    } else if (mode === 'simB') {
      cardB.style.opacity = '1';
      cardB.style.borderColor = 'var(--color-adaptive)';
      cardA.style.opacity = '0.45';
      cardA.style.borderColor = 'transparent';
    } else {
      cardA.style.opacity = '1';
      cardB.style.opacity = '1';
      cardA.style.borderColor = '';
      cardB.style.borderColor = '';
    }
  }

  // Continuously refresh inspector metrics while vehicle is in motion
  updateLiveInspector(snapshots) {
    if (!this.renderer.selectedCarId || !this.renderer.selectedSimId) return;

    const sim = snapshots[this.renderer.selectedSimId];
    if (!sim) return;

    const car = sim.vehicles.find((v) => v.id === this.renderer.selectedCarId);
    const pop = document.getElementById('inspector-popover');
    if (!pop) return;

    if (car) {
      const speedEl = pop.querySelector('.pop-speed');
      const waitEl = pop.querySelector('.pop-wait');
      const statusEl = pop.querySelector('.pop-status');
      if (speedEl) speedEl.textContent = `${car.speed.toFixed(1)} px/s`;
      if (waitEl) waitEl.textContent = `${car.waitTime.toFixed(1)} s`;
      if (statusEl) statusEl.textContent = car.inQueue ? 'Waiting in Queue' : 'Cruising';
    } else {
      const statusEl = pop.querySelector('.pop-status');
      if (statusEl) statusEl.textContent = 'Completed / Exited';
      setTimeout(() => {
        if (!sim.vehicles.some((v) => v.id === this.renderer.selectedCarId)) {
          this.renderer.selectedCarId = null;
          this.hideInspector();
        }
      }, 1500);
    }
  }

  showInspector(car, simId, screenX, screenY) {
    const pop = document.getElementById('inspector-popover');
    if (!pop) return;

    pop.innerHTML = `
      <div class="pop-header">
        <span class="pop-title">Vehicle #${car.id}</span>
        <span class="pop-badge ${car.isEmergency ? 'badge-emergency' : ''}">${car.isEmergency ? '🚑 EMERGENCY' : car.route.toUpperCase()}</span>
      </div>
      <div class="pop-body">
        <div class="pop-row"><span>Simulation:</span> <b>${simId === 'simA' ? 'Sim A (Fixed)' : 'Sim B (Adaptive)'}</b></div>
        <div class="pop-row"><span>Approach:</span> <b>${car.originDir.toUpperCase()}</b></div>
        <div class="pop-row"><span>Speed:</span> <b class="pop-speed">${car.speed.toFixed(1)} px/s</b></div>
        <div class="pop-row"><span>Wait Time:</span> <b class="pop-wait">${car.waitTime.toFixed(1)} s</b></div>
        <div class="pop-row"><span>Status:</span> <b class="pop-status">${car.inQueue ? 'Waiting in Queue' : 'Cruising'}</b></div>
      </div>
    `;

    pop.style.display = 'block';
    const popW = 210;
    const popH = 140;
    const left = Math.min(window.innerWidth - popW - 20, Math.max(20, screenX - popW / 2));
    const top = Math.min(window.innerHeight - popH - 20, Math.max(20, screenY - popH - 15));
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }

  hideInspector() {
    const pop = document.getElementById('inspector-popover');
    if (pop) pop.style.display = 'none';
  }
}
