#!/usr/bin/env node
var fs = require('fs');
var chalk = require('chalk');
var broccoli = require('broccoli');
var copyDereferenceSync = require('copy-dereference').sync;
var argv = require('minimist')(process.argv.slice(2));

function run(args) {

  /* ENVIRONMENT */
  if (args.environment) {
    process.env['BROCCOLI_ENV'] = args.environment;
    process.env['TESTING'] = args.testing;
  }

  var tree = broccoli.loadBrocfile();
  var builder = new broccoli.Builder(tree);
  var destDir = args.output || args._[0];

  if (fs.existsSync(destDir)) {
    console.error(destDir + '/ already exists; we cannot build into an existing directory')
    process.exit(1)
  }

  var onSuccess = function(res) {
    var dir = res.directory;
    copyDereferenceSync(dir, destDir);
    console.log(chalk.bold.green('Build successful - ' + Math.floor(res.totalTime / 1e6) + 'ms'));
  }

  var onError = function(err) {
    console.log(chalk.bold.red(err + '\n\nBuild failed.\n'));
    if (err.message) {
      console.log('Error: ' + err.message);
    }
    if (err.stack) {
      console.log('Stack trace:\n' + err.stack.replace(/(^.)/mg, '  $1'));
    }
  }

  var atExit = function () {
    builder.cleanup()
          .then(function () {
              process.exit(1);
          });
  };

  process.on('SIGINT', atExit);
  process.on('SIGTERM', atExit);

  builder.build()
         .then(onSuccess,onError)

}

run(argv);
