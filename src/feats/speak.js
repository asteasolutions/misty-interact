const _ = require('lodash');
const FormData = require('form-data');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const { MistyAction } = require('misty-client');

const normalArmPosition = [-45, -45];
const emotiveArmPositions = [
  [-135, -45],
  [-150, -90],
  [-135, -135],
];

/**
 * A Misty action allowing her to vocalize written text using a Text-To-Speech
 * service (Google TTS) and playing the generated audio files. Misty also
 * performs some emotive arm movements and expressions while speaking.
 */
class Speak extends MistyAction {
  constructor(robotIp, defaultOptions) {
    super(robotIp, _.merge({}, {
      speechFileName: 'speak.mp3',
      speakingFace: 'Speaking.png',
    }, defaultOptions));

    this._ttsClient = new TextToSpeechClient({ keyFilename: 'gapi-credentials.json' });
  }

  async _emote() {
    await this._updateExpression(this._options.speakingFace);
    if (Math.random() > 0.5) {
      await this._updateArmPosition(..._.sample(emotiveArmPositions));
    }
  }

  async _resetEmotion() {
    await this._resetExpression();
    await this._resetArmPosition();
  }
  
  async _do(text) {
    const audioBuffer = await this._textToSpeech(text);
    await this._playAudio(audioBuffer);
  }

  async _textToSpeech(text) {
    const request = {
      input: { text },
      voice: { languageCode: 'en-US', ssmlGender: 'FEMALE' },
      audioConfig: {
        audioEncoding: 'MP3',
        pitch: 5,
        speakingRate: 1.1,
      },
    };
  
    const [response] = await this._ttsClient.synthesizeSpeech(request);
    return response.audioContent;
  }

  async _playAudio(buffer) {
    const formData = new FormData();
    formData.append('File', buffer, { filename: this._options.speechFileName });
    formData.append('FileName', this._options.speechFileName);
    formData.append('OverwriteExisting', 'true');
    const [response] = await this._mistyClient.post('audio', formData);

    if (response) {
      return new Promise(resolve => {
        this._emote();

        this._initEventObserver()
          .startObserving('AudioPlayComplete', 'AudioPlayComplete')
          .subscribe(async () => {
            await this._resetEmotion();
            resolve();
          });
        
        return this._mistyClient.postJSON('audio/play', { FileName: response.name });
      });
    }
  }
}

module.exports = {
  Speak,
};
