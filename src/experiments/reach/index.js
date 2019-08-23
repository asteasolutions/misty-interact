/**
 * This "skill" lets you talk to Misty by tapping her twice on the head to start
 * listening and once again to stop listening. If Misty hears her name, she will
 * greet you. While listening, face detection is also enabled, so she will try to
 * greet you by name if she recognizes you.
 */

const { Navigate } = require('../../navigate');

async function main() {
  const navigate = new Navigate(process.env.MISTY_IP);
  await navigate.do({ x: 0, y: 1 });
}

main();
