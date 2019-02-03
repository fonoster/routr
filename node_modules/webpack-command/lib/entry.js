const isObject = require('isobject');

module.exports = (cli) => {
  const { flags: argv, entries } = cli;
  let entry;
  const flag = argv.entry;
  const assertArray = () => {
    if (!entry) {
      entry = { main: [] };
    } else if (!entry.main || !Array.isArray(entry.main)) {
      entry.main = [entry.main];
    }
  };

  // if entries were specified as input, they take precedence
  if (entries.length) {
    entry = { main: entries.length > 1 ? entries : entries[0] };
  }

  if (flag) {
    if (isObject(flag)) {
      if (flag.main) {
        assertArray();
        entry.main = entry.main.concat(flag.main);
      }

      if (!entry) {
        entry = {};
      }

      const keys = Object.keys(flag).filter((name) => name !== 'main');

      for (const key of keys) {
        entry[key] = flag[key];
      }
    } else if (Array.isArray(flag)) {
      assertArray();

      entry.main = entry.main.concat(flag);
    } else if (typeof flag === 'string') {
      if (entry && entry.main) {
        assertArray();

        entry.main.push(flag);
      } else {
        entry = { main: flag };
      }
    }
  }

  return entry;
};
