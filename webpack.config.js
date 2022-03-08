var path = require('path');

module.exports = {
  entry: {
    edgeport: './dist/mods/edgeport/src/runner.js',
  },
  output: {
    filename: "[name].bundle.js",
    path: path.resolve(__dirname, 'mods/edgeport/libs')
  },
  devtool: "source-map",
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      "buffer": require.resolve("buffer/"),
      "fs": false
    }
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
};