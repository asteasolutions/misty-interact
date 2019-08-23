const Pandorabot = require('pb-node');
const { MobileAppServer } = require('../../mobile-app-server');
const { Speak } = require('../../speak');

const bot = new Pandorabot({
  url: 'https://api.pandorabots.com',
  app_id: process.env.PANDORABOT_APP_ID,
  user_key: process.env.PANDORABOT_USER_KEY,
  botname: 'misty',
});

let clientName = null;
let sessionId = null;

async function talk(input) {
  return new Promise((resolve, reject) => {
    if (!clientName) {
      bot.atalk({ input }, (err, res) => {
        if (err) {
          reject(err);
        } else {
          clientName = res.client_name;
          sessionId = res.sessionid;
          resolve(res.responses);
        }
      });
    } else {
      bot.talk({
        input,
        client_name: clientName,
        sessionid: sessionId,
      }, (err, res) => err ? reject(err) : resolve(res.responses));
    }
  });
}

const server = new MobileAppServer({
  robotIp: process.env.MISTY_IP,
  speechHandler: async message => {
    const responses = await talk(message);
    return responses.join(' ');
  }
});

const speak = new Speak(process.env.MISTY_IP);

(async () => {
  const responses = await talk(`Set topic restaurant.`);
  await server.start();
  await speak.do(responses.join(' '));
})();
