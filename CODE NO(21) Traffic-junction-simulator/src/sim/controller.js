// Traffic Signal Controller
// Supports:
// 1. Fixed Cycle Timing (predictable phase rotation)
// 2. Adaptive AI Mode (queue-sensor actuated with Tmin/Tmax and anti-starvation)
// 3. Emergency Corridor Preemption State Machine (safe amber -> all-red -> green corridor)

export class SignalController {
  constructor(mode = 'fixed') {
    this.mode = mode; // 'fixed' or 'adaptive'

    // Timing parameters (seconds)
    this.fixedGreenDuration = 14.0;
    this.amberDuration = 3.0;
    this.allRedDuration = 2.0;

    this.minGreenDuration = 5.0; // Tmin
    this.maxGreenDuration = 22.0; // Tmax

    // Phase management:
    // 'NS_GREEN', 'NS_AMBER', 'ALL_RED_TO_EW', 'EW_GREEN', 'EW_AMBER', 'ALL_RED_TO_NS'
    this.currentPhase = 'NS_GREEN';
    this.phaseTimer = 0;

    // Emergency Preemption FSM
    // 'NONE', 'PREEMPT_AMBER', 'PREEMPT_ALL_RED', 'CORRIDOR', 'EXIT_ALL_RED'
    this.emergencyState = 'NONE';
    this.emergencyTimer = 0;
    this.emergencyDir = null;
    this.emergencyCarId = null;

    // Current signal per direction
    this.signals = {
      north: 'green',
      south: 'green',
      east: 'red',
      west: 'red',
    };
  }

  // Update controller state on tick
  update(statsTracker, dt, vehicles) {
    this.phaseTimer += dt;

    // If an emergency preemption is active, handle emergency FSM
    if (this.emergencyState !== 'NONE') {
      this.updateEmergencyFSM(dt, vehicles);
      return;
    }

    if (this.mode === 'fixed') {
      this.updateFixedCycle();
    } else {
      this.updateAdaptiveCycle(statsTracker, vehicles);
    }
  }

  // Standard Fixed Cycle
  updateFixedCycle() {
    switch (this.currentPhase) {
      case 'NS_GREEN':
        if (this.phaseTimer >= this.fixedGreenDuration) {
          this.setPhase('NS_AMBER');
        }
        break;

      case 'NS_AMBER':
        if (this.phaseTimer >= this.amberDuration) {
          this.setPhase('ALL_RED_TO_EW');
        }
        break;

      case 'ALL_RED_TO_EW':
        if (this.phaseTimer >= this.allRedDuration) {
          this.setPhase('EW_GREEN');
        }
        break;

      case 'EW_GREEN':
        if (this.phaseTimer >= this.fixedGreenDuration) {
          this.setPhase('EW_AMBER');
        }
        break;

      case 'EW_AMBER':
        if (this.phaseTimer >= this.amberDuration) {
          this.setPhase('ALL_RED_TO_NS');
        }
        break;

      case 'ALL_RED_TO_NS':
        if (this.phaseTimer >= this.allRedDuration) {
          this.setPhase('NS_GREEN');
        }
        break;
    }
  }

  // Queue-Actuated Adaptive Cycle with Platoon Extension, Gap-Out, and Anti-Starvation
  updateAdaptiveCycle(statsTracker, vehicles = []) {
    // 1. Detect demand on each axis:
    // Queued vehicles (stopped) + Approaching vehicles (moving towards red light within 220px)
    const demandNS = this.detectAxisDemand(['north', 'south'], vehicles, statsTracker);
    const demandEW = this.detectAxisDemand(['east', 'west'], vehicles, statsTracker);

    const maxWaitNS = Math.max(statsTracker.getMaxWait('north'), statsTracker.getMaxWait('south'));
    const maxWaitEW = Math.max(statsTracker.getMaxWait('east'), statsTracker.getMaxWait('west'));

    // Check if active axis is actively discharging traffic through the stop line (within 160px)
    const nsDischarging = this.isAxisDischarging(['north', 'south'], vehicles);
    const ewDischarging = this.isAxisDischarging(['east', 'west'], vehicles);

    switch (this.currentPhase) {
      case 'NS_GREEN':
        // Conditions to transition NS -> Amber:
        // A. Anti-starvation: EW cars have waited >= 15 seconds
        const ewStarving = this.phaseTimer >= this.minGreenDuration && maxWaitEW >= 15.0;
        // B. Max green cap reached while EW has demand
        const nsMaxCap = this.phaseTimer >= this.maxGreenDuration && demandEW.totalCount > 0;
        // C. Gap-out: min green passed, no discharging platoon on NS, and EW has waiting cars
        const nsGappedOut = this.phaseTimer >= this.minGreenDuration && !nsDischarging && demandEW.totalCount > 0;

        if (ewStarving || nsMaxCap || nsGappedOut) {
          this.setPhase('NS_AMBER');
        }
        break;

      case 'NS_AMBER':
        if (this.phaseTimer >= this.amberDuration) {
          this.setPhase('ALL_RED_TO_EW');
        }
        break;

      case 'ALL_RED_TO_EW':
        if (this.phaseTimer >= this.allRedDuration) {
          this.setPhase('EW_GREEN');
        }
        break;

      case 'EW_GREEN':
        // Conditions to transition EW -> Amber:
        const nsStarving = this.phaseTimer >= this.minGreenDuration && maxWaitNS >= 15.0;
        const ewMaxCap = this.phaseTimer >= this.maxGreenDuration && demandNS.totalCount > 0;
        const ewGappedOut = this.phaseTimer >= this.minGreenDuration && !ewDischarging && demandNS.totalCount > 0;

        if (nsStarving || ewMaxCap || ewGappedOut) {
          this.setPhase('EW_AMBER');
        }
        break;

      case 'EW_AMBER':
        if (this.phaseTimer >= this.amberDuration) {
          this.setPhase('ALL_RED_TO_NS');
        }
        break;

      case 'ALL_RED_TO_NS':
        if (this.phaseTimer >= this.allRedDuration) {
          this.setPhase('NS_GREEN');
        }
        break;
    }
  }

  // Detects demand (queued cars + approaching cars within detection zone) for specified approaches
  detectAxisDemand(dirs, vehicles, statsTracker) {
    let queueCount = 0;
    let approachingCount = 0;

    for (const dir of dirs) {
      queueCount += statsTracker.getQueueLength(dir);
    }

    // Check approaching moving vehicles within 220px of stop line
    for (const car of vehicles) {
      if (dirs.includes(car.originDir) && !car.hasCrossedStopLine && car.route !== 'left') {
        const distToStop = car.path.stopLineDistance - (car.distance + car.length * 0.5);
        if (distToStop > 0 && distToStop < 220 && car.speed >= 4) {
          approachingCount++;
        }
      }
    }

    return { queueCount, approachingCount, totalCount: queueCount + approachingCount };
  }

  // Checks if cars are actively rolling through or near the stop line (headway passage check)
  isAxisDischarging(dirs, vehicles) {
    for (const car of vehicles) {
      if (dirs.includes(car.originDir) && car.route !== 'left') {
        const distToStop = car.path.stopLineDistance - (car.distance + car.length * 0.5);
        // Vehicle is within 160px upstream of stop line moving forward
        if (distToStop > -30 && distToStop < 160 && car.speed > 10) {
          return true; // Active platoon discharging, extend green
        }
      }
    }
    return false;
  }

  // Switches phase and recalculates directional signals
  setPhase(phase) {
    this.currentPhase = phase;
    this.phaseTimer = 0;

    switch (phase) {
      case 'NS_GREEN':
        this.signals = { north: 'green', south: 'green', east: 'red', west: 'red' };
        break;
      case 'NS_AMBER':
        this.signals = { north: 'amber', south: 'amber', east: 'red', west: 'red' };
        break;
      case 'ALL_RED_TO_EW':
      case 'ALL_RED_TO_NS':
        this.signals = { north: 'red', south: 'red', east: 'red', west: 'red' };
        break;
      case 'EW_GREEN':
        this.signals = { north: 'red', south: 'red', east: 'green', west: 'green' };
        break;
      case 'EW_AMBER':
        this.signals = { north: 'red', south: 'red', east: 'amber', west: 'amber' };
        break;
    }
  }

  // Trigger Emergency Corridor Preemption
  triggerEmergency(dir, carId) {
    this.emergencyDir = dir;
    this.emergencyCarId = carId;
    this.emergencyTimer = 0;

    // Check if the emergency direction already has active green
    const isNS = dir === 'north' || dir === 'south';
    const isCurrentlyGreen = isNS ? this.currentPhase === 'NS_GREEN' : this.currentPhase === 'EW_GREEN';

    if (isCurrentlyGreen) {
      // Direct lock into corridor
      this.emergencyState = 'CORRIDOR';
      this.lockCorridorSignals(dir);
    } else {
      // Must safely transition active traffic: Amber -> All-Red -> Green Corridor
      this.emergencyState = 'PREEMPT_AMBER';
      this.emergencyTimer = 0;
      // Change active green to amber
      if (this.currentPhase === 'NS_GREEN') {
        this.signals = { north: 'amber', south: 'amber', east: 'red', west: 'red' };
      } else {
        this.signals = { north: 'red', south: 'red', east: 'amber', west: 'amber' };
      }
    }
  }

  // Emergency Preemption State Machine
  updateEmergencyFSM(dt, vehicles) {
    this.emergencyTimer += dt;

    switch (this.emergencyState) {
      case 'PREEMPT_AMBER':
        if (this.emergencyTimer >= 2.0) {
          this.emergencyState = 'PREEMPT_ALL_RED';
          this.emergencyTimer = 0;
          this.signals = { north: 'red', south: 'red', east: 'red', west: 'red' };
        }
        break;

      case 'PREEMPT_ALL_RED':
        if (this.emergencyTimer >= 1.5) {
          this.emergencyState = 'CORRIDOR';
          this.emergencyTimer = 0;
          this.lockCorridorSignals(this.emergencyDir);
        }
        break;

      case 'CORRIDOR':
        // Check if emergency vehicle has crossed the junction exit
        let emergencyCarStillPresent = false;
        if (vehicles) {
          for (const car of vehicles) {
            if (car.id === this.emergencyCarId && !car.hasExited) {
              // Car is still inside or approaching
              if (car.distance < car.path.totalLength - 100) {
                emergencyCarStillPresent = true;
              }
              break;
            }
          }
        }

        // Once cleared or timeout failsafe (25s)
        if (!emergencyCarStillPresent || this.emergencyTimer >= 25.0) {
          this.emergencyState = 'EXIT_ALL_RED';
          this.emergencyTimer = 0;
          this.signals = { north: 'red', south: 'red', east: 'red', west: 'red' };
        }
        break;

      case 'EXIT_ALL_RED':
        if (this.emergencyTimer >= 1.5) {
          // Restore normal cycle smoothly
          this.emergencyState = 'NONE';
          this.emergencyDir = null;
          this.emergencyCarId = null;
          this.setPhase('NS_GREEN');
        }
        break;
    }
  }

  lockCorridorSignals(dir) {
    this.signals = { north: 'red', south: 'red', east: 'red', west: 'red' };
    this.signals[dir] = 'green';
    // If North is green, South can also be green for straight flow
    if (dir === 'north' || dir === 'south') {
      this.signals.north = 'green';
      this.signals.south = 'green';
    } else {
      this.signals.east = 'green';
      this.signals.west = 'green';
    }
  }

  getSignal(dir) {
    return this.signals[dir] || 'red';
  }

  reset() {
    this.setPhase('NS_GREEN');
    this.emergencyState = 'NONE';
    this.emergencyTimer = 0;
    this.emergencyDir = null;
    this.emergencyCarId = null;
  }
}
