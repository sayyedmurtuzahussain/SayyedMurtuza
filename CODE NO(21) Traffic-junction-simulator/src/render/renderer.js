// High-Performance Canvas 2D Renderer
// Supports HiDPI (Retina), Side-by-Side dual view, accessible B&W shape signals, and vehicle effects

import { JUNCTION_CONFIG } from '../sim/junction.js';

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;

    this.selectedCarId = null;
    this.selectedSimId = null;
    this.hoverCar = null;

    // Viewport transform metrics
    this.viewports = [];
  }

  // Resizes canvas buffer to match display dimensions with HiDPI scaling
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;

    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  // Main render pass reading only immutable snapshot data
  render(snapshots, viewMode) {
    if (!this.width || !this.height) this.resize();

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    this.viewports = [];

    // Decide single vs side-by-side layout based on viewMode and screen aspect ratio
    const isDual = viewMode === 'sideBySide' && this.width >= 720;

    if (isDual) {
      // Split horizontally: Left = Sim A (Fixed), Right = Sim B (Adaptive)
      const halfWidth = this.width / 2;
      const height = this.height;

      // Viewport A
      this.renderSimulationViewport(snapshots.simA, 0, 0, halfWidth, height, 'SIM A: FIXED TIMING', '#7ec8e3');
      this.viewports.push({ simId: 'simA', x: 0, y: 0, w: halfWidth, h: height });

      // Viewport B
      this.renderSimulationViewport(snapshots.simB, halfWidth, 0, halfWidth, height, 'SIM B: ADAPTIVE AI', '#66bb6a');
      this.viewports.push({ simId: 'simB', x: halfWidth, y: 0, w: halfWidth, h: height });

      // Divider line
      ctx.strokeStyle = 'rgba(100, 130, 70, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(halfWidth, 0);
      ctx.lineTo(halfWidth, height);
      ctx.stroke();
    } else {
      // Single Viewport: active sim determined by viewMode
      const activeSim = viewMode === 'simB' ? snapshots.simB : snapshots.simA;
      const title = activeSim.mode === 'fixed' ? 'SIMULATION: FIXED CYCLE' : 'SIMULATION: ADAPTIVE AI';
      const color = activeSim.mode === 'fixed' ? '#7ec8e3' : '#66bb6a';

      this.renderSimulationViewport(activeSim, 0, 0, this.width, this.height, title, color);
      this.viewports.push({ simId: activeSim.id, x: 0, y: 0, w: this.width, h: this.height });
    }
  }

  // Renders one junction instance scaled inside the given bounding box [vx, vy, vw, vh]
  renderSimulationViewport(snapshot, vx, vy, vw, vh, title, accentColor) {
    const ctx = this.ctx;
    ctx.save();

    // Clip to viewport rectangle
    ctx.beginPath();
    ctx.rect(vx, vy, vw, vh);
    ctx.clip();

    // Calculate scale and offset to fit 800x800 logical junction in viewport
    const scale = Math.min(vw / 800, vh / 800) * 0.96;
    const ox = vx + (vw - 800 * scale) / 2;
    const oy = vy + (vh - 800 * scale) / 2;

    ctx.translate(ox, oy);
    ctx.scale(scale, scale);

    // 1. Draw Junction Roadway & Markings
    this.drawRoadway(ctx);

    // 2. Draw Accessible Traffic Signals with B&W Shapes
    this.drawSignals(ctx, snapshot.signals);

    // 3. Draw Vehicles with lights, brake indicators & beacons
    this.drawVehicles(ctx, snapshot.vehicles, snapshot.id);

    ctx.restore();

    // 4. Viewport Header Badge
    this.drawViewportHeader(ctx, vx, vy, vw, title, accentColor, snapshot);
  }

  // Roadway and LHD road markings
  drawRoadway(ctx) {
    const W = JUNCTION_CONFIG.roadHalfWidth; // 80px (half-width)
    const C = 400; // Center coordinate

    // Background terrain — dark earth
    ctx.fillStyle = '#1a2614';
    ctx.fillRect(0, 0, 800, 800);

    // Corner grass verges / sidewalks — mossy green with grass texture
    ctx.fillStyle = '#264d2a';
    ctx.fillRect(0, 0, C - W, C - W);
    ctx.fillRect(C + W, 0, 800 - (C + W), C - W);
    ctx.fillRect(0, C + W, C - W, 800 - (C + W));
    ctx.fillRect(C + W, C + W, 800 - (C + W), 800 - (C + W));

    // Subtle grass texture dots
    ctx.fillStyle = 'rgba(76, 175, 80, 0.12)';
    const quadrants = [
      [0, 0, C - W, C - W],
      [C + W, 0, 800 - (C + W), C - W],
      [0, C + W, C - W, 800 - (C + W)],
      [C + W, C + W, 800 - (C + W), 800 - (C + W)]
    ];
    for (const [qx, qy, qw, qh] of quadrants) {
      for (let i = 0; i < 40; i++) {
        const gx = qx + Math.random() * qw;
        const gy = qy + Math.random() * qh;
        ctx.beginPath();
        ctx.arc(gx, gy, 1.5 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Road asphalt — realistic warm gray
    ctx.fillStyle = '#3b3f3a';
    // North-South road
    ctx.fillRect(C - W, 0, W * 2, 800);
    // East-West road
    ctx.fillRect(0, C - W, 800, W * 2);

    // Curbs & Outer Boundary Lines
    ctx.strokeStyle = '#6b705c';
    ctx.lineWidth = 3;

    // Corner slip-lane curbs (free left turns)
    this.drawSlipCurb(ctx, 480, 0, 800, 320, 'ne');
    this.drawSlipCurb(ctx, 0, 480, 320, 800, 'sw');
    this.drawSlipCurb(ctx, 480, 800, 800, 480, 'se');
    this.drawSlipCurb(ctx, 0, 320, 320, 0, 'nw');

    // Center divider (Double Yellow Line)
    ctx.strokeStyle = '#c9a836';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);

    // North Center line (ends before junction box)
    ctx.beginPath();
    ctx.moveTo(C, 0);
    ctx.lineTo(C, 315);
    ctx.moveTo(C, 485);
    ctx.lineTo(C, 800);
    // East-West Center line
    ctx.moveTo(0, C);
    ctx.lineTo(315, C);
    ctx.moveTo(485, C);
    ctx.lineTo(800, C);
    ctx.stroke();

    // Lane dividers (Broken White Lines)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([12, 12]);

    // North: Lane 0 / Lane 1 divider (x = 440)
    ctx.beginPath();
    ctx.moveTo(440, 0);
    ctx.lineTo(440, 315);
    ctx.moveTo(360, 485);
    ctx.lineTo(360, 800);
    // East-West lane dividers
    ctx.moveTo(0, 360);
    ctx.lineTo(315, 360);
    ctx.moveTo(485, 440);
    ctx.lineTo(800, 440);
    ctx.stroke();

    ctx.setLineDash([]);

    // Stop Lines (Thick Solid White Bars for LHD incoming straight/right lanes)
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 5;
    ctx.lineCap = 'butt';

    // North Stop Line (x: 400 -> 440, y: 315)
    ctx.beginPath();
    ctx.moveTo(400, 315);
    ctx.lineTo(440, 315);
    ctx.stroke();

    // South Stop Line (x: 360 -> 400, y: 485)
    ctx.beginPath();
    ctx.moveTo(360, 485);
    ctx.lineTo(400, 485);
    ctx.stroke();

    // East Stop Line (x: 485, y: 400 -> 440)
    ctx.beginPath();
    ctx.moveTo(485, 400);
    ctx.lineTo(485, 440);
    ctx.stroke();

    // West Stop Line (x: 315, y: 360 -> 400)
    ctx.beginPath();
    ctx.moveTo(315, 360);
    ctx.lineTo(315, 400);
    ctx.stroke();

    // Junction Conflict Box border (Animated hazard dashed boundary)
    const time = performance.now() * 0.003;
    ctx.strokeStyle = 'rgba(201, 168, 54, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -time * 20;
    ctx.strokeRect(315, 315, 170, 170);
    ctx.setLineDash([]);

    // Urban Pedestrian Crosswalks (Crisp zebra markings across all 4 approaches)
    this.drawPedestrianCrosswalks(ctx);

    // Roadway Direction Arrows with subtle flow animation
    this.drawRoadPavementArrows(ctx, time);
  }

  // Draw zebra crosswalks near stop lines
  drawPedestrianCrosswalks(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    const W = JUNCTION_CONFIG.roadHalfWidth;

    // North crosswalk (y: 295 to 308)
    for (let x = 400 - W + 6; x < 400 + W - 6; x += 12) {
      ctx.fillRect(x, 296, 6, 12);
    }
    // South crosswalk (y: 492 to 504)
    for (let x = 400 - W + 6; x < 400 + W - 6; x += 12) {
      ctx.fillRect(x, 492, 6, 12);
    }
    // East crosswalk (x: 492 to 504)
    for (let y = 400 - W + 6; y < 400 + W - 6; y += 12) {
      ctx.fillRect(492, y, 12, 6);
    }
    // West crosswalk (x: 296 to 308)
    for (let y = 400 - W + 6; y < 400 + W - 6; y += 12) {
      ctx.fillRect(296, y, 12, 6);
    }
    ctx.restore();
  }

  // Corner slip lane curb curves
  drawSlipCurb(ctx, x1, y1, x2, y2, corner) {
    ctx.save();
    ctx.strokeStyle = '#6b705c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (corner === 'ne') {
      ctx.moveTo(480, 0);
      ctx.quadraticCurveTo(480, 320, 800, 320);
    } else if (corner === 'sw') {
      ctx.moveTo(0, 480);
      ctx.quadraticCurveTo(320, 480, 320, 800);
    } else if (corner === 'se') {
      ctx.moveTo(800, 480);
      ctx.quadraticCurveTo(480, 480, 480, 800);
    } else if (corner === 'nw') {
      ctx.moveTo(0, 320);
      ctx.quadraticCurveTo(320, 320, 320, 0);
    }
    ctx.stroke();

    // Corner island warning chevrons
    ctx.strokeStyle = 'rgba(139, 119, 42, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  // Directional arrows painted on asphalt with subtle animated pulse
  drawRoadPavementArrows(ctx, time) {
    ctx.save();
    const pulseAlpha = 0.28 + Math.sin(time * 3) * 0.08;
    ctx.fillStyle = `rgba(255, 255, 255, ${pulseAlpha})`;

    // North Approach
    this.drawArrow(ctx, 420, 260, 0, 1);
    this.drawArrow(ctx, 458, 240, 0.5, 0.8);

    // South Approach
    this.drawArrow(ctx, 380, 540, 0, -1);
    this.drawArrow(ctx, 342, 560, -0.5, -0.8);

    // East Approach
    this.drawArrow(ctx, 540, 420, -1, 0);
    this.drawArrow(ctx, 560, 458, -0.8, 0.5);

    // West Approach
    this.drawArrow(ctx, 260, 380, 1, 0);
    this.drawArrow(ctx, 240, 342, 0.8, -0.5);

    ctx.restore();
  }

  drawArrow(ctx, x, y, dx, dy) {
    const angle = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-6, -6);
    ctx.lineTo(-4, -2);
    ctx.lineTo(-12, -2);
    ctx.lineTo(-12, 2);
    ctx.lineTo(-4, 2);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 2. Draw Accessible Traffic Signals with Animated Glow & B&W Shapes
  drawSignals(ctx, signals) {
    this.drawAccessibleSignalHead(ctx, 448, 305, signals.north, 'N');
    this.drawAccessibleSignalHead(ctx, 352, 495, signals.south, 'S');
    this.drawAccessibleSignalHead(ctx, 495, 448, signals.east, 'E');
    this.drawAccessibleSignalHead(ctx, 305, 352, signals.west, 'W');
  }

  drawAccessibleSignalHead(ctx, x, y, state, label) {
    ctx.save();
    ctx.translate(x, y);

    const time = performance.now() * 0.005;

    // Signal backing box
    ctx.fillStyle = '#1a1e18';
    ctx.strokeStyle = '#6b705c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-22, -22, 44, 44, 7);
    ctx.fill();
    ctx.stroke();

    // Signal state styling
    let color, shape, text;
    if (state === 'green') {
      color = '#22c55e';
      shape = 'circle';
      text = 'GO';
    } else if (state === 'amber') {
      color = '#f59e0b';
      shape = 'triangle';
      text = 'WAIT';
    } else {
      color = '#ef4444';
      shape = 'square';
      text = 'STOP';
    }

    // Dynamic Pulsing Halo Ring
    if (state === 'green' || state === 'amber') {
      const pulseRadius = 12 + Math.sin(time * 5) * 3;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.45 + Math.sin(time * 5) * 0.25;
      ctx.beginPath();
      ctx.arc(0, -3, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Glowing halo
    ctx.shadowColor = color;
    ctx.shadowBlur = state === 'amber' ? 14 : 10;
    ctx.fillStyle = color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;

    // Draw Shape
    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(0, -3, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (shape === 'triangle') {
      ctx.beginPath();
      ctx.moveTo(0, -15);
      ctx.lineTo(13, 7);
      ctx.lineTo(-13, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (shape === 'square') {
      ctx.beginPath();
      ctx.rect(-10, -13, 20, 20);
      ctx.fill();
      ctx.stroke();
    }

    ctx.shadowBlur = 0;

    // B&W Readable Contrast Label inside/below shape
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8.5px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 14);

    ctx.restore();
  }

  // 3. Draw Vehicles with headlights, brake blooms, turn signals, and siren sweeps
  drawVehicles(ctx, vehicles, simId) {
    const time = performance.now() * 0.005;

    for (const car of vehicles) {
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);

      const halfL = car.length / 2;
      const halfW = car.width / 2;

      // Animated Targeting Reticle for Selected Vehicle
      if (this.selectedCarId === car.id && this.selectedSimId === simId) {
        ctx.save();
        ctx.strokeStyle = '#81c784';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -time * 25;
        ctx.beginPath();
        ctx.arc(0, 0, car.length * 0.95, 0, Math.PI * 2);
        ctx.stroke();

        // Crosshairs
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(129, 199, 132, 0.7)';
        ctx.beginPath();
        ctx.moveTo(-car.length * 1.1, 0);
        ctx.lineTo(-car.length * 0.8, 0);
        ctx.moveTo(car.length * 0.8, 0);
        ctx.lineTo(car.length * 1.1, 0);
        ctx.stroke();
        ctx.restore();
      }

      // Smooth Headlight Beams (Warm white gradient cone projecting on road)
      const lightGrad = ctx.createRadialGradient(halfL, 0, 4, halfL + 45, 0, 35);
      lightGrad.addColorStop(0, 'rgba(254, 240, 138, 0.22)');
      lightGrad.addColorStop(1, 'rgba(254, 240, 138, 0.0)');
      ctx.fillStyle = lightGrad;
      ctx.beginPath();
      ctx.moveTo(halfL, -halfW * 0.7);
      ctx.lineTo(halfL + 45, -halfW * 2.2);
      ctx.lineTo(halfL + 45, halfW * 2.2);
      ctx.lineTo(halfL, halfW * 0.7);
      ctx.closePath();
      ctx.fill();

      // Car shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      ctx.roundRect(-halfL - 1, -halfW + 1, car.length + 2, car.width + 2, 4);
      ctx.fill();

      // Main car body with subtle gradient
      const bodyGrad = ctx.createLinearGradient(-halfL, 0, halfL, 0);
      bodyGrad.addColorStop(0, car.color);
      bodyGrad.addColorStop(1, this.adjustBrightness(car.color, 25));
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.roundRect(-halfL, -halfW, car.length, car.width, 4);
      ctx.fill();

      // Body border highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Windshield & roof
      ctx.fillStyle = '#1a2218';
      ctx.fillRect(halfL * 0.15, -halfW * 0.75, car.length * 0.22, car.width * 1.5);
      ctx.fillRect(-halfL * 0.6, -halfW * 0.75, car.length * 0.18, car.width * 1.5);

      // Roof panel
      ctx.fillStyle = car.color;
      ctx.fillRect(-halfL * 0.35, -halfW * 0.6, car.length * 0.45, car.width * 1.2);

      // Brake lights (Dynamic Radial Red Bloom when decelerating or stopped)
      if (car.brakeActive || car.speed < 4) {
        ctx.save();
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 10;
        ctx.fillRect(-halfL - 1, -halfW * 0.8, 2.5, 4);
        ctx.fillRect(-halfL - 1, halfW * 0.8 - 4, 2.5, 4);

        // Ground reflection
        const brakeBloom = ctx.createRadialGradient(-halfL - 4, 0, 1, -halfL - 6, 0, 14);
        brakeBloom.addColorStop(0, 'rgba(239, 68, 68, 0.35)');
        brakeBloom.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = brakeBloom;
        ctx.beginPath();
        ctx.arc(-halfL - 6, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Turn indicators (Pulsing amber blinker)
      if (car.turnSignal !== 'none' && Math.floor(time * 4) % 2 === 0) {
        ctx.save();
        ctx.fillStyle = '#f59e0b';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 8;
        const yOffset = car.turnSignal === 'left' ? -halfW : halfW - 3;
        ctx.fillRect(halfL - 3, yOffset, 3, 3);
        ctx.fillRect(-halfL, yOffset, 3, 3);
        ctx.restore();
      }

      // Emergency Vehicle Livery & Dynamic Siren Beacon Aura
      if (car.isEmergency) {
        ctx.save();
        // White cross on red roof
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-3, -halfW + 1, 6, car.width - 2);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-1.5, -halfW + 3, 3, car.width - 6);

        // Dynamic 360-degree siren light splash on pavement
        const strobe = Math.floor(time * 7) % 2 === 0;
        const sirenColor = strobe ? 'rgba(59, 130, 246, 0.3)' : 'rgba(239, 68, 68, 0.3)';
        const sirenGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, 35);
        sirenGrad.addColorStop(0, sirenColor);
        sirenGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sirenGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 35, 0, Math.PI * 2);
        ctx.fill();

        // Strobe roof lights
        ctx.shadowBlur = 14;
        ctx.fillStyle = strobe ? '#3b82f6' : '#ef4444';
        ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath();
        ctx.arc(-2, -3, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = strobe ? '#ef4444' : '#3b82f6';
        ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath();
        ctx.arc(-2, 3, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      ctx.restore();
    }
  }

  // Adjusts color brightness for 3D body gradient
  adjustBrightness(hex, percent) {
    if (!hex.startsWith('#')) return hex;
    const num = parseInt(hex.slice(1), 16);
    let r = (num >> 16) + percent;
    let g = ((num >> 8) & 0x00ff) + percent;
    let b = (num & 0x0000ff) + percent;
    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  // 4. Viewport Header Badge with title, signal phase, and mini stats
  drawViewportHeader(ctx, vx, vy, vw, title, accentColor, snapshot) {
    ctx.save();

    // Top banner backdrop
    ctx.fillStyle = 'rgba(22, 34, 18, 0.88)';
    ctx.fillRect(vx, vy, vw, 36);

    // Accent line
    ctx.fillStyle = accentColor;
    ctx.fillRect(vx, vy + 34, vw, 2);

    // Title
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = '#f0ede5';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, vx + 16, vy + 18);

    // Active Phase Pill
    const phaseText = snapshot.emergencyState !== 'NONE' ? `🚨 CORRIDOR` : snapshot.phase.replace('_', ' ');
    ctx.font = '500 11px system-ui, sans-serif';
    ctx.fillStyle = accentColor;
    ctx.textAlign = 'right';
    ctx.fillText(phaseText, vx + vw - 16, vy + 18);

    ctx.restore();
  }

  // Hit-test to select vehicle on mouse/touch click
  hitTestVehicle(clickX, clickY, snapshots) {
    for (const vp of this.viewports) {
      if (clickX >= vp.x && clickX <= vp.x + vp.w && clickY >= vp.y && clickY <= vp.y + vp.h) {
        const scale = Math.min(vp.w / 800, vp.h / 800) * 0.96;
        const ox = vp.x + (vp.w - 800 * scale) / 2;
        const oy = vp.y + (vp.h - 800 * scale) / 2;

        const simX = (clickX - ox) / scale;
        const simY = (clickY - oy) / scale;

        const sim = vp.simId === 'simA' ? snapshots.simA : snapshots.simB;
        for (const car of sim.vehicles) {
          const dist = Math.hypot(car.x - simX, car.y - simY);
          if (dist <= 25) {
            return { car, simId: vp.simId };
          }
        }
      }
    }
    return null;
  }
}
