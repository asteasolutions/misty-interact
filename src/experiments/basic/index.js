/**
 * This "skill" lets you talk to Misty by tapping her twice on the head to start
 * listening and once again to stop listening. If Misty hears her name, she will
 * greet you. While listening, face detection is also enabled, so she will try to
 * greet you by name if she recognizes you.
 */

const _ = require('lodash');
const { Speak } = require('../../speak');
const { LocalSpeechRecognizer } = require('../../listen');
const { DoubleTapGestureDetector, TapGestureDetector } = require('../../touch');
const { FaceRecognizer } = require('../../face-recognition');

const tapDetector = new TapGestureDetector(process.env.MISTY_IP);
const doubleTapDetector = new DoubleTapGestureDetector(process.env.MISTY_IP);
const faceRecognizer = new FaceRecognizer(process.env.MISTY_IP);
const speechRecognizer = new LocalSpeechRecognizer(process.env.MISTY_IP);
const speak = new Speak(process.env.MISTY_IP);

async function main() {
  (await doubleTapDetector.start()).subscribe(async () => {
    doubleTapDetector.stop();
    await speak.do('Yes?');

    let lastSeenPerson = null;
    const recognition = await faceRecognizer.start();
    recognition.subscribe(person => lastSeenPerson = person);
    await speechRecognizer.start();
    (await tapDetector.start()).subscribe(async () => {
      tapDetector.stop();
      const transcripts = await speechRecognizer.stop();
      let response;
      console.debug('Misty heard:', transcripts);
      if (_.some(transcripts, alternatives => _.some(alternatives, a => /\bmisty\b/i.test(a)))) {
        response = lastSeenPerson ? `Hello, ${lastSeenPerson.personName}!` : 'Hello, stranger!';
      } else {
        response = 'Whatever';
      }
      await speak.do(response);
      faceRecognizer.stop();
    });
  });
}

main();
