const path = require('path');

const chalk = require('chalk');
const merge = require('merge-options');
const webpack = require('webpack');

module.exports = {
  apply(argv, options) {
    let plugins = [];
    const result = {};

    if (options.plugins) {
      plugins = plugins.concat(options.plugins);
    }

    // NOTE: runDev and runProd should be examined FIRST, as they manipulate
    //       the argv object. Manipulating argv is bad and should make us feel
    //       bad.
    /* eslint-disable no-param-reassign */
    if (argv.runDev) {
      argv.debug = true;
      argv['output-pathinfo'] = true;
      if (!argv.devtool) {
        argv.devtool = 'eval-cheap-module-source-map';
      }
      if (!argv.mode) {
        argv.mode = 'development';
      }
    }

    if (argv.runProd) {
      argv['optimize-minimize'] = true;
      argv.define = []
        .concat(argv.define || [])
        .concat('process.env.NODE_ENV="production"');
      if (!argv.mode) {
        argv.mode = 'production';
      }
    }

    if (argv.context) {
      result.context = path.resolve(argv.context);
    } else {
      result.context = process.cwd();
    }

    if (argv.debug) {
      const { LoaderOptionsPlugin } = webpack;
      const plugin = new LoaderOptionsPlugin({ debug: true });
      plugins.unshift(plugin);
    }

    if (argv.devtool) {
      result.devtool = argv.devtool;
    }

    if (argv.profile) {
      result.profile = argv.profile;
    }

    if (argv.progress) {
      result.progress = argv.progress;
    }

    if (argv.reporter) {
      result.reporter = argv.reporter;
    }

    if (argv.watch) {
      result.watch = true;
    }

    return merge(options, result, plugins.length ? { plugins } : {});
  },

  flags: {
    context: {
      desc: 'The root directory for resolving entry point and stats',
      type: 'string',
    },
    debug: {
      desc: 'Switch loaders to debug mode',
      type: 'boolean',
    },
    devtool: {
      desc: chalk`Enable devtool for better debugging experience.
{dim e.g. --devtool eval-cheap-module-source-map}`,
      type: 'string',
    },
    entry: {
      desc: 'The entry point',
      type: ['array', 'object', 'string'],
    },
    help: {
      desc: 'Show usage information and the options listed here',
    },
    'log-level': {
      desc: chalk`Limit all process console messages to a specific level and above
{dim Levels: trace, debug, info, warn, error, silent}`,
      type: 'string',
    },
    'log-time': {
      desc: 'Instruct the logger and dependencies to display a timestamp',
    },
    progress: {
      desc: chalk`Instructs webpack to track and display build progress
{dim This is often used with --profile}`,
      type: 'boolean',
    },
    reporter: {
      desc:
        'Specifies the reporter to use for generating console output for a build',
      type: 'string',
    },
    require: {
      desc: `Preload one or more modules before loading the webpack configuration
Typically used for language-specific require hooks`,
      type: ['string', 'array'],
    },
    'run-dev': {
      alias: 'd',
      desc:
        'An alias for --debug --devtool eval-cheap-module-source-map --output-pathinfo',
      type: 'boolean',
    },
    'run-prod': {
      alias: 'p',
      desc:
        'An alias for --optimize-minimize --define process.env.NODE_ENV="production"',
      type: 'boolean',
    },
    version: {
      desc: 'Display the webpack-command version',
    },
    watch: {
      alias: 'w',
      desc: 'Watch the filesystem for changes',
      type: 'boolean',
    },
  },

  name: 'General',
};
