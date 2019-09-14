var path = require('path');

module.exports = {
    entry: {
        app: './node_modules/@routr/core/server.js'    
    },
    output: {
        filename: "[name].bundle.js",
        path: path.resolve(__dirname, 'libs')
    }
};
