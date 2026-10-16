// Parametric Trajectory Path with Arc-Length Parameterization
// Allows exact 1D distance along path coordinates for collision-free IDM physics

export class TrajectoryPath {
  constructor(waypoints) {
    this.waypoints = waypoints;
    this.segments = [];
    this.totalLength = 0;
    this.stopLineDistance = null;
    this.exitLineDistance = null;

    this.computeSegments();
  }

  computeSegments() {
    this.segments = [];
    this.totalLength = 0;

    for (let i = 0; i < this.waypoints.length - 1; i++) {
      const p1 = this.waypoints[i];
      const p2 = this.waypoints[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const length = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);

      this.segments.push({
        p1,
        p2,
        dx,
        dy,
        length,
        angle,
        startDist: this.totalLength,
        endDist: this.totalLength + length,
      });

      this.totalLength += length;
    }
  }

  // Returns { x, y, angle } at distance d along trajectory
  getPointAt(distance) {
    if (this.segments.length === 0) return { x: 0, y: 0, angle: 0 };

    const clampedDist = Math.max(0, Math.min(distance, this.totalLength));

    // Find segment containing clampedDist
    for (const seg of this.segments) {
      if (clampedDist >= seg.startDist && clampedDist <= seg.endDist) {
        const segProgress = (clampedDist - seg.startDist) / (seg.length || 1);
        const x = seg.p1.x + seg.dx * segProgress;
        const y = seg.p1.y + seg.dy * segProgress;
        return { x, y, angle: seg.angle };
      }
    }

    const lastSeg = this.segments[this.segments.length - 1];
    return { x: lastSeg.p2.x, y: lastSeg.p2.y, angle: lastSeg.angle };
  }
}
