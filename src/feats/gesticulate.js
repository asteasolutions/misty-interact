const _ = require('lodash');
const { Speak } = require('./speak');
const { MistyAction } = require('misty-client');

/**
 * A Misty action where she speaks and articulates (changes her
 * expression and moves her hands) simultaneously immitating
 * human-like gesticulation.
 */
class Gesticulate extends MistyAction {
  constructor(robotIp, defaultOptions) {
    super(robotIp, defaultOptions);
    this._speak = new Speak(robotIp, { ...defaultOptions, shouldEmote: false });
  }

  async _do({ say, armPositions, face }) {
    if (face) {
      await this._updateExpression(face);
    }
    if (armPositions) {
      await this._updateArmPosition(...armPositions);
    }
    if (say) {
      await this._speak.do(say);
    }
    if (armPositions) {
      await this._resetArmPosition();
    }
    if (face) {
      await this._resetExpression();
    }
  }
}

module.exports = {
  Gesticulate,
};
