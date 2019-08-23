const { zip } = require('rxjs');
const { map, bufferCount } = require('rxjs/operators');
const { max, min, mean } = require('simple-statistics');
const { MistyPerception } = require('misty-client');

async function observeToF(observer, position) {
  const observable = await observer.startObserving(`${position}ToF`, 'TimeOfFlight', {
    DebounceMs: 100,
    EventConditions: [{
      Property: 'SensorPosition',
      Inequality: '==',
      Value: position,
    }],
    ReturnProperty: 'distanceInMeters',
  });

  return observable.pipe(
    map(({ message }) => message),
    bufferCount(5),
    map(readings => max(readings) - min(readings) > 0.2 ? Infinity : mean(readings)),
  )
}

/**
 * A Misty perception which detects obstacles using Misty's ToF sensors.
 * This is mostly a convenience feat, combining the readings of the left
 * and right front ToF and applying some statistics to each of them, in
 * order to smooth the values and handle outliers.
 */
class ObstacleDetection extends MistyPerception {
  constructor(robotIp, defaultOptions) {
    super(robotIp, defaultOptions);
  }

  async _start() {
    const observer = this._initEventObserver();
    const leftToFObservable = await observeToF(observer, 'Left');
    const rightToFObservable = await observeToF(observer, 'Right');

    return zip(leftToFObservable, rightToFObservable);
  }
}

module.exports = {
  ObstacleDetection,
};
