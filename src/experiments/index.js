const fs = require('fs');

const files = fs.readdirSync(__dirname, { withFileTypes: true });
const experiments = files.filter(f => f.isDirectory()).map(f => f.name);
const targetExperiment = process.argv[2]
if (!experiments.includes(targetExperiment)) {
  console.log(`Usage:\n\tyarn start <experiment>\nWhere <experiment> is one of: ${experiments.join(', ')}.`);
}

require(`./${targetExperiment}`);
