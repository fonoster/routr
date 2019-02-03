const chalk = require('chalk');
const plur = require('plur');
const prettyBytes = require('pretty-bytes');
const strip = require('strip-ansi');
const symbols = require('log-symbols');
const table = require('text-table');
const wrap = require('wordwrap')(72);

/* eslint-disable no-param-reassign */

module.exports = {
  files(rows, opts) {
    const max = opts.performance.maxAssetSize;
    const options = {
      align: ['', 'l', 'l', 'l', 'l'],
      stringLength(str) {
        return strip(str).length;
      },
    };

    rows = rows.map((row) => {
      row.unshift('');

      const [, size, name, file, status] = row;
      const filePath = file.substring(0, file.lastIndexOf('/') + 1);
      const namePath = name.substring(0, name.lastIndexOf('/') + 1);
      const sizeStyle = size > max ? chalk.yellow : chalk.green;

      if (size === 'size') {
        row = module.exports.header(row);
      } else if (size && name) {
        // ignore empty rows, only render rows with data
        row[1] = sizeStyle(prettyBytes(size));
        row[2] = chalk.blue(name.replace(namePath, '').trim());
        row[3] = chalk.dim(filePath) + file.replace(filePath, '');
        row[4] = module.exports.status(status);
      }

      return row;
    });

    return table(rows, options);
  },

  footer(counts) {
    const problems = counts.errors + counts.warnings;
    const result = [];

    if (counts.time) {
      const time = module.exports.time(counts.time);
      result.push(chalk`{gray {bold {italic total}} Δ{italic t}} ${time}`);
    }

    if (problems > 0) {
      const symbol = counts.errors > 0 ? symbols.error : symbols.warning;
      const style = {
        errors: counts.errors > 0 ? 'red' : 'dim',
        problems: problems > 0 ? 'bold' : 'dim',
        warnings: counts.warnings > 0 ? 'yellow' : 'dim',
      };
      const labels = {
        errors: plur('error', counts.errors),
        problems: chalk[style.problems](
          `${problems} ${plur('problem', problems)}`
        ),
        warnings: plur('warning', counts.warnings),
      };
      const errors = chalk[style.errors](`${counts.errors} ${labels.errors}`);
      const warnings = chalk[style.warnings](
        `${counts.warnings} ${labels.warnings}`
      );

      if (counts.errors > 0) {
        labels.problems = chalk[style.errors](labels.problems);
      } else if (counts.warnings) {
        labels.problems = ` ${chalk[style.warnings](labels.problems)}`;
      }

      result.push(
        chalk`${symbol} ${labels.problems} {dim (}${errors}, ${warnings}{dim )}`
      );
    }

    return result.join('\n');
  },

  hash(json, files, hidden) {
    const { hash } = json;
    const time = module.exports.time(json.time);
    const result = [];

    result.push(chalk.underline(hash));
    result.push(files);
    result.push(chalk`\n  {gray Δ{italic t}} ${time} ${hidden}`);

    return result.join('\n');
  },

  header(row) {
    return row.map((h) => chalk.gray(h));
  },

  hidden(text) {
    return chalk.dim(text);
  },

  problems(problems) {
    const result = [];
    const { dim } = chalk;
    const types = { errors: 'red', warnings: 'yellow' };

    // render problem table per-file
    for (const key of Object.keys(problems)) {
      const problem = problems[key];
      const rows = [];
      const options = {
        align: ['', 'l', 'l', 'l', 'l'],
        stringLength(str) {
          return strip(str).length;
        },
      };

      result.push('', chalk.underline(key));

      for (const type of Object.keys(types)) {
        const color = types[type];

        for (const item of problem[type]) {
          const message = wrap(item.message);
          const lines = message
            .split('\n')
            .map((l) => chalk.blue(l.replace(/░/g, ' ')));
          const probType = chalk[color](type.substring(0, type.length - 1));

          rows.push([
            '',
            dim(`${item.line}:${item.column}`),
            probType,
            lines[0],
          ]);

          for (const line of lines.slice(1)) {
            rows.push(['', '', '', line]);
          }
        }
      }

      result.push(table(rows, options));
    }

    if (result.length) {
      result.unshift('');
      result.push('');
    }

    return result.join('\n');
  },

  status(statuses) {
    return statuses
      .map((status) => {
        if (status === 'emitted' || status === 'built') {
          return chalk.green(status);
        } else if (status === 'error') {
          status = chalk.bold(symbols.error);
        } else if (status === 'failed') {
          status = chalk.red.bold(status);
        } else if (status === 'warning') {
          status = chalk.bold(symbols.warning);
        } else if (status === 'optional' || status === 'no-cache') {
          return chalk.yellow(status);
        } else if (status === 'prefetch') {
          return chalk.cyan(status);
        }

        return status;
      })
      .join(' ');
  },

  time(ms) {
    const out = `${ms.toString()}ms`;
    const ubound = 1600;
    const lbound = 200;

    if (ms > ubound) {
      return chalk.bgRed(out);
    } else if (ms <= lbound) {
      return chalk.green.bold(out);
    }

    const styles = [chalk.red.bold, chalk.red, chalk.yellow, chalk.green];
    const values = [ubound, ubound / 2, lbound * 2, lbound];
    const closest = Math.max.apply(null, values.filter((v) => v <= ms));
    const style = styles[values.indexOf(closest)];

    return style(out);
  },
};
