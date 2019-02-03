const { readFileSync: read } = require('fs');
const { join } = require('path');

const { CommandError } = require('./Command');

function load() {
  const dataPath = join(__dirname, '../../data/commands.json');
  const dataFile = read(dataPath, 'utf-8');
  const commands = JSON.parse(dataFile);

  for (const command of Object.keys(commands)) {
    const commandModule = commands[command];
    let CommandClass;

    try {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      CommandClass = require(commandModule);
    } catch (e) {
      throw new CommandError(
        `The command module '${commandModule}' was not found.`
      );
    }

    commands[command] = new CommandClass();
  }

  return commands;
}

module.exports = {
  CommandError,
  help() {
    const result = Object.keys(load())
      .sort()
      .join('\n  ');

    return `  ${result}`;
  },

  load,
};
