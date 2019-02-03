const chalk = require('chalk');
const open = require('opn');

const pkg = require('../../package.json');

const Command = require('./Command');

class HelpCommandError extends Command.CommandError {
  constructor(...args) {
    super(...args);
    this.name = 'HelpCommandError';
  }
}

module.exports = class HelpCommand extends Command {
  help() {
    return chalk`
  {blue help} v${pkg.version}

  Displays help for a given installed webpack command.

  {underline Usage}
    $ webpack help <command>

  {underline Examples}
    $ webpack help
    $ webpack help init
    $ webpack help serve
`;
  }

  // eslint-disable-next-line consistent-return
  run(cli, options = {}) {
    const { log } = console;
    const [, target] = cli.input;

    /* istanbul ignore if */
    if (!target) {
      open('https://webpack.js.org/');
      return '';
    }

    const command = cli.commands[target];

    if (!command) {
      throw new HelpCommandError(
        `The command '${target}' has not been installed`
      );
    }

    if (options.stdout === false) {
      return command.help();
    }

    /* istanbul ignore next */
    log(command.help());
  }
};

module.exports.HelpCommandError = HelpCommandError;
