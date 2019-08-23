// Max reading of TOF sensor in meters.
const TOF_MAX = 1;
// Distance between left and right TOF sensors in meters.
const TOF_DIST = 0.147;
// Distance between the center of Misty's torso and each of her wheels.
const WHEEL_DIST = 0.07
// The amount of meters one degree of wheel (drive encoder) rotation corresponds to.
// This constant was established empirically.
const METERS_PER_DEGREE = 0.0009;

function radToDeg(radians) {
  return radians * 180 / Math.PI;
}

function degToRad(degrees) {
  return degrees * Math.PI / 180;
}

function calcTraveledDistance(leftEncoderDegrees, rightEncoderDegrees) {
  // Check for zero distances. Also, ignore cases where wheels are moving in
  // in opposite directions. Such movements do displace the robot a little, but
  // the displacement should be insignificant for our goals.
  if ((leftEncoderDegrees === 0 && rightEncoderDegrees === 0) || leftEncoderDegrees * rightEncoderDegrees < 0) {
    return [0, 0];
  }

  const isMovingForward = leftEncoderDegrees > 0;
  const leftWheelDist = Math.abs(leftEncoderDegrees * METERS_PER_DEGREE);
  const rightWheelDist = Math.abs(rightEncoderDegrees * METERS_PER_DEGREE);

  if (leftWheelDist === rightWheelDist) {
    // Moving straight ahead or back.
    return [isMovingForward ? 0 : 180, leftWheelDist];
  }

  const s1 = Math.min(leftWheelDist, rightWheelDist);
  const s2 = Math.max(leftWheelDist, rightWheelDist);
  const r = 2 * s1 * WHEEL_DIST / (s2 - s1);
  const angle = (s2 - s1) / (4 * WHEEL_DIST);
  const dist = 2 * (r + WHEEL_DIST) * Math.sin(angle);
  const sign = Math.sign(leftWheelDist - rightWheelDist);

  return [sign * (isMovingForward ? angle : Math.PI - angle), dist];
}

module.exports = {
  calcTraveledDistance,
  radToDeg,
  degToRad,
  TOF_DIST,
}