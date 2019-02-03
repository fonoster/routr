const merge = require('merge-options');

module.exports = {
  apply(argv, options) {
    const result = {};

    if (argv.configRegister) {
      /* istanbul ignore next */
      // eslint-disable-next-line no-param-reassign
      argv.require = argv.configRegister;
    }

    if (argv.mode) {
      result.mode = argv.mode;
    }

    return merge(options, result);
  },

  flags: {
    config: {
      desc: 'Path to the config file',
      type: 'string',
    },
    'config-name': {
      desc: 'Name of the config to use',
      type: 'string',
    },
    'config-register': {
      alias: 'r',
      desc: '',
      deprecated: '--require',
      type: ['string', 'array'],
    },
    mode: {
      desc: 'Specifies the build mode to use; development or production',
      type: 'string',
    },
  },

  name: 'Configuration File',
};
