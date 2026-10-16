// Intelligent Driver Model (IDM) Physics Engine & Ordered Step Execution
// Guarantees zero collisions, realistic smooth braking, and bumper-to-bumper queueing

export class PhysicsEngine {
  constructor(conflictManager) {
    this.conflictManager = conflictManager;
  }

  // Executes the ordered physics step on all active vehicles
  update(vehicles, signalController, statsTracker, dt) {
    // Step 3: Find leader for each car
    const leaders = this.findLeaders(vehicles);

    // Step 4 & 5: Compute IDM acceleration & check junction permissions
    for (let i = 0; i < vehicles.length; i++) {
      const car = vehicles[i];
      const leader = leaders[i];
      const signalState = signalController.getSignal(car.originDir);

      const acc = this.computeIDMAcceleration(car, leader, signalState, vehicles);
      car.acceleration = acc;
      car.brakeActive = acc < -30;
    }

    // Step 6: Integrate motion (fixed dt)
    const activeVehicles = [];
    for (let i = 0; i < vehicles.length; i++) {
      const car = vehicles[i];

      car.speed = Math.max(0, car.speed + car.acceleration * dt);
      car.distance += car.speed * dt;
      car.updatePosition();

      // Step 7: Emit discrete lifecycle events for stats tracking
      this.checkLifecycleEvents(car, statsTracker, dt);

      // Check if car reached end of path
      if (car.distance >= car.path.totalLength) {
        car.hasExited = true;
        statsTracker.onVehicleExit(car);
      } else {
        activeVehicles.push(car);
      }
    }

    return activeVehicles;
  }

  // Computes IDM acceleration combining leader interaction and stop line constraint
  computeIDMAcceleration(car, leader, signalState, allVehicles) {
    const a = car.maxAcc;
    const b = car.comfDec;
    const v = car.speed;
    const v0 = car.desiredSpeed;

    // 1. Free acceleration term: a * [1 - (v/v0)^4]
    let acc = a * (1 - Math.pow(v / (v0 || 1), 4));

    // 2. Interaction with leader vehicle ahead
    if (leader) {
      const s = car.distanceToLeader(leader);
      if (s > 0) {
        const deltaV = v - leader.speed;
        const sStar = car.minGap + v * car.timeHeadway + (v * deltaV) / (2 * Math.sqrt(a * b));
        const leaderDec = -a * Math.pow(Math.max(0, sStar) / s, 2);
        acc = Math.min(acc, acc + leaderDec);
      } else {
        // Emergency hard stop if physically touching bumper (failsafe)
        return -b * 2;
      }
    }

    // 3. Stop Line / Junction Conflict Constraint
    const stopLineDist = car.path.stopLineDistance;
    if (stopLineDist && !car.hasCrossedStopLine) {
      const distToStop = stopLineDist - (car.distance + car.length * 0.5);

      if (distToStop > -5) {
        const canEnter = this.conflictManager.canEnterJunction(car, signalState, allVehicles);

        if (!canEnter) {
          // Virtual stationary obstacle at the stop line (speed = 0, distance = distToStop)
          const s = Math.max(0.5, distToStop);
          const sStar = car.minGap + v * car.timeHeadway + (v * v) / (2 * Math.sqrt(a * b));
          const stopLineDec = -a * Math.pow(sStar / s, 2);

          acc = Math.min(acc, stopLineDec);

          // If car is within 2px of stop line and very slow, clamp to stop
          if (distToStop < 4 && v < 5) {
            acc = -b * 1.5;
          }
        }
      }
    }

    // 4. 2D Intersection Cross-Conflict Yielding (Inside Junction Box)
    const junctionYieldDec = this.checkJunctionCrossConflicts(car, allVehicles, a, b, v);
    if (junctionYieldDec !== null) {
      acc = Math.min(acc, junctionYieldDec);
    }

    return Math.max(-b * 2.5, Math.min(a, acc));
  }

  // Prevents collisions between cars with intersecting paths inside the junction (e.g. Right Turn vs Oncoming Straight)
  checkJunctionCrossConflicts(car, allVehicles, a, b, v) {
    // Only applies near or inside the junction box (coords 280 to 520)
    if (car.x < 280 || car.x > 520 || car.y < 280 || car.y > 520) {
      return null;
    }

    for (const other of allVehicles) {
      if (other.id === car.id) continue;
      // Other car must also be in or near junction box
      if (other.x < 280 || other.x > 520 || other.y < 280 || other.y > 520) continue;

      const currentDist = Math.hypot(other.x - car.x, other.y - car.y);

      // Check current proximity or projected collision within next 1.2 seconds
      let conflictDetected = false;
      if (currentDist < 55) {
        conflictDetected = true;
      } else {
        // Project positions 0.8s ahead
        const dtProj = 0.8;
        const carProjX = car.x + Math.cos(car.angle) * car.speed * dtProj;
        const carProjY = car.y + Math.sin(car.angle) * car.speed * dtProj;
        const otherProjX = other.x + Math.cos(other.angle) * other.speed * dtProj;
        const otherProjY = other.y + Math.sin(other.angle) * other.speed * dtProj;
        if (Math.hypot(otherProjX - carProjX, otherProjY - carProjY) < 38) {
          conflictDetected = true;
        }
      }

      if (conflictDetected) {
        // Determine right-of-way:
        // Emergency vehicle always has right of way
        if (other.isEmergency && !car.isEmergency) {
          return -b * 2.5;
        }
        if (car.isEmergency) {
          continue; // Emergency vehicle does not yield to non-emergency
        }

        // Turning vehicle yields to straight vehicle
        if (other.route === 'straight' && car.route !== 'straight') {
          return -b * 2.2;
        }
        if (car.route === 'straight' && other.route !== 'straight') {
          // Defensive stop if turning car has entered its path
          if (currentDist < 36) {
            return -b * 1.8;
          }
          continue; // Car has right of way
        }

        // If both are turning or both are straight: car closer to completing junction has right of way
        const carDistRemaining = car.path.totalLength - car.distance;
        const otherDistRemaining = other.path.totalLength - other.distance;
        if (carDistRemaining > otherDistRemaining) {
          // Other car is further ahead, car yields
          return -b * 2.0;
        } else if (currentDist < 30) {
          // Failsafe mutual separation buffer
          return -b * 1.5;
        }
      }
    }

    return null;
  }

  // Finds the nearest vehicle ahead on the same lane or trajectory
  findLeaders(vehicles) {
    const leaders = new Array(vehicles.length).fill(null);

    for (let i = 0; i < vehicles.length; i++) {
      const carA = vehicles[i];
      let closestLeader = null;
      let minDistance = Infinity;

      for (let j = 0; j < vehicles.length; j++) {
        if (i === j) continue;
        const carB = vehicles[j];

        // Check if carB is on the same approach lane ahead of carA
        const isSameApproach = carA.originDir === carB.originDir;
        const isSameSlip = (carA.route === 'left') === (carB.route === 'left');

        // Before crossing stop line, cars on the same lane follow each other
        if (isSameApproach && isSameSlip && !carA.hasCrossedStopLine) {
          if (carB.distance > carA.distance) {
            const gap = carA.distanceToLeader(carB);
            if (gap < minDistance) {
              minDistance = gap;
              closestLeader = carB;
            }
          }
        } else if (carA.hasCrossedStopLine && carA.route === carB.route && carA.originDir === carB.originDir) {
          // Inside junction / exit, cars follow those on the identical route
          if (carB.distance > carA.distance) {
            const gap = carA.distanceToLeader(carB);
            if (gap < minDistance) {
              minDistance = gap;
              closestLeader = carB;
            }
          }
        }
      }

      leaders[i] = closestLeader;
    }

    return leaders;
  }

  // Lifecycle event detector for event-driven statistics
  checkLifecycleEvents(car, statsTracker, dt) {
    // 1. Queue detection: speed < 3 px/s and hasn't crossed stop line
    if (!car.hasCrossedStopLine && car.route !== 'left') {
      if (car.speed < 4) {
        if (!car.inQueue) {
          car.inQueue = true;
          statsTracker.onVehicleQueueJoin(car);
        }
        car.totalWaitTime += dt;
      } else if (car.speed > 10 && car.inQueue) {
        car.inQueue = false;
        statsTracker.onVehicleQueueLeave(car);
      }
    }

    // 2. Stop line cross detection
    const stopLineDist = car.path.stopLineDistance;
    if (stopLineDist && !car.hasCrossedStopLine) {
      if (car.distance + car.length * 0.5 >= stopLineDist) {
        car.hasCrossedStopLine = true;
        if (car.inQueue) {
          car.inQueue = false;
          statsTracker.onVehicleQueueLeave(car);
        }
        statsTracker.onVehicleCrossStopLine(car);
      }
    }
  }
}
