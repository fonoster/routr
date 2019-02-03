const camelcase = require('camelcase');
const merge = require('merge-options');
const { LoaderOptionsPlugin, optimize } = require('webpack');

const { MinChunkSizePlugin, LimitChunkCountPlugin } = optimize;

module.exports = {
  apply(argv, options) {
    let plugins = [];

    if (options.plugins) {
      plugins = plugins.concat(options.plugins);
    }

    const { flags } = module.exports;
    const keys = Object.keys(flags);

    for (const key of keys) {
      const arg = camelcase(key);
      const flag = flags[key];
      const value = argv[arg];

      if (value) {
        const plugin = flag.apply(value);
        plugins.unshift(plugin);
      }
    }

    return merge(options, plugins.length ? { plugins } : {});
  },

  flags: {
    'optimize-max-chunks': {
      apply: (value) =>
        new LimitChunkCountPlugin({ maxChunks: parseInt(value, 10) }),
      desc: 'Try to keep the chunk count below a limit',
      type: 'number',
    },
    'optimize-min-chunk-size': {
      apply: (value) =>
        new MinChunkSizePlugin({ minChunkSize: parseInt(value, 10) }),
      desc: 'Try to keep the chunk size above a limit',
      type: 'number',
    },
    'optimize-minimize': {
      apply: () => new LoaderOptionsPlugin({ minimize: true }),
      desc: 'Minimize javascript and switches loaders to minimizing',
      type: 'boolean',
    },
  },

  name: 'Optimization',
};
