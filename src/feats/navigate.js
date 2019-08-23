const _ = require('lodash');
const { MistyAction } = require('misty-client');
const { Orientation } = require('./orientation');
const { ObstacleDetection } = require('./obstacle-detection');
const { radToDeg, TOF_DIST } = require('../movement-utils');

const MIN_LINEAR_VELOCITY = 20;
const MIN_TOTAL_VELOCITY = 40;
const MAX_LINEAR_VELOCITY = 50;
const ANGULAR_VELOCITY = 30;
const STATIONARY_ANGULAR_VELOCITY = 55;
const MAX_TOF = 10;

/**
 * A Misty action where she can navigate to a relative location of her current position
 * (e.g. 10 meters forward, 2 meters to the left), avoiding obstacles on the way.
 * The implemented algorigthm depends on Misty's Time-of-Flight sensors. It is largely
 * heuristic and doesn't work well because of the incosistent and inaccurate sensor readings.
 */
// There's much magic in this file and not all of it works as expected.
// To avoid stress and frustration, look at another file.
class Navigate extends MistyAction {
  constructor(robotIp, defaultOptions) {
    super(robotIp, defaultOptions);

    this._orientation = new Orientation(robotIp);
    this._obstacleDetection = new ObstacleDetection(robotIp);
    this._intervalId = null;
    this._currentLinearSpeed = 0;
    this._currentAngle = 0;
  }

  async _do(target) {
    this._initEventObserver();
    
    let tof = { left: MAX_TOF, right: MAX_TOF };
    let position = { x: 0, y: 0, yaw: 0 };
    let lastObstacleSight = 0;
    
    (await this._orientation.start()).subscribe(({ x, y, yaw }) => position = { x, y, yaw });
    (await this._obstacleDetection.start()).subscribe(([left, right]) => tof = {
      left: Math.min(MAX_TOF, left),
      right: Math.min(MAX_TOF, right),
    });
    
    await this._rotate(Math.atan2(target.y, target.x) - Math.atan2(1, 0));

    // Wait for obstacle detection to gather some data
    await new Promise(resolve => setTimeout(resolve, 1000));

    return new Promise(resolve => {
      this._intervalId = setInterval(async () => {
        const hasObstacleAhead = Math.min(tof.left, tof.right) < 0.6;
        if (hasObstacleAhead) {
          lastObstacleSight = Date.now();
        }
        const navigation = await this._navigate(target, position, { hasObstacleAhead, lastObstacleSight, tof });
        if (navigation.speed || navigation.angle) {
          this._move(navigation.angle, navigation.speed);
        } else {
          // Stop moving. Turn towards the target.
          clearInterval(this._intervalId);
          await this._mistyClient.post('drive/stop');
          await this._rotate(navigation.angle);
          resolve();
        }
      }, 250);
    });
  }

  async _cleanup() {
    clearInterval(this._intervalId);
    await super._cleanup();
    await this._orientation.stop();
    await this._obstacleDetection.stop();
  }

  async _navigate(target, position, obstacleDetection) {
    const dx = target.x - position.x;
    const dy = target.y - position.y;
    const distanceToTarget = Math.sqrt(dx * dx + dy * dy);
    let absoluteAngle = 0;
    let speed = 0;
    if (distanceToTarget > 0.3) {
      // Move towards the target.
      if (obstacleDetection.hasObstacleAhead) {
        const direction = this._calculateEvasionVector(obstacleDetection.tof);
        absoluteAngle = Math.atan2(direction.y, direction.x) - Math.atan2(1, 0);
        speed = Math.min(1, Math.sqrt(direction.x * direction.x + direction.y * direction.y));
      } else if (Date.now() - obstacleDetection.lastObstacleSight < 1000) {
        absoluteAngle = 0;
        speed = 1;
      } else {
        absoluteAngle = Math.atan2(target.y, target.x) - Math.atan2(1, 0) - position.yaw;
        speed = 1;
      }
    } else {
      absoluteAngle = Math.atan2(target.y, target.x) - Math.atan2(1, 0) - position.yaw;
      speed = 0;
    }

    const angle = this._normalizeAngle(absoluteAngle) / Math.PI;
    return {
      speed: speed < 0.1 ? 0 : speed,
      angle: Math.abs(angle) < 0.1 ? 0 : angle,
    };
  }

  async _move(angle, speed) {
    this._currentLinearSpeed = this._ease(this._currentLinearSpeed, speed, 0.5, 0, 1);
    this._currentAngle = this._ease(this._currentAngle, angle, 0.5, -1, 1);
    
    await this._mistyClient.postJSON('drive/time', {
      ...this._calcNavigationCommand(this._currentLinearSpeed, this._currentAngle),
      timeMs: 300,
    });
  }

  async _rotate(angleInRadians) {
    return new Promise(resolve => {
      const angle = radToDeg(angleInRadians);
      let targetYaw = null;
      const maxError = 7.5;
      const speed = 55;
      this._eventObserver.startObserving('rotation', 'IMU', { debounceMs: 50, returnProperty: 'yaw' })
        .subscribe(async ({ message: yaw }) => {
          if (targetYaw === null) {
            targetYaw = (yaw + angle) % 360;
            while (targetYaw < 0) targetYaw += 360;
          }
          const diff = targetYaw - yaw;
          if (Math.abs(diff) > maxError) {
            const direction = -Math.sign((diff + 360) % 360 - 180);
            await this._mistyClient.postJSON('drive/time', {
              linearVelocity: 0,
              angularVelocity: direction * speed,
              timeMs: 200,
            });
          } else {
            await this._eventObserver.stopObserving('rotation');
            resolve();
          }
        });
    });
  }

  _calculateEvasionVector(tof) {
    const inertia = { x: 0, y: 0.5 };

    const tofDiff = tof.right - tof.left;
    const tofNorm = Math.sqrt(tofDiff * tofDiff + TOF_DIST * TOF_DIST);
    const distToObstacle = Math.min(tof.left, tof.right);

    // The evasion vector has length 0.5 and is parallel to the obstacle surface.
    const evasion = { x: Math.sign(tofDiff) * TOF_DIST / (2 * tofNorm), y: Math.abs(tofDiff) / (2 * tofNorm) };

    // Reaction magnitude is inversely proportional to distance to obstacle. The maximal
    // reaction magnitude of 0.5 is reached when the obstacle is 0.2 meters away.
    const reactionMagnitude = Math.min(1, (1 - distToObstacle) * 0.625);

    // The reaction vector is perpendicular to the obstacle surface (and to the evasion vector).
    const reaction = { x: evasion.y * reactionMagnitude, y: -evasion.x * reactionMagnitude };

    // The movement direction is the sum of the intertia, evasion and reaction vectors.
    const vectors = [inertia, evasion, reaction];
    return { x: _.sum(_.map(vectors, 'x')), y: _.sum(_.map(vectors, 'y')) };
  }

  _ease(currentValue, targetValue, maxStep, min, max) {
    const diff = targetValue - currentValue;
    const newValue = currentValue + Math.sign(diff) * Math.min(maxStep, Math.abs(diff));
    return _.clamp(newValue, min, max);
  }

  _calcNavigationCommand(relativeSpeed, relativeAngle) {
    let linearVelocity = relativeSpeed * MAX_LINEAR_VELOCITY;
    let angularVelocity = 0;
    if (Math.abs(relativeAngle) > 0.1) {
      angularVelocity = linearVelocity < MIN_LINEAR_VELOCITY
        ? Math.sign(relativeAngle) * STATIONARY_ANGULAR_VELOCITY
        : Math.sign(relativeAngle) * ANGULAR_VELOCITY;
    }

    if (linearVelocity > MIN_LINEAR_VELOCITY && angularVelocity) {
      linearVelocity = Math.max(0, linearVelocity - angularVelocity / 2);
    }
    
    if (linearVelocity + Math.abs(angularVelocity) < MIN_TOTAL_VELOCITY) {
      // Insufficient sum of velocities is effectively equivalent to a halt.
      linearVelocity = angularVelocity = 0;
    }
    return { linearVelocity, angularVelocity };
  }

  /// Gets an angle in radians and converts it to the intervel [-π,π].
  _normalizeAngle(angle) {
    let normalizedAngle = angle % (2 * Math.PI);
    if (Math.abs(normalizedAngle) > Math.PI) {
      normalizedAngle += -Math.sign(normalizedAngle) * 2 * Math.PI;
    }
    return normalizedAngle;
  }
}

module.exports = {
  Navigate,
};
