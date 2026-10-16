// Event-Driven Statistics Tracker
// Subscribes to discrete vehicle lifecycle events: spawn, queue-join, queue-leave, stop-line cross, exit
// Avoids polling; includes a clean reset() to prevent the "stats that never reset" trap

export class StatsTracker {
  constructor() {
    this.reset();
  }

  reset() {
    this.totalCarsPassed = 0;
    this.totalWaitTimeAll = 0;
    this.totalWaitCount = 0;

    // Per-direction statistics (north, south, east, west)
    this.byDirection = {
      north: { passed: 0, waitTimeSum: 0, waitCount: 0, currentQueue: 0, queuedCars: new Map() },
      south: { passed: 0, waitTimeSum: 0, waitCount: 0, currentQueue: 0, queuedCars: new Map() },
      east: { passed: 0, waitTimeSum: 0, waitCount: 0, currentQueue: 0, queuedCars: new Map() },
      west: { passed: 0, waitTimeSum: 0, waitCount: 0, currentQueue: 0, queuedCars: new Map() },
    };
  }

  // Lifecycle Event: Vehicle Spawned
  onVehicleSpawn(car) {
    // Car registered in simulation
  }

  // Lifecycle Event: Vehicle Joined Queue (speed dropped below threshold)
  onVehicleQueueJoin(car) {
    const dirStats = this.byDirection[car.originDir];
    if (dirStats && !dirStats.queuedCars.has(car.id)) {
      dirStats.queuedCars.set(car.id, car);
      dirStats.currentQueue = dirStats.queuedCars.size;
    }
  }

  // Lifecycle Event: Vehicle Left Queue (accelerating past threshold)
  onVehicleQueueLeave(car) {
    const dirStats = this.byDirection[car.originDir];
    if (dirStats && dirStats.queuedCars.has(car.id)) {
      dirStats.queuedCars.delete(car.id);
      dirStats.currentQueue = dirStats.queuedCars.size;
    }
  }

  // Lifecycle Event: Vehicle Crossed Stop Line
  onVehicleCrossStopLine(car) {
    const dirStats = this.byDirection[car.originDir];
    if (dirStats) {
      // Remove from queued set if still present
      dirStats.queuedCars.delete(car.id);
      dirStats.currentQueue = dirStats.queuedCars.size;

      // Record wait time if this vehicle waited
      if (car.totalWaitTime > 0) {
        dirStats.waitTimeSum += car.totalWaitTime;
        dirStats.waitCount++;
        this.totalWaitTimeAll += car.totalWaitTime;
        this.totalWaitCount++;
      }
    }
  }

  // Lifecycle Event: Vehicle Exited Junction
  onVehicleExit(car) {
    this.totalCarsPassed++;
    const dirStats = this.byDirection[car.originDir];
    if (dirStats) {
      dirStats.passed++;
    }
  }

  // Query helpers
  getQueueLength(dir) {
    return this.byDirection[dir]?.currentQueue || 0;
  }

  getAvgWait(dir) {
    const dirStats = this.byDirection[dir];
    if (!dirStats || dirStats.waitCount === 0) return 0;
    return dirStats.waitTimeSum / dirStats.waitCount;
  }

  getMaxWait(dir) {
    // Returns exact, real-time longest waiting time among cars currently in queue
    const dirStats = this.byDirection[dir];
    if (!dirStats || dirStats.queuedCars.size === 0) return 0;

    let maxWait = 0;
    for (const car of dirStats.queuedCars.values()) {
      if (car.totalWaitTime > maxWait) {
        maxWait = car.totalWaitTime;
      }
    }
    return maxWait;
  }

  getSnapshot() {
    const snapshot = {
      totalCarsPassed: this.totalCarsPassed,
      avgWaitTime: this.totalWaitCount > 0 ? (this.totalWaitTimeAll / this.totalWaitCount) : 0,
      totalQueueLength: 0,
      byDirection: {},
    };

    for (const dir of ['north', 'south', 'east', 'west']) {
      const stats = this.byDirection[dir];
      const avgWait = stats.waitCount > 0 ? stats.waitTimeSum / stats.waitCount : 0;
      snapshot.totalQueueLength += stats.currentQueue;
      snapshot.byDirection[dir] = {
        passed: stats.passed,
        avgWait: parseFloat(avgWait.toFixed(1)),
        queueLength: stats.currentQueue,
      };
    }

    snapshot.avgWaitTime = parseFloat(snapshot.avgWaitTime.toFixed(1));
    return snapshot;
  }
}
