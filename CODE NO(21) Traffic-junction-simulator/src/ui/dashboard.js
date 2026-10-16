// Dashboard & Comparative Analytics UI
// Throttled to ~2 Hz (every 500ms) for high performance

export class Dashboard {
  constructor() {
    this.historyA = [];
    this.historyB = [];
    this.maxHistory = 30; // 30 sample points (15 seconds at 2Hz)

    this.initElements();
  }

  initElements() {
    // Stat elements for Sim A (Fixed)
    this.passedA = document.getElementById('stat-passed-a');
    this.waitA = document.getElementById('stat-wait-a');
    this.queueA = document.getElementById('stat-queue-a');

    // Stat elements for Sim B (Adaptive)
    this.passedB = document.getElementById('stat-passed-b');
    this.waitB = document.getElementById('stat-wait-b');
    this.queueB = document.getElementById('stat-queue-b');

    // Direction breakdown tables / cards
    this.dirTableA = document.getElementById('dir-stats-a');
    this.dirTableB = document.getElementById('dir-stats-b');

    // Comparison badges
    this.diffWait = document.getElementById('diff-wait');
    this.diffQueue = document.getElementById('diff-queue');

    // Mini chart canvas
    this.chartCanvas = document.getElementById('chart-canvas');
    if (this.chartCanvas) {
      this.chartCtx = this.chartCanvas.getContext('2d');
    }
  }

  // Update throttled at ~2 Hz
  update(snapshots) {
    const statsA = snapshots.simA.stats;
    const statsB = snapshots.simB.stats;

    // 1. Update Sim A Cards
    if (this.passedA) this.passedA.textContent = statsA.totalCarsPassed;
    if (this.waitA) this.waitA.textContent = `${statsA.avgWaitTime}s`;
    if (this.queueA) this.queueA.textContent = statsA.totalQueueLength;

    // 2. Update Sim B Cards
    if (this.passedB) this.passedB.textContent = statsB.totalCarsPassed;
    if (this.waitB) this.waitB.textContent = `${statsB.avgWaitTime}s`;
    if (this.queueB) this.queueB.textContent = statsB.totalQueueLength;

    // 3. Direction breakdown
    this.renderDirectionStats(this.dirTableA, statsA.byDirection);
    this.renderDirectionStats(this.dirTableB, statsB.byDirection);

    // 4. Comparison Differential Calculation
    if (this.diffWait) {
      const waitDiff = statsA.avgWaitTime - statsB.avgWaitTime;
      const pct = statsA.avgWaitTime > 0 ? ((waitDiff / statsA.avgWaitTime) * 100).toFixed(0) : 0;
      if (waitDiff > 0) {
        this.diffWait.textContent = `-${waitDiff.toFixed(1)}s (-${pct}% wait)`;
        this.diffWait.className = 'diff-badge positive';
      } else if (waitDiff < 0) {
        this.diffWait.textContent = `+${Math.abs(waitDiff).toFixed(1)}s`;
        this.diffWait.className = 'diff-badge negative';
      } else {
        this.diffWait.textContent = `0.0s (Parity)`;
        this.diffWait.className = 'diff-badge neutral';
      }
    }

    if (this.diffQueue) {
      const qDiff = statsA.totalQueueLength - statsB.totalQueueLength;
      if (qDiff > 0) {
        this.diffQueue.textContent = `-${qDiff} cars queue`;
        this.diffQueue.className = 'diff-badge positive';
      } else if (qDiff < 0) {
        this.diffQueue.textContent = `+${Math.abs(qDiff)} cars queue`;
        this.diffQueue.className = 'diff-badge negative';
      } else {
        this.diffQueue.textContent = `0 cars (Parity)`;
        this.diffQueue.className = 'diff-badge neutral';
      }
    }

    // 5. Push history for live chart
    this.historyA.push({ wait: statsA.avgWaitTime, queue: statsA.totalQueueLength });
    this.historyB.push({ wait: statsB.avgWaitTime, queue: statsB.totalQueueLength });
    if (this.historyA.length > this.maxHistory) {
      this.historyA.shift();
      this.historyB.shift();
    }

    this.drawChart();
  }

  // Renders the 4-direction stats grid (North, South, East, West)
  renderDirectionStats(container, byDir) {
    if (!container) return;
    const dirs = ['north', 'south', 'east', 'west'];
    let html = '';

    for (const dir of dirs) {
      const d = byDir[dir] || { passed: 0, avgWait: 0, queueLength: 0 };
      const label = dir.charAt(0).toUpperCase() + dir.slice(1);
      html += `
        <div class="dir-cell">
          <div class="dir-name">${label}</div>
          <div class="dir-vals">
            <span>Pass: <b>${d.passed}</b></span>
            <span>Wait: <b>${d.avgWait}s</b></span>
            <span>Queue: <b class="${d.queueLength > 3 ? 'text-amber' : ''}">${d.queueLength}</b></span>
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
  }

  // Live SVG/Canvas Performance Comparison Chart
  drawChart() {
    if (!this.chartCtx || !this.chartCanvas) return;
    const ctx = this.chartCtx;
    const w = this.chartCanvas.width;
    const h = this.chartCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(w, h * 0.5);
    ctx.stroke();

    if (this.historyA.length < 2) return;

    // Find max value
    let maxVal = 10;
    for (let i = 0; i < this.historyA.length; i++) {
      maxVal = Math.max(maxVal, this.historyA[i].wait, this.historyB[i].wait);
    }
    maxVal *= 1.2;

    const stepX = w / (this.maxHistory - 1);

    // Draw Line A (Fixed Timing - Sky Blue)
    this.drawSeries(ctx, this.historyA, 'wait', maxVal, stepX, h, '#7ec8e3');

    // Draw Line B (Adaptive AI - Leaf Green)
    this.drawSeries(ctx, this.historyB, 'wait', maxVal, stepX, h, '#66bb6a');
  }

  drawSeries(ctx, data, field, maxVal, stepX, height, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < data.length; i++) {
      const x = i * stepX;
      const y = height - (data[i][field] / maxVal) * (height - 10) - 5;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  reset() {
    this.historyA = [];
    this.historyB = [];
    if (this.chartCtx && this.chartCanvas) {
      this.chartCtx.clearRect(0, 0, this.chartCanvas.width, this.chartCanvas.height);
    }
  }
}
