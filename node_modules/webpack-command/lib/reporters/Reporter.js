module.exports = class Reporter {
  /**
     @constructor
     @param compiler  {Object}  A webpack Compiler instance https://webpack.js.org/api/node/#compiler-instance
   */
  // eslint-disable-next-line no-unused-vars
  constructor(options) {
    this.compiler = options.compiler;
    this.config = options.config;
  }

  /**
     NOTE: Reporters also support a progress handler, which is called when webpack
     reports progress on a build, typically in tandem with the --progress CLI flag.

     @method progress
     @param data  {Object}  An object containing data on the current progress state of a build.

     const data = {
       profile: Boolean,
       fileName: String,
       scope: String,
       step: {
         index: Number,
         modulePosition: Number,
         name: String,
         percentage: Number,
         state: String,
         totalModules: Number,
       },
     };
   */
  // eslint-disable-next-line no-unused-vars
  progress(data) {}

  /**
     @method render
     @param error  {Error}   An Error object
     @param stats  {Object}  A webpack stats object https://webpack.js.org/api/node/#stats-object
   */
  // eslint-disable-next-line no-unused-vars
  render(error, stats) {}
};
