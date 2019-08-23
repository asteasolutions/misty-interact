const _ = require('lodash');
const responses = [
  'Sorry, I didn\'t get that.',
  'Say what?',
  'I don\'t understand.',
  'Sense, your words make none.',
]

function handleUnknownMessage() {
  return _.sample(responses);
}

module.exports = {
  handleUnknownMessage,
}
