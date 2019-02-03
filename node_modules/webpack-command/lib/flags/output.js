const { basename, dirname, isAbsolute, resolve } = require('path');

const camelcase = require('camelcase');
const merge = require('merge-options');

module.exports = {
  apply(argv, options) {
    const output = {};
    const { flags } = module.exports;
    const keys = Object.keys(flags).filter((key) => key !== 'output');

    if (argv.output) {
      let outputPath = argv.output;
      if (!isAbsolute(outputPath)) {
        outputPath = resolve(process.cwd(), outputPath);
      }
      argv.outputFilename = basename(outputPath); // eslint-disable-line no-param-reassign
      argv.outputPath = dirname(outputPath); // eslint-disable-line no-param-reassign
    }

    for (const key of keys) {
      const arg = camelcase(key);
      let value = argv[arg];

      if (value) {
        if (arg === 'outputPath') {
          value = resolve(value);
        }

        if (typeof value !== 'undefined') {
          output[camelcase(key.replace('output-', ''))] = value;
        }
      }
    }

    return merge(options, { output });
  },

  flags: {
    output: {
      alias: 'o',
      desc: 'The output path and file for compilation assets',
      type: 'string',
    },
    'output-chunk-filename': {
      desc: 'The output filename for additional chunks',
      type: 'string',
    },
    'output-filename': {
      desc: 'The output filename of the bundle',
      type: 'string',
    },
    'output-jsonp-function': {
      desc: 'The name of the JSONP function used for chunk loading',
      type: 'string',
    },
    'output-library': {
      desc: 'Expose the exports of the entry point as library',
      type: 'string',
    },
    'output-library-target': {
      desc: 'The type for exposing the exports of the entry point as library',
      type: 'string',
    },
    'output-path': {
      desc: 'The output path for compilation assets',
      type: 'string',
    },
    'output-pathinfo': {
      desc:
        'Include a comment with the request for every dependency (require, import, etc.)',
      type: 'boolean',
    },
    'output-public-path': {
      desc: 'The public path for the assets',
      type: 'string',
    },
    'output-source-map-filename': {
      desc: 'The output filename for the SourceMap',
      type: 'string',
    },
  },

  name: 'Output',
};
