const { readFileSync: read, writeFileSync: write } = require('fs');
const { join } = require('path');

const chalk = require('chalk');

const pkg = require('../../package.json');

const Command = require('./Command');

class TeachCommandError extends Command.CommandError {
  constructor(...args) {
    super(...args);
    this.name = 'TeachCommandError';
  }
}

module.exports = class TeachCommand extends Command {
  help() {
    return chalk`
  {blue teach} v${pkg.version}

  Teaches webpack-command that a command has been installed and is available.

  {underline Usage}
    $ webpack teach --command <command> --module <module>

  {underline Options}
    --command   The name of a command that users will type
    --forget    Instructs the tool to forget a previously added command
    --module    The npm module name of a command

  {underline Examples}
    $ webpack teach --command init --module webpack-command-init
    $ webpack teach --command init --forget
`;
  }

  run(cli) {
    const { flags } = cli;
    const { command, forget, module: commandModule } = flags;
    const dataPath = join(__dirname, '../../data/commands.json');
    const dataFile = read(dataPath, 'utf-8');
    const commands = JSON.parse(dataFile);
    const format = () =>
      JSON.stringify(commands, Object.keys(commands).sort(), 2);

    if (!command) {
      throw new TeachCommandError('The --command flag is required.');
    }

    if (typeof command !== 'string') {
      throw new TeachCommandError('The value of --command must be a String.');
    }

    if (forget) {
      delete commands[command];
      write(dataPath, format(), 'utf-8');
      return;
    }

    if (!commandModule) {
      throw new TeachCommandError('The --module flag is required.');
    }

    if (typeof commandModule !== 'string') {
      throw new TeachCommandError('The value of --module must be a String.');
    }

    if (commands[command]) {
      throw new TeachCommandError(
        `The '${command}' command was already added via ${
          commands[command]
        }. Use \`webpack teach --command ${command} --forget\` and try again.`
      );
    }

    try {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      require(commandModule);
    } catch (e) {
      throw new TeachCommandError(
        `The command module '${commandModule}' was not found.`
      );
    }

    commands[command] = commandModule;

    write(dataPath, format(), 'utf-8');
  }
};
