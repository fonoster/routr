const plur = require('plur');
const strip = require('strip-ansi');

module.exports = {
  assets(stats) {
    const result = [];

    //   ['49.1 kB', 'main', './output.js', 'emitted'],
    for (const asset of stats.assets) {
      const assetFile = (asset.name || '').toString();
      let name = asset.chunkNames.join(', ');

      // some loaders populate chunkNames
      if (!name) {
        const matches = assetFile.match(/\.[\w]+$/);
        name =
          matches && matches.length > 0 ? matches[0].substring(1) : '<unknown>';
      }

      result.push([
        asset.size,
        name,
        assetFile,
        [asset.emitted ? 'emitted' : ''],
      ]);
    }

    return result;
  },

  files(stats) {
    const assets = module.exports.assets(stats);
    const modules = module.exports.modules(stats);
    let result = [].concat(module.exports.header(), modules);

    if (assets.length) {
      result = result.concat(
        [['', '', '', '']],
        module.exports.header('asset'),
        assets
      );
    }

    return result;
  },

  footer(state) {
    const { totals } = state;
    if (state.instances > 1) {
      totals.time = state.time;
    }
    return totals;
  },

  header(type) {
    return [['size', 'name', type || 'module', 'status']];
  },

  hidden(stats) {
    const result = [];
    const assets = stats.filteredAssets;
    const modules = stats.filteredModules;

    if (assets > 0) {
      result.push(`${assets} ${plur('asset', assets)}`);
    }

    if (modules > 0) {
      result.push(`${modules} ${plur('module', modules)}`);
    }

    return result.length ? `(${result.join(', ')} hidden)` : '';
  },

  modules(stats) {
    const result = [];
    const { status } = module.exports;
    const reLoader = /(.+node_modules\/)((.+-loader).+!)/i;
    const reNodeModules = /(.*)node_modules/;

    for (const module of stats.modules) {
      let modulePath = (module.name || module.identifier).toString();

      if (reLoader.test(modulePath)) {
        modulePath = modulePath.replace(reLoader, '$3!');
      } else if (reNodeModules.test(modulePath)) {
        modulePath = modulePath.replace(reNodeModules, '(node_modules)');
      }

      const row = [
        module.size,
        module.id.toString(),
        modulePath,
        status(module),
      ];

      result.push(row);
    }

    return result;
  },

  problems(stats, state) {
    const probs = {};

    for (const level of ['errors', 'warnings']) {
      for (const reported of stats[level]) {
        const item = module.exports.problem(reported);
        const { file } = item;
        const problem = probs[file] || { errors: [], warnings: [] };

        problem[level].push(item);

        for (const module of stats.modules) {
          // manually update the error count. something is broken in webpack
          if (
            file === module.id ||
            file === module.name ||
            file === module.identifier
          ) {
            module[level] += 1;
          }
        }

        probs[file] = problem;
        state.totals[level] += 1; // eslint-disable-line no-param-reassign
      }
    }

    return probs;
  },

  problem(original) {
    const reFileList = /((assets|entrypoints):[\s\S]+)$/i;
    const rePerformance = /^([\w ]+ limit|[\w ]+ recommendations): /i;
    const rePosition = /\s?\(?((\d+):(\d+))(-\d+)?\)?/;

    let problem = strip(` ${original}`.slice(1));
    let file;
    let fileList;
    let line;
    let column;
    // let message;

    if (rePerformance.test(problem)) {
      // the prefix of the performance errors are overly verbose for stylish
      file = 'performance';
      problem = problem.replace(rePerformance, '');
    }

    if (reFileList.test(problem)) {
      const matches = problem.match(reFileList);
      fileList = matches.length ? matches[0] : '<stylish-error>';
      // replace spaces with a unicode character we can replace later to
      // preserve formatting, and allow for automation. replace 3 spaces with
      // 2 to match stylish output.
      fileList = fileList
        .trim()
        .replace(/ {3}/g, '  ')
        .replace(/ /g, '░');
      problem = problem.replace(reFileList, '');
    }

    const lines = problem.trim().split('\n');

    if (!file) {
      [file] = lines;
    } else {
      lines.unshift('');
    }

    let [, message] = lines;
    message =
      message || 'webpack-stylish: <please report unknown message format>';

    if (rePosition.test(message)) {
      // warnings position format (beginning of the message)
      [, , line, column] = message.match(rePosition) || [0, 0, 0, 0];

      if (lines.length > 3) {
        message = lines.slice(1, lines.length).join(' ');
      }
    } else {
      // errors position format (end of the message)
      const position = lines[lines.length - 1];
      if (rePosition.test(position)) {
        [, , line, column] = position.match(rePosition) || [0, 0, 0, 0];
        message = lines.slice(1, lines.length - 1).join(' ');
      } else {
        [line, column] = [0, 0];
      }
    }

    const item = {
      file,
      message: message.replace(rePosition, '').trim(),
      line,
      column,
    };

    if (fileList) {
      item.message += `\n ${fileList}`;
    }

    return item;
  },

  status(module) {
    const result = [];

    if (module.cacheable === false) {
      result.push('no-cache');
    }

    if (module.optional) {
      result.push('optional');
    }

    if (module.built) {
      result.push('built');
    }

    if (module.prefetched) {
      result.push('prefetch');
    }

    if (module.failed) {
      result.push('failed');
    }

    if (module.warnings) {
      result.push('warning');
    }

    if (module.errors) {
      result.push('error');
    }

    return result;
  },
};
