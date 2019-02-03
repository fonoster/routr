#!/usr/bin/env node

if (!module.parent) {
  // eslint-disable-next-line global-require
  const { register } = require('./global');

  register();
}

const debug = require('debug')('webpack-command');
const importLocal = require('import-local'); // eslint-disable-line import/order
const weblog = require('webpack-log');

// Prefer the local installation of webpack-command
/* istanbul ignore if */
if (importLocal(__filename)) {
  debug('Using local install of webpack-command');
} else {
  run();
}

function run() {
  /* eslint-disable global-require */
  const { existsSync: exists, statSync: stat } = require('fs');
  const { sep } = require('path');

  const chalk = require('chalk');
  const meow = require('meow');

  const woof = require('./');
  const { help: commandHelp, load: getCommands } = require('./commands');
  const { help: flagHelp, opts } = require('./flags');
  /* eslint-enable global-require */

  const flagOpts = { flags: opts() };
  const log = weblog({ name: 'command', id: 'webpack-command-forced' });
  const cli = meow(
    chalk`
{underline Usage}
  $ webpack [<config>, ...options]
  $ webpack <entry-file> [...<entry-file>] <output-file>

{underline Options}
${flagHelp()}

  For further documentation, visit {blue https://webpack.js.org/api/cli}

{underline Commands}
${commandHelp()}

  Type \`webpack help <command>\` for more information

{underline Examples}
  $ webpack
  $ webpack --help
  $ webpack entry.js
  $ webpack --config ../webpack.config.js
`,
    flagOpts
  );

  const commands = getCommands();
  const [command] = cli.input;

  cli.argv = cli.flags;
  cli.commands = commands;
  cli.entries = [];

  const cmd = cli.commands[command];

  if (cmd) {
    try {
      cmd.run(cli);
    } catch (e) {
      log.error(chalk`The {bold \`${command}\`} command threw an error:`);
      throw e;
    }
  } else {
    if (cli.input.length) {
      const problems = [];
      const isDir = (path) => stat(path).isDirectory();
      const entries = [];

      for (let file of cli.input) {
        if (!exists(file)) {
          problems.push(file);
        } else {
          if (isDir(file)) {
            file += sep;
          }

          entries.push(file);
        }
      }

      if (problems.length) {
        const prefix =
          problems.length === cli.input.length ? 'The' : 'Some of the';
        const message = `${prefix} input provided did not match any known commands or existing files:
            ${problems.join(' ')}`;
        log.error(message);

        /* istanbul ignore else */
        if (process.env.CLI_TEST === 'true') {
          throw new Error(message);
        } else {
          process.exit(problems.length);
        }
      }

      cli.entries = entries;
    }

    woof(cli);
  }
}
