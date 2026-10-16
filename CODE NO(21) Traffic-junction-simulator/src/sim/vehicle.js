// Vehicle entity with IDM physics properties and state tracking

export class Vehicle {
  constructor({
    id,
    originDir,
    route,
    path,
    isEmergency = false,
    desiredSpeed = 85,
    color = '#7ec8e3',
    spawnTime = 0,
  }) {
    this.id = id;
    this.originDir = originDir;
    this.route = route;
    this.path = path;
    this.isEmergency = isEmergency;
    this.spawnTime = spawnTime;

    // Physical dimensions
    this.length = isEmergency ? 32 : 25;
    this.width = isEmergency ? 16 : 14;
    this.color = isEmergency ? '#ef4444' : color;

    // Longitudinal state
    this.distance = 0;
    this.speed = desiredSpeed * 0.7; // Enter at 70% cruise speed
    this.desiredSpeed = isEmergency ? desiredSpeed * 1.35 : desiredSpeed;
    this.acceleration = 0;

    // IDM parameters
    this.maxAcc = isEmergency ? 200 : 130; // px/s^2
    this.comfDec = isEmergency ? 240 : 170; // px/s^2
    this.minGap = 12; // px bumper-to-bumper
    this.timeHeadway = isEmergency ? 0.9 : 1.2; // seconds

    // Coordinates & heading
    this.x = 0;
    this.y = 0;
    this.angle = 0;

    // State tracking & statistics
    this.inQueue = false;
    this.queueStartTime = null;
    this.totalWaitTime = 0;
    this.hasCrossedStopLine = false;
    this.isCommittedToJunction = false;
    this.hasExited = false;
    this.brakeActive = false;
    this.turnSignal = route === 'left' ? 'left' : route === 'right' ? 'right' : 'none';

    // Update initial position
    this.updatePosition();
  }

  updatePosition() {
    const pt = this.path.getPointAt(this.distance);
    this.x = pt.x;
    this.y = pt.y;
    this.angle = pt.angle;
  }

  // Distance from vehicle's front bumper to the target coordinate along its path
  distanceTo(targetDist) {
    return targetDist - (this.distance + this.length * 0.5);
  }

  // Distance to a leader vehicle ahead on the same trajectory
  distanceToLeader(leader) {
    // Gap between this car's front bumper and leader's rear bumper
    const frontBumper = this.distance + this.length * 0.5;
    const leaderRearBumper = leader.distance - leader.length * 0.5;
    return leaderRearBumper - frontBumper;
  }
}
