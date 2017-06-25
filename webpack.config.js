var path = require('path');

module.exports = {
    entry: {
        app: './node_modules/core/main.js',
        ctl: './node_modules/ctl/ctl.js'
    },
    output: {
        filename: "[name].bundle.js",
        path: path.resolve(__dirname, 'libs')
    },
    devtool: 'source-map'
};