const chalk = require('chalk');
const decamel = require('decamelize');
const loadUtils = require('loader-utils');
const meant = require('meant');
const merge = require('merge-options');
const resolve = require('enhanced-resolve');
const strip = require('strip-ansi');
const table = require('text-table');
const weblog = require('webpack-log');

module.exports = {
  bind(value, enforce, options) {
    if (!value) {
      return options;
    }

    let [extension, loader] = value.split('=');

    // this is logic copied from webpack-cli/convert-arg. not entirely sure why
    // this is done, perhaps for something like `--module-bind js`?
    if (extension && !loader) {
      loader = `${extension}-loader`;
    }

    // eslint-disable-next-line no-useless-escape
    extension = extension.replace(
      // eslint-disable-next-line no-useless-escape
      /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g,
      '\\$&'
    );

    const test = new RegExp(`\\.${extension}$`);
    const rule = { enforce, loader, test };

    // eslint-disable-next-line no-param-reassign
    const result = merge({ module: { rules: [] } }, options);
    result.module.rules.push(rule);

    return result;
  },

  loadPlugin(name) {
    const log = weblog({ name: 'webpack', id: 'webpack-command' });
    const queryPos = name && name.indexOf('?');
    let args;
    let pluginPath;

    try {
      if (queryPos > -1) {
        args = loadUtils.parseQuery(name.substring(queryPos));
        // eslint-disable-next-line no-param-reassign
        name = name.substring(0, queryPos);
      }
    } catch (e) {
      log.error(`Invalid plugin arguments ${name} (${e}).`);
      throw e;
    }

    try {
      pluginPath = resolve.sync(process.cwd(), name);
      // eslint-disable-next-line global-require, import/no-dynamic-require
      const PluginClass = require(pluginPath);
      return new PluginClass(args);
    } catch (e) {
      log.error(chalk`Cannot load plugin ${name} {dim from ${pluginPath}}`);
      throw e;
    }
  },

  // eslint-disable-next-line consistent-return
  validate(flag, value) {
    const { type: types } = flag;
    let result = false;

    if (!value || !types) {
      return true;
    }

    for (const type of [].concat(types)) {
      if (result !== true) {
        if (type === 'array') {
          result = Array.isArray(value);
        } else {
          // eslint-disable-next-line valid-typeof
          result = typeof value === type;
        }
      }
    }

    return result;
  },

  validateFlags(flags, argv, options = { stdout: true }) {
    const errors = [];
    const log = weblog({ name: 'webpack', id: 'webpack-command' });
    const names = Object.keys(flags);
    const tableOptions = {
      align: ['', 'l', 'l'],
      stringLength(str) {
        return strip(str).length;
      },
    };
    const uniqueArgs = new Set(Object.keys(argv).map((n) => decamel(n, '-')));
    const unknown = [];
    const { validate } = module.exports;

    for (const unique of uniqueArgs) {
      if (!names.includes(unique)) {
        const [suggestion] = meant(unique, names);
        let help = 'Not sure what you mean there';

        if (suggestion) {
          help = chalk`Did you mean {bold --${suggestion}}?`;
        }

        unknown.push(['', chalk.blue(`--${unique}`), help]);
      }
    }

    for (const name of names) {
      const flag = flags[name];
      const value = argv[name];

      // eslint-disable-next-line valid-typeof
      if (!validate(flag, value)) {
        errors.push([
          '',
          chalk.blue(`--${name}`),
          chalk`must be set to a {bold ${flag.type}}`,
        ]);
      }
    }

    if (errors.length) {
      const pre = 'Flags were specified with invalid values:';
      const post = 'Please check the command executed.';
      const out = `${pre}\n\n${table(errors, tableOptions)}\n\n${post}`;

      /* istanbul ignore else */
      if (!options.stdout) {
        throw new Error(out);
      } else {
        log.error(out);
      }
    }

    if (unknown.length) {
      /* istanbul ignore if */
      if (errors.length && options.stdout) {
        console.log(''); // eslint-disable-line no-console
      }

      const pre = `Flags were specified that were not recognized:`;
      const post = 'Please check the command executed.';
      const out = `${pre}\n\n${table(unknown, tableOptions)}\n\n${post}`;

      /* istanbul ignore if */
      if (options.stdout) {
        log.error(out);
      } else {
        throw new Error(out);
      }
    }

    if (errors.length || unknown.length) {
      return false;
    }

    return true;
  },
};
