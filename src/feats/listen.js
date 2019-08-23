const _ = require('lodash');
const { SpeechClient } = require('@google-cloud/speech');
const { MistyPerception } = require('misty-client');

/**
 * A Misty perception allowing her to hear and recognize speech,
 * using an external Speech-To-Text service.
 */
class SpeechRecognizer extends MistyPerception {
  constructor(robotIp, defaultOptions) {
    super(robotIp, _.merge({}, {
      listeningFace: 'Listening.png',
      thinkingFace: 'Thinking.png',
      audioConfig: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: 'en-US',
      }
    }, defaultOptions));

    this._sttClient = new SpeechClient({ keyFilename: process.env.GAPI_CREDENTIALS });
  }

  async _start() {
    await this._prepare();
    await this._updateExpression(this._options.listeningFace);
  }

  async _stop() {
    await this._updateExpression(this._options.thinkingFace);
    const buffer = await this._obtainAudioBuffer();
    if (buffer) {
      const [response] = await this._sttClient.recognize({
        config: this._options.audioConfig,
        audio: { content: buffer.toString('base64') },
      });
      await this._resetExpression();
      if (response && response.results) {
        return response.results.map(result => result.alternatives.map(a => a.transcript));
      }
    }
    return [];
  }

  // Implement in descendants
  async _prepare() {}
  async _obtainAudioBuffer() {}
}

/**
 * A speech recognizer using audio recordings created by Misty.
 */
class LocalSpeechRecognizer extends SpeechRecognizer {
  constructor(robotIp, defaultOptions) {
    super(robotIp, _.merge({}, {
      recordingFileName: 'listen.wav',
      audioConfig: { sampleRateHertz: 48000 },
    }, defaultOptions));
  }

  async _prepare() {
    await this._mistyClient.postJSON('audio/record/start', { FileName: this._options.recordingFileName });
  }

  async _obtainAudioBuffer() {
    await this._mistyClient.post('audio/record/stop');
    const audioResponse = await this._mistyClient.getRaw('audio', { FileName: this._options.recordingFileName });
    return await audioResponse.buffer();
  }
}

/**
 * A speech recognizer using audio recordings created using external hardware,
 * such as a mobile phone. Allows for more complex setups and speaking "to Misty"
 * in a crowded environment, for example through a bluetooth headset paired with
 * the phone. Misty is actually not involved in the audio recording but she changes
 * her facial expression while the recording is taking place in order to indicate
 * to the person that she's listening.
 */
class RemoteSpeechRecognizer extends SpeechRecognizer {
  constructor(robotIp, defaultOptions) {
    super(robotIp, defaultOptions);
    this._audioBuffer = null;
  }

  receive(audioBuffer) {
    this._audioBuffer = audioBuffer;
  }

  async _obtainAudioBuffer() {
    return this._audioBuffer;
  }
}

module.exports = {
  LocalSpeechRecognizer,
  RemoteSpeechRecognizer,
};
