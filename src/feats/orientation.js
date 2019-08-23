const _ = require('lodash');
const { map, filter } = require('rxjs/operators');
const { MistyPerception } = require('misty-client');
const { degToRad, calcTraveledDistance } = require('../movement-utils');

/**
 * A Misty perception which determines her position using the IMU sensor
 * as well as the DriveEncoder events. This perception allows Misty to
 * have a basic sense of orientation in an unmapped area and have a general
 * idea of where she is located currently, relatively to her initial position.
 */
class Orientation extends MistyPerception {
  constructor(robotIp, defaultOptions) {
    super(robotIp, defaultOptions);
  }

  async _start() {
    let lastLeftEncoderRotations = null;
    let lastRightEncoderRotations = null;
    let initialYaw = null;
    let yawMeasurements = [];
    let hasEmittedInitialPosition = false;
    let position = { x: 0, y: 0, yaw: 0, time: Date.now() };

    const observer = this._initEventObserver();
    
    (await observer.startObserving('IMU', 'IMU', { DebounceMs: 100, ReturnProperty: 'yaw' }))
      .subscribe(({ message: yaw }) => {
        initialYaw = initialYaw === null ? degToRad(yaw) : initialYaw;
        yawMeasurements.push({ yaw: degToRad(yaw) - initialYaw, time: Date.now() });
        if (yawMeasurements.length > 10) {
          yawMeasurements.shift();
        }
      });
    
    return (await observer.startObserving('DriveEncoders', 'DriveEncoders', { DebounceMs: 250 })).pipe(
      map(({ message }) => {
        if (yawMeasurements.length === 0) {
          console.log('Skipping drive encoder events until we have at least one IMU reading!');
          return;
        }
        const { leftEncoderRotations, rightEncoderRotations } = message;
        const deltaLeft = lastLeftEncoderRotations === null ? 0 : leftEncoderRotations - lastLeftEncoderRotations;
        const deltaRight = lastRightEncoderRotations === null ? 0 : rightEncoderRotations - lastRightEncoderRotations;
        lastLeftEncoderRotations = leftEncoderRotations;
        lastRightEncoderRotations = rightEncoderRotations;

        const [angle, distance] = calcTraveledDistance(deltaLeft, deltaRight);
        const measurementAtLastPosition = _.findLast(yawMeasurements, m => m.time <= position.time) || yawMeasurements[0];
        const movementDirection = measurementAtLastPosition.yaw + angle;
        const deltaX = distance * Math.sin(movementDirection);
        const deltaY = distance * Math.cos(movementDirection);
        const deltaYaw = _.last(yawMeasurements).yaw - initialYaw - position.yaw;
        position.x += deltaX;
        position.y += deltaY;
        position.yaw += deltaYaw
        position.time = Date.now();

        const shouldEmit = (deltaX !== 0 || deltaY !== 0 || deltaYaw !== 0 || !hasEmittedInitialPosition);
        const currentPosition = shouldEmit ? position : null;
        hasEmittedInitialPosition = true;
        return currentPosition;
      }),
      filter(position => !!position),
    );
  }
}

module.exports = {
  Orientation,
};
