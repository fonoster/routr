const { resolve } = require('path');

const camelcase = require('camelcase');
const chalk = require('chalk');
const isObject = require('isobject');
const merge = require('merge-options');
const {
  DefinePlugin,
  HotModuleReplacementPlugin,
  PrefetchPlugin,
  ProvidePlugin,
} = require('webpack');

const { loadPlugin } = require('./util');

module.exports = {
  apply(argv, options) {
    let plugins = [];
    const output = { watchOptions: {} };

    if (options.plugins) {
      plugins = plugins.concat(options.plugins);
    }

    for (const flag of ['bail', 'cache', 'profile', 'target']) {
      if (argv[flag]) {
        output[flag] = argv[flag];
      }
    }

    for (const name of [
      'records-input-path',
      'records-output-path',
      'records-path',
    ]) {
      const flag = camelcase(name);
      if (argv[flag]) {
        output[flag] = resolve(argv[flag]);
      }
    }

    // --define.test ok
    if (argv.define && isObject(argv.define)) {
      const plugin = new DefinePlugin(argv.define);
      plugins.unshift(plugin);
    }

    if (argv.hot) {
      const plugin = new HotModuleReplacementPlugin();
      plugins.unshift(plugin);
    }

    if (argv.plugin) {
      const plugin = loadPlugin(argv.plugin);
      plugins.unshift(plugin);
    }

    if (argv.prefetch) {
      const plugin = new PrefetchPlugin(argv.prefetch);
      plugins.unshift(plugin);
    }

    if (argv.provide && isObject(argv.provide)) {
      const plugin = new ProvidePlugin(argv.provide);
      plugins.unshift(plugin);
    }

    if (argv.watchAggregateTimeout) {
      output.watchOptions.aggregateTimeout = +argv.watchAggregateTimeout;
    }

    if (argv.watchPoll) {
      const value =
        typeof argv.watchPoll === 'boolean' ? true : +argv.watchPoll;
      output.watchOptions.poll = value;
    }

    if (argv.watchStdin) {
      output.watchOptions.stdin = true;
      output.watch = true;
    }

    if (!Object.keys(output.watchOptions).length) {
      delete output.watchOptions;
    }

    const result = merge(options, output, plugins.length ? { plugins } : {});

    return result;
  },

  flags: {
    bail: {
      type: 'boolean',
      desc: 'Abort the compilation on first error',
    },
    cache: {
      type: 'boolean',
      desc: 'Enable in memory caching',
    },
    define: {
      type: 'object',
      desc: 'Define any free var in the bundle',
    },
    hot: {
      type: 'boolean',
      desc: 'Enables Hot Module Replacement',
    },
    plugin: {
      type: 'string',
      desc: 'Load this plugin',
    },
    prefetch: {
      desc: chalk`Prefetch this request
{dim e.g. --prefetch ./file.js}`,
      type: 'string',
    },
    profile: {
      desc: 'Profile the compilation and include information in stats',
      type: 'boolean',
    },
    provide: {
      desc: chalk`Provide these modules as free vars in all modules
{dim e.g. --provide.jQuery jquery}`,
      type: 'object',
    },
    'records-input-path': {
      desc: 'Path to the records file (reading)',
      type: 'string',
    },
    'records-output-path': {
      desc: 'Path to the records file (writing)',
      type: 'string',
    },
    'records-path': {
      desc: 'Path to the records file',
      type: 'string',
    },
    target: {
      desc: 'The targeted execution environment',
      type: 'string',
    },
    'watch-aggregate-timeout': {
      desc: 'Timeout for gathering changes while watching',
      type: ['string', 'number'],
    },
    'watch-poll': {
      desc: 'The polling interval for watching (also enable polling)',
      type: ['string', 'number'],
    },
    'watch-stdin': {
      alias: 'stdin',
      desc: 'Exit the process when stdin is closed',
      type: 'boolean',
    },
  },

  name: 'Advanced',
};
