const ora = require('ora');

const Reporter = require('./Reporter');

module.exports = class BasicReporter extends Reporter {
  constructor(...args) {
    super(...args);

    this.spinner = ora({ spinner: 'toggle6' });
  }

  // TODO: create proper testing for this with a large build an stdout hooks.
  /* istanbul ignore next */
  progress(data) {
    if (!this.spinner.isSpinning && data.step.percentage < 1) {
      this.spinner.start(data.step.name);
    }

    const { name, modulePosition, totalModules } = data.step;
    const percent = Math.floor(data.step.percentage * 100);

    if (modulePosition) {
      this.spinner.text = `${percent}% ${modulePosition}/${totalModules} ${name} ${
        data.fileName
      }`;
    } else {
      this.spinner.text = `${percent} ${name} ${data.scope}`;
    }

    if (data.step.percentage >= 1) {
      this.spinner.stop();
    }
  }

  render(error, stats) {
    const { log } = console;
    const compilers = this.compiler.compilers || [this.compiler];

    const targetCompiler = compilers.find((comp) => !!comp.options.stats);
    const { options } = targetCompiler || { options: {} };
    const result = stats.toString(options.stats);

    log(result);

    return result;
  }
};
