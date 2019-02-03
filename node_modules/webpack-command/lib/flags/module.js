const { bind } = require('./util');

module.exports = {
  apply(argv, options) {
    let result = bind(argv.moduleBind, undefined, options); // eslint-disable-line no-undefined
    result = bind(argv.moduleBindPre, 'pre', result);
    result = bind(argv.moduleBindPost, 'post', result);

    return result;
  },

  flags: {
    'module-bind': {
      desc: 'Bind an extension to a loader',
      type: 'string',
    },
    'module-bind-post': {
      desc: 'Bind an extension to a postLoader',
      type: 'string',
    },
    'module-bind-pre': {
      desc: 'Bind an extension to a preLoader',
      type: 'string',
    },
  },

  name: 'Modules',
};
