// Requires
var path = require('path');
var execFile = require("child_process").execFile;

// Wrapper of find command
function find(dirname, args, cb) {
    var spawned = execFile(
        '/usr/bin/find',
        ['./'].concat(args),
        {
            maxBuffer: 4000*1024,
            cwd: dirname,
        },
        execHandler(cb)
    );

    // Handle error
    spawned.once('error', cb);
}

// Get all modified files since "time" seconds ago
function modifiedSince(dirname, time, cb) {
    // Make sure time is in seconds
    var timestr = Math.ceil(time + 1).toString();

    // Run the command
    find(dirname, [
        '-type', 'f',
        '-mtime',
        '-'+timestr+'s',
    ], cb);
}

// Get filetree of a folder
function dumpTree(dirname, cb) {
    find(dirname, [
        '-type', 'f',
    ], cb);
}

// handler for exec function
function execHandler(cb) {
    return function(err, stdout, stderr) {
        if(err) {
            return cb(err, []);
        }

        var files = stdout
        .toString()
        // Split by lines
        .split('\n')
        // Filter out empty lines
        .filter(Boolean)
        // Normalize paths
        .map(function(filename) {
            return path.normalize(filename);
        });

        return cb(null, files);
    };
}


// Exports
exports.dump = dumpTree;
exports.modifiedSince = modifiedSince;
