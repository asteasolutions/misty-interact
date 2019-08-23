const _ = require('lodash');
const { MistyPerception } = require('misty-client');
const { map, filter, partition, withLatestFrom, buffer, debounceTime } = require('rxjs/operators');

/**
 * A Misty perception detecting touches on her head.
 */
class GestureDetector extends MistyPerception {
  async _start() {
    return this._initEventObserver().startObserving('Touch', 'TouchSensor', { DebounceMs: 10 });
  }
}

class TapGestureDetector extends GestureDetector {
  constructor(robotIp, defaultOptions) {
    super(robotIp, _.merge({}, { tapDuration: 300 }, defaultOptions));
  }

  async _start() {
    const source = await super._start();
    const [touchDowns, touchUps] = source.pipe(partition(({ message }) => message.isContacted));
    return touchUps.pipe(
      withLatestFrom(touchDowns),
      filter(([touchUp, touchDown]) =>
        new Date(touchUp.message.created) - new Date(touchDown.message.created) < this._options.tapDuration
      ),
      map(([touchUp]) => touchUp.message.sensorPosition)
    );
  }
}

class DoubleTapGestureDetector extends TapGestureDetector {
  constructor(robotIp, defaultOptions) {
    super(robotIp, _.merge({}, { doubleTapDuration: 300 }, defaultOptions));
  }

  async _start() {
    const source = await super._start();
    return source.pipe(
      buffer(source.pipe(debounceTime(this._options.doubleTapDuration))),
      filter(buf => buf.length === 2),
      map(buf => buf[1])
    );
  }
}

module.exports = {
  TapGestureDetector,
  DoubleTapGestureDetector,
};
