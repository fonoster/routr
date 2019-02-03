module.exports = class Command {
  constructor() {
    this.init = true;
  }

  // eslint-disable-next-line class-methods-use-this
  help() {
    return '<base>';
  }

  run(/* cli */) {}
};

module.exports.CommandError = class CommandError extends Error {
  constructor(...args) {
    super(...args);
    this.name = 'CommandError';
  }
};
