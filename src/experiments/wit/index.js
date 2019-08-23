const { Wit, log } = require('node-wit');
const { handleGreeting } = require('./greeting');
const { handleUnknownMessage } = require('./unknown');
const { handleTimeQuery } = require('./schedule');
const { MobileAppServer } = require('../../mobile-app-server');

const responseHandlers = [handleGreeting, handleTimeQuery, handleUnknownMessage];
const witClient = new Wit({
  accessToken: process.env.WIT_TOKEN,
  logger: new log.Logger(log.DEBUG),
});

const server = new MobileAppServer({
  robotIp: process.env.MISTY_IP,
  speechHandler: async message => {
    const wit = message ? await witClient.message(message) : { entities: {} };
    return responseHandlers.reduce((prevResponse, handler) => prevResponse || handler(wit), null);
  }
});

server.start();
