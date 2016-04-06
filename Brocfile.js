const env         = require('broccoli-env').getEnv();
const concat      = require('broccoli-concat'),
      mergeTrees  = require('broccoli-merge-trees'),
      funnel      = require('broccoli-funnel'),
      uglifyJs    = require('broccoli-uglify-sourcemap'),
      webpackify  = require('broccoli-webpack-cached'),
      yuidoc      = require('broccoli-yuidoc'),
      webpack     = require('webpack'),
      path        = require('path');


var sources = ['src'];
var entries = ['m'];
if ( process.env.TESTING === 'true' ){
  sources.push('tests');
  entries.push('./tests-bundle');
}
var yuidocNode = new yuidoc(sources, {destDir: 'docs'});
var m = mergeTrees(sources), mNode = mergeTrees(sources);
m = webpackify(m,
  {
    entry: entries,
    output: {filename: '/m.js'},
    externals: [{'promise': 'Promise', 'sockjs':'SockJS', 'xr': 'xr', 'slang': 'slang', 'moment': 'moment'}],
    devtool: 'cheap-module-inline-source-map',
    module: {
      preLoaders: [{ test: /\.jsx?$/, loaders: ['source-map-loader'] }],
      loaders: [{ test: /\.jsx?$/, loader: 'babel',
        query: {
          plugins: [ ['babel-plugin-transform-builtin-extend', { globals: ['Error', 'Array'], approximate: true } ] ],
          presets: ['es2015', 'react']
        }
      }]/*,
      postLoaders: [{ test: /\.jsx?$/, loader: 'uglify'}]*/
    },
    resolveLoader: { root: path.join(__dirname,'node_modules') }
  });

mNode = webpackify(mNode,{
  debug: false,
  entry: entries,
  output: { libraryTarget: 'commonjs2', filename: '/m.node.js', pathinfo: true },
  target: 'node',
  externals: [{'promise': 'commonjs lie', 'sockjs':'commonjs sockjs-client', 'xr': 'commonjs xr', 'slang': 'commonjs slang', 'moment': 'commonjs moment' }],
  module: { loaders: [{ test: /\.jsx?$/, loader: 'babel', query: { presets: ['es2015','react'] } }] },
  resolveLoader: { root: path.join(__dirname,'node_modules') }
});

// concat the css and javascript dependencies
var vendor = mergeTrees(['vendor','bower_components']);
/* v push other dependencies here vendorJS or vendorCSS arrays */
var vendorJS = [];
// data dependencies
vendorJS.push('xr/xr.js');
vendorJS.push('lie/dist/lie.min.js');
vendorJS.push('sockjs-client/dist/sockjs-1.0.3.min.js');
vendorJS.push('slang/slang.min.js');
vendorJS.push('moment/min/moment.min.js');
/* ^ push other dependencies here vendorJS or vendorCSS arrays */

vendor = concat(vendor, { inputFiles : vendorJS, outputFile : 'vendor.js', sourceMapConfig: { enabled: true }});

var mWithDependencies = concat(mergeTrees([vendor, m]), { inputFiles: ['vendor.js','m.js'], outputFile : 'mWithDependencies.js', sourceMapConfig: { enabled: true } });
// minify if production
// widgetFrameworkWithDependencies = uglifyJs(widgetFrameworkWithDependencies);

// and merge all the trees together (uncomment vendorCSS when it is not empty)
module.exports = mergeTrees([m, mWithDependencies, mNode, yuidocNode]);
