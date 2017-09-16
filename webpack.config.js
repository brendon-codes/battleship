
"use strict";

const Webpack = require("webpack");
const Extend = require("util")._extend;
const Path = require("path");

//process.traceDeprecation = true;

const configBase = {
  devtool: "#source-map",
  plugins: [
    new Webpack.ProvidePlugin({
      "$": "jquery",
      "jQuery": "jquery",
      "window.jQuery": "jquery"
    })
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        use: [
          {
            loader: "babel-loader",
            options: {
              compact: false
            }
          },
          {
            loader: "exports-loader"
          }
        ],
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: "style-loader"
          },
          {
            loader: "css-loader"
          }
        ]
      }
    ]
  }
};


const configApp = Extend({
  entry: {
    dash: "./src/client/web/battleship.js"
  },
  output: {
    filename: "./src/client/web/battleship-build.js"
  },
  watch: true
}, configBase);


const configs = [
  configApp
];


module.exports = configs;
