const _ = require('lodash');
const express = require('express');
const fileUpload = require('express-fileupload');
const { Speak } = require('./speak');
const { RemoteSpeechRecognizer } = require('./listen');
const { FaceRecognizer } = require('./face-recognition');
const { Gesticulate } = require('./gesticulate');

/**
 * This server can be used to communicate with the iOS client application and use
 * an iPhone to record the user's voice. Currently this is used as a workaround
 * since we can't use Misty's microphones because of the following problems:
 *  - The voices recorded with Misty's microphones sound distant and mute.
 *  - There's no wake word detection, i.e. we should have some other trigger to start recording.
 *  - We don't have access to the raw audio data, i.e. we also need a trigger to stop recording.
 */
class MobileAppServer {
  constructor({ port, robotIp, speechHandler } = {}) {
    this.port = port || 3000;
    this.speechHandler = speechHandler || (async () => 'I don\'t have a brain!');
    this.app = express();
    this.faceRecognizer = new FaceRecognizer(robotIp);
    this.speechRecognizer = new RemoteSpeechRecognizer(robotIp);
    this.speak = new Speak(robotIp);
    this.gesticulate = new Gesticulate(process.env.MISTY_IP);
    this.setup();
  }

  setup() {
    this.app.use(fileUpload({ limits: { fileSize: 500 * 1024 } }));
    
    this.app.post('/listen', async (req, res) => {
      console.debug('Start recording audio...');
      await this.speechRecognizer.start();
      res.sendStatus(200);
    });
    
    this.app.post('/listen/done', async (req, res) => {
      console.debug('Stop recording audio. Starting TTS...');
      if (req.files.speech) {
        this.speechRecognizer.receive(req.files.speech.data);
      }
      const transcripts = await this.speechRecognizer.stop();
      console.debug(`TTS recognized transcripts:\n${transcripts}`);
      console.debug('Generating response...');
      const response = await this.speechHandler(transcripts.length > 0 ? transcripts[0][0] : null);
      console.debug(`Response generated: ${response}`);
      await this.speak.do(response);
      res.sendStatus(200);
    });
  }
  
  async start() {
    await this.faceRecognizer.start();
    this.app.listen(this.port, () => console.log(`Listening on port ${this.port}!`));

    process.on('SIGINT', async () => {
      console.log('Caught interrupt signal');
      await this.stop();
      process.exit();
    });
  }

  async stop() {
    await this.faceRecognizer.stop();
  }
}

module.exports = {
  MobileAppServer,
};
