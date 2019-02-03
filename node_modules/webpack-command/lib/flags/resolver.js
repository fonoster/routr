const chalk = require('chalk');
const isObject = require('isobject');
const merge = require('merge-options');

module.exports = {
  apply(argv, options) {
    const result = {};
    const resolve = {};

    if (argv.resolveAlias && isObject(argv.resolveAlias)) {
      resolve.alias = argv.resolveAlias;
    }

    if (argv.resolveExtensions) {
      const value = argv.resolveExtensions;

      if (value) {
        resolve.extensions = Array.isArray(value) ? value : value.split(/,\s*/);
      }
    }

    if (argv.resolveLoaderAlias) {
      result.resolveLoader = argv.resolveAlias;
    }

    if (Object.keys(resolve).length) {
      result.resolve = resolve;
    }

    return merge(options, result);
  },

  flags: {
    'resolve-alias': {
      desc: chalk`Setup a module alias for resolving
{dim e.g. --resolve-alias.jquery jquery.plugin}`,
      type: 'object',
    },
    'resolve-extensions': {
      desc: chalk`Setup extensions that should be used to resolve modules
{dim e.g. .es6,.js}`,
      type: ['string', 'array'],
    },
    'resolve-loader-alias': {
      desc: 'Setup a loader alias for resolving',
      type: 'object',
    },
  },

  name: 'Resolver',
};
