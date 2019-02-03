const chalk = require('chalk');
const merge = require('merge-options');
const strip = require('strip-ansi');
const table = require('text-table');

const advanced = require('./advanced.js');
const config = require('./config.js'); // eslint
const general = require('./general.js');
const modul = require('./module.js'); // eslint
const optimization = require('./optimization.js'); // eslint
const output = require('./output.js'); // eslint
const resolver = require('./resolver.js'); // eslint
const { validateFlags } = require('./util');

const allFlags = [
  general,
  advanced,
  config,
  modul,
  optimization,
  output,
  resolver,
];

function getGroupHelp(group) {
  const rows = [];
  const { name } = group;

  if (name !== 'General') {
    rows.push([chalk`{underline ${group.name}}`, '']);
  }

  for (const flagName of Object.keys(group.flags)) {
    const flag = group.flags[flagName];
    let { desc } = flag;
    const { deprecated } = flag;

    if (deprecated) {
      desc = chalk`{bold Deprecated.} Please use ${deprecated}.\n${desc}`;
    }

    const lines = desc.split('\n');
    const [description] = lines.splice(0, 1);

    rows.push([`  --${flagName}`, description]);

    if (lines.length > 0) {
      for (const line of lines) {
        rows.push(['', line]);
      }
    }
  }

  return rows;
}

module.exports = {
  apply(argv, options) {
    const groups = allFlags.slice(0);
    const { getFlags } = module.exports;
    const flags = getFlags();
    let result = merge({}, options);

    // two loops may seem silly, but it's good UX to validate all the flags at
    // once. this is also familiar to users of linters.
    if (!validateFlags(flags, argv)) {
      return null;
    }

    for (const group of groups) {
      result = group.apply(argv, result);
    }

    return result;
  },

  help() {
    let rows = [];
    const groups = allFlags.slice(0);
    const options = {
      align: ['l', 'l'],
      stringLength(str) {
        return strip(str).length;
      },
    };

    for (const group of groups) {
      rows = rows.concat(getGroupHelp(group));
      rows.push(['', '']);
    }

    return table(rows, options);
  },

  getFlags(includeAlias = true) {
    const groups = allFlags.slice(0);
    let result = {};

    for (const group of groups) {
      const { flags } = group;
      result = Object.assign(result, flags);

      if (includeAlias) {
        const aliases = {};
        for (const flag of Object.values(flags).filter((f) => !!f.alias)) {
          aliases[flag.alias] = flag;
        }

        result = Object.assign(result, aliases);
      }
    }

    return result;
  },

  opts() {
    const result = {};
    const groups = allFlags.slice(0);

    for (const group of groups) {
      for (const key of Object.keys(group.flags)) {
        const flag = Object.assign({}, group.flags[key]);

        delete flag.desc;
        delete flag.deprecated;

        result[key] = flag;
      }
    }

    return result;
  },
};
