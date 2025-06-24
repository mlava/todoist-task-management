const webpack = require('webpack');

module.exports = {
    entry: './src/index.js',
    output: {
        filename: 'extension.js',
        path: __dirname,
        library: {
            type: "module",
        }
    },
    experiments: {
        outputModule: true,
    },
    mode: 'production',
    performance: {
        hints: false,
    },
};