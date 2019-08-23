const _ = require('lodash');
const responses = {
  greetings: ['Hello!', 'Hi!', 'Hey!', 'Yo!', 'Howdy!', 'Ahoy!', 'What\'s up!', 'Hola!'],
  bye: ['See ya!', 'See you later!', 'Take care!', 'Until next time!', 'Bye bye!', 'Have a nice day!', 'Goodbye!'],
  thanks: ['You\'re welcome!', 'You got it!', 'Not a problem', 'My pleasure', 'I\'m happy to help', 'Anytime']
}

function handleGreeting(wit) {
  const type = ['thanks', 'bye', 'greetings'].find(key => !!wit.entities[key]);
  return type ? _.sample(responses[type]) : null;
}

module.exports = {
  handleGreeting,
}
