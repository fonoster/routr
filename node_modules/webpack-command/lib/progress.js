const webpack = require('webpack');

const { ProgressPlugin } = webpack;

function parseArgs(profile, ...args) {
  // args is an unorganized set of parameters.
  // e.g. building modules|5/6 modules|1 active|/node_modules/lodash/lodash.js
  //      building modules|14/14 modules|0 active|
  //      finish module graph
  //      finish module graph|FlagDependencyExportsPlugin
  const [value, , counts, index, fileName] = args;
  const [, modulePos, totalModules] = (
    (counts || '').match(/(\d+)\/(\d+)/) || []
  ).map((match) => parseInt(match, 10));
  const [, indexNumber, indexState] = (index || '').match(/(\d+)\s(.+)/) || [];
  const percentage = parseFloat(value);
  const [, stepName] = args;
  let scope;
  let empty;

  // we've got a step with a scope on our hands
  // e.g. finish module graph|FlagDependencyExportsPlugin
  if (args.length === 3) {
    scope = counts;
  }

  const result = {
    profile,
    fileName,
    scope,
    step: {
      index: parseInt(indexNumber, 10) || empty,
      modulePosition: modulePos || empty,
      name: stepName,
      percentage: percentage || empty,
      state: indexState,
      totalModules: totalModules || empty,
    },
  };

  return result;
}

module.exports = {
  apply(config, compiler, reporter) {
    const { profile } = config;
    const opts = { profile };

    if (reporter.progress) {
      opts.handler = (...args) => {
        const data = parseArgs(profile, ...args);
        reporter.progress(data);
      };
    }

    const plugin = new ProgressPlugin(opts);
    plugin.apply(compiler);
  },

  parseArgs,
};
