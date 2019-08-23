const _ = require('lodash');
const { map } = require('rxjs/operators');
const { MistyPerception } = require('misty-client');

// Values from the docs: https://docs.mistyrobotics.com/docs/reference/rest/#movehead
const MIN_HEAD_PITCH = -9.5;
const MAX_HEAD_PITCH = 34.9;
const MIN_HEAD_YAW = -90;
const MAX_HEAD_YAW = 90;

const SAFE_MARGIN = 5;
const MIN_DISPOSITION = 2;

/**
 * A Misty perception allowing her to recognize and follow (look at) faces.
 * It uses the built-in face recognition skill and uses it to calculate
 * the relative position of the person's face to her point of view. Then the head
 * is rotated in order to appear as though she's looking at the person.
 */
class FaceRecognizer extends MistyPerception {
  constructor(robotIp, defaultOptions) {
    super(robotIp, _.merge({}, { followFace: true }, defaultOptions));
    this._currentHeadPitch = 0;
    this._currentHeadYaw = 0;
  }

  async _start() {
    await this._centerHead();

    const observable = this._initEventObserver().startObserving('Face', 'FaceRecognition', {
      DebounceMs: 500,
    });

    if (this._options.followFace) {
      this._eventObserver.startObserving('HeadPitch', 'ActuatorPosition', {
        DebounceMs: 250,
        ReturnProperty: 'value',
        EventConditions: [{
          Property: 'sensorName',
          Inequality: '==',
          Value: 'Actuator_HeadPitch'
        }],
      }).subscribe(({ message }) => this._currentHeadPitch = message);
      this._eventObserver.startObserving('HeadYaw', 'ActuatorPosition', {
        DebounceMs: 250,
        ReturnProperty: 'value',
        EventConditions: [{
          Property: 'sensorName',
          Inequality: '==',
          Value: 'Actuator_HeadYaw'
        }],
      }).subscribe(({ message }) => this._currentHeadYaw = message);
      observable.subscribe(({ message }) => this._adjustHead(message.elevation, message.bearing));
    }

    await this._mistyClient.post('faces/detection/start');
    await this._mistyClient.post('faces/recognition/start');

    return observable.pipe(map(data => {
      return {
        elevation: data.message.elevation,
        bearing: data.message.bearing,
        personName: (data.message.personName !== 'unknown person') ? data.message.personName : null,
        timestamp: new Date(data.message.created),
      };
    }));
  }

  async _stop() {
    await this._mistyClient.post('faces/recognition/stop');
    await this._mistyClient.post('faces/detection/stop');
    await this._centerHead();
  }

  async _moveHead(pitch, yaw) {
    console.debug(`Rotating head to pitch ${pitch}, yaw ${yaw}.`);
    return await this._mistyClient.postJSON('head', {
      Pitch: pitch,
      Yaw: yaw,
      Roll: 0,
      Velocity: 80,
      Units: 'degrees',
    });
  }

  async _centerHead() {
    const pitch = (MIN_HEAD_PITCH + MAX_HEAD_PITCH) / 2;
    const yaw = (MIN_HEAD_YAW + MAX_HEAD_YAW) / 2;
    await this._moveHead(pitch, yaw);
  }

  async _adjustHead(elevation, bearing) {
    // Ignore insignificant head movements because they look like glitches.
    if (Math.abs(elevation) >= MIN_DISPOSITION || Math.abs(bearing) >= MIN_DISPOSITION) {
      const minPitch = MIN_HEAD_PITCH + SAFE_MARGIN;
      const maxPitch = MAX_HEAD_PITCH - SAFE_MARGIN;
      const pitch = _.clamp(this._currentHeadPitch + elevation, minPitch, maxPitch);
      
      const minYaw = MIN_HEAD_YAW + SAFE_MARGIN;
      const maxYaw = MAX_HEAD_YAW - SAFE_MARGIN;
      const yaw = _.clamp(this._currentHeadYaw + bearing, minYaw, maxYaw);
      
      await this._moveHead(pitch, yaw);
    }
  }
}

module.exports = {
  FaceRecognizer,
};
