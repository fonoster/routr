var path = require('path');

module.exports = {
    entry: {
        server: './node_modules/@routr/core/server.js',
        route_loader: './node_modules/@routr/location/route_loader.js',
        rest: './node_modules/@routr/rest/rest.js',
        registry: './node_modules/@routr/registry/registry.js'
    },
    output: {
        filename: "[name].bundle.js",
        path: path.resolve(__dirname, 'libs')
    },
    devtool: "source-map",
    resolve: {
        extensions: [ '.tsx', '.ts', '.js' ],
        fallback: { "buffer": require.resolve("buffer/") }
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
