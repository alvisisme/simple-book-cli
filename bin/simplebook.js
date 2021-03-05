#! /usr/bin/env node

var _ = require('lodash');
var path = require('path');
var program = require('commander');
var parsedArgv = require('optimist').argv;
var color = require('bash-color');

var pkg = require('../package.json');
var manager = require('../lib');
var commands = require('../lib/commands');

// Which book is concerned?
var bookRoot = parsedArgv._[1] || process.cwd();

function runPromise(p) {
    return p
    .then(function() {
        process.exit(0);
    }, function(err) {
        console.log('');
        console.log(color.red(err.toString()));
        if (program.debug || process.env.DEBUG) console.log(err.stack || '');
        process.exit(1);
    });
}

function printSimpleBookVersion(v) {
    var actualVersion = (v.name != v.version)? ' ('+v.version+')' : '';
    return v.name + actualVersion;
}

// Init simplebook-cli
manager.init();

program
    .option('-v, --simplebook [version]', 'specify SimpleBook version to use')
    .option('-d, --debug', 'enable verbose error')
    .option('-V, --version', 'Display running versions of simplebook and simplebook-cli', function() {
        console.log('CLI version:', pkg.version);
        runPromise(
            manager.ensure(bookRoot, program.simplebook)
            .then(function(v) {
                console.log('SimpleBook version:', printSimpleBookVersion(v));
                process.exit(0);
            })
        );
    });

program
    .command('ls')
    .description('List versions installed locally')
    .action(function(){
        var versions = manager.versions();

        if (versions.length > 0) {
            console.log('SimpleBook Versions Installed:');
            console.log('');

            _.each(versions,function(v, i) {
                var text = v.name;
                if (v.name != v.version) text += ' [' + v.version + ']';
                if (v.link) text = text + ' (alias of ' + v.link + ')';

                console.log('   ', i == 0? '*' : ' ', text);
            });
            console.log('');
            console.log('Run "simplebook update" to update to the latest version.');
        } else {
            console.log('There is no versions installed');
            console.log('You can install the latest version using: "simplebook fetch"');
        }
    });

program
    .command('current')
    .description('Display currently activated version')
    .action(function(){
        runPromise(
            manager.ensure(bookRoot, program.gitbook)
            .then(function(v) {
                console.log('SimpleBook version is', printSimpleBookVersion(v));
            })
        );
    });

program
    .command('ls-remote')
    .description('List remote versions available for install')
    .action(function(){
        runPromise(
            manager.available()
            .then(function(available) {
                console.log('Available SimpleBook Versions:');
                console.log('');
                console.log('    ', available.versions.join(', '));
                console.log('');
                console.log('Tags:');
                console.log('');
                _.each(available.tags, function(version, tagName) {
                    console.log('    ', tagName, ':', version);
                });
                console.log('');
            })
        );
    });

program
    .command('fetch [version]')
    .description('Download and install a <version>')
    .action(function(version){
        version = version || '*';

        runPromise(
            manager.install(version)
            .then(function(installedVersion) {
                console.log('');
                console.log(color.green('simple-book '+installedVersion+' has been installed'));
            })
        );
    });

program
    .command('alias [folder] [version]')
    .description('Set an alias named <version> pointing to <folder>')
    .action(function(folder, version) {
        folder = path.resolve(folder || process.cwd());
        version = version || 'latest';

        runPromise(
            manager.link(version, folder)
            .then(function() {
                console.log(color.green('simple-book '+version+' point to '+folder));
            })
        );
    });

program
    .command('uninstall [version]')
    .description('Uninstall a version')
    .action(function(version){
        runPromise(
            manager.uninstall(version)
            .then(function() {
                console.log(color.green('simple-book '+version+' has been uninstalled.'));
            })
        );
    });

program
    .command('update [tag]')
    .description('Update to the latest version of simple-book')
    .action(function(tag){
        runPromise(
            manager.update(tag)
            .then(function(version) {
                if (!version) {
                    console.log('No update found!');
                } else {
                    console.log('');
                    console.log(color.green('simple-book has been updated to '+version));
                }
            })
        );
    });

program
    .command('help')
    .description('List commands for simple-book')
    .action(function(){
        runPromise(
            manager.ensureAndLoad(bookRoot, program.gitbook)
            .get('commands')
            .then(commands.help)
        );
    });

program
    .command('*')
    .description('run a command with a specific simple-book version')
    .action(function(commandName){
        var args = parsedArgv._.slice(1);
        var kwargs = _.omit(parsedArgv, '$0', '_');

        runPromise(
            manager.ensureAndLoad(bookRoot, program.gitbook)
            .then(function(gitbook) {
                return commands.exec(gitbook.commands, commandName, args, kwargs);
            })
        );
    });

// Parse and fallback to help if no args
if(_.isEmpty(program.parse(process.argv).args) && process.argv.length === 2) {
    program.help();
}
