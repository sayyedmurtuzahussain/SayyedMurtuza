// Junction Conflict Manager
// Enforces 4 critical intersection safety rules:
// 1. "Don't block the box": Car enters only if destination exit lane has capacity
// 2. Amber point-of-no-return: Decides whether car can stop comfortably or must proceed
// 3. Free left-turn yield/merge: Yields to outgoing traffic at the slip lane merge point
// 4. Right-turn yielding: Yields to oncoming straight traffic across the intersection

export class JunctionConflictManager {
  constructor(junctionConfig) {
    this.config = junctionConfig;
  }

  // Determines whether a vehicle is permitted to enter the junction box
  canEnterJunction(car, signalState, allVehicles) {
    // Emergency vehicles with active green have absolute priority
    if (car.isEmergency) return true;

    // Free left-turn slip lane does not obey the main junction traffic signal
    if (car.route === 'left') {
      return this.checkFreeTurnMergeSafety(car, allVehicles);
    }

    const distToStop = car.path.stopLineDistance - (car.distance + car.length * 0.5);

    // If car has already crossed the stop line, it is committed to clear the box
    if (distToStop <= 0 || car.isCommittedToJunction) {
      car.isCommittedToJunction = true;
      return true;
    }

    // 1. Check Signal State (Green, Amber, Red)
    if (signalState === 'red') {
      return false;
    }

    if (signalState === 'amber') {
      // 2. Amber Point-of-No-Return Rule
      const stoppingDistance = (car.speed * car.speed) / (2 * car.comfDec);
      if (distToStop > stoppingDistance) {
        // Safe to stop smoothly before the stop line
        return false;
      }
      // Beyond point-of-no-return: must clear junction
      car.isCommittedToJunction = true;
      return true;
    }

    // Signal is GREEN. Now check Rule 1: "Don't block the box"
    if (!this.hasExitCapacity(car, allVehicles)) {
      return false; // Stop at line even on Green if exit is blocked!
    }

    // Check Rule 4: Right-turn yielding to oncoming straight vehicles (LHD)
    if (car.route === 'right') {
      if (!this.isRightTurnClear(car, allVehicles)) {
        return false;
      }
    }

    car.isCommittedToJunction = true;
    return true;
  }

  // "Don't block the box" (Exit Lane Capacity Check)
  // Verifies that the exit lane has space to receive this vehicle without backing into the box
  hasExitCapacity(car, allVehicles) {
    const exitLineDist = car.path.exitLineDistance;
    if (!exitLineDist) return true;

    // Check all vehicles ahead on this path or destination lane
    for (const other of allVehicles) {
      if (other.id === car.id) continue;
      // If other vehicle is just past the exit line and moving very slowly or stopped
      if (other.distance > exitLineDist && other.distance < exitLineDist + 80) {
        if (other.speed < 10) {
          // Exit is backed up close to the junction threshold!
          return false;
        }
      }
    }
    return true;
  }

  // Free Left Turn Slip Lane merge check
  checkFreeTurnMergeSafety(car, allVehicles) {
    const mergeDist = car.path.totalLength - 90;
    const distToMerge = mergeDist - car.distance;

    // Only check when close to the merge point
    if (distToMerge > 0 && distToMerge < 60) {
      // Look for any vehicles near the merge zone on the destination road
      for (const other of allVehicles) {
        if (other.id === car.id) continue;
        const dx = other.x - car.x;
        const dy = other.y - car.y;
        const dist = Math.hypot(dx, dy);

        // If another car is approaching the merge zone with priority
        if (dist < 40 && other.route !== 'left') {
          // Yield to oncoming main road vehicle
          return false;
        }
      }
    }
    return true;
  }

  // Right-Turn Yield Check: In LHD, right turns cross oncoming straight traffic
  isRightTurnClear(car, allVehicles) {
    const oncomingMap = {
      north: 'south',
      south: 'north',
      east: 'west',
      west: 'east',
    };
    const oncomingDir = oncomingMap[car.originDir];

    for (const other of allVehicles) {
      if (other.originDir === oncomingDir && other.route === 'straight' && !other.hasExited) {
        // Safe gap check: if oncoming straight car is within 250px of stop line or inside junction box
        const oncomingDistToStop = other.path.stopLineDistance - (other.distance + other.length * 0.5);
        if (oncomingDistToStop > -180 && oncomingDistToStop < 240) {
          return false; // Wait safely at stop line until oncoming straight traffic clears
        }
      }
    }
    return true;
  }
}
